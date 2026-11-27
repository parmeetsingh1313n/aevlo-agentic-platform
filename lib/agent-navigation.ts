const INDEX_KEY = "__aevloAgentHistoryIndex";

export type AgentHistoryIntent = { delta: number; key?: string };
type HistoryGuard = (intent: AgentHistoryIntent) => void;
type HistoryTracker = {
  installed: boolean;
  listening: boolean;
  index: number;
  nativeIndex: number | null;
  href: string;
  guard: HistoryGuard | null;
  allowed: boolean;
  restoring: { index: number; intent: AgentHistoryIntent; guard: HistoryGuard } | null;
  markCurrentEntry: (() => void) | null;
};
type NativeTraversalEvent = Event & {
  navigationType: string;
  destination: { index: number; sameDocument: boolean; key?: string };
};
type NavigationWindow = Window & {
  __aevloAgentNavigationHistory?: HistoryTracker;
  navigation?: {
    currentEntry?: { index: number; key?: string };
    addEventListener?: (type: "navigate", listener: (event: Event) => void) => void;
    traverseTo?: (key: string) => { finished: Promise<unknown> };
  };
};

function isHistoryRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function stateIndex(value: unknown): number | null {
  return isHistoryRecord(value) && Number.isSafeInteger(value[INDEX_KEY])
    ? value[INDEX_KEY] as number
    : null;
}
function nativeIndex(): number | null {
  const index = (window as NavigationWindow).navigation?.currentEntry?.index;
  return typeof index === "number" && index >= 0 ? index : null;
}
function tracker(): HistoryTracker {
  const surface = window as NavigationWindow;
  return surface.__aevloAgentNavigationHistory ??= {
    installed: false,
    listening: false,
    index: stateIndex(window.history.state) ?? 0,
    nativeIndex: nativeIndex(),
    href: window.location.href,
    guard: null,
    allowed: false,
    restoring: null,
    markCurrentEntry: null,
  };
}

function rememberCurrentEntry(tracking: HistoryTracker) {
  tracking.nativeIndex = nativeIndex();
  tracking.href = window.location.href;
  tracking.markCurrentEntry?.();
}

/** Listen during layout; history wrapping waits until AppRouter's effects. */
export function prepareNavigationHistory() {
  const tracking = tracker();
  if (tracking.listening) return;
  tracking.listening = true;

  // Window-target popstate listeners can run in registration order, even with
  // capture:true. Cancel same-document traversals before popstate, so this also
  // works when AppRouter's listener predates workspace hydration.
  (window as NavigationWindow).navigation?.addEventListener?.("navigate", (event) => {
    const traversal = event as NativeTraversalEvent;
    const currentIndex = nativeIndex();
    if (tracking.allowed || !tracking.guard || traversal.navigationType !== "traverse" || !event.cancelable || !traversal.destination.sameDocument || currentIndex === null) return;
    const delta = traversal.destination.index - currentIndex;
    if (!delta) return;
    const guard = tracking.guard;
    event.preventDefault();
    // Finish canceling the native traversal before a confirmation can initiate
    // another go(); browsers can ignore traversals during that cancellation.
    const key = traversal.destination.key;
    window.setTimeout(() => guard({ delta, ...(key ? { key } : {}) }), 0);
  });

  window.addEventListener("popstate", (event) => {
    const currentNativeIndex = nativeIndex();
    const nativeDelta = currentNativeIndex !== null && tracking.nativeIndex !== null
      ? currentNativeIndex - tracking.nativeIndex
      : null;
    // The first previous SPA entry may predate this tracker. Modern browsers
    // expose its actual position; otherwise a first Back is one entry earlier.
    const destination = stateIndex(event.state) ?? tracking.index + (nativeDelta ?? -1);
    if (tracking.restoring) {
      event.stopImmediatePropagation();
      const restoration = tracking.restoring;
      if (destination !== restoration.index) {
        window.history.go(restoration.index - destination);
        return;
      }
      tracking.restoring = null;
      rememberCurrentEntry(tracking);
      restoration.guard(restoration.intent);
      return;
    }
    if (tracking.allowed) {
      tracking.allowed = false;
    } else if (tracking.guard && destination !== tracking.index) {
      event.stopImmediatePropagation();
      const intent = { delta: destination - tracking.index };
      tracking.restoring = { index: tracking.index, intent, guard: tracking.guard };
      // popstate cannot be canceled. Restore the original entry before Next
      // sees either event or a confirmation is displayed; never push a clone.
      window.history.go(-intent.delta);
      return;
    }
    tracking.index = destination;
    rememberCurrentEntry(tracking);
  }, true);
}

/** Call after AppRouter's effects, so its patched history methods stay intact. */
export function installNavigationHistory() {
  prepareNavigationHistory();
  const tracking = tracker();
  if (tracking.installed) return;
  tracking.installed = true;
  tracking.index = stateIndex(window.history.state) ?? tracking.index;
  tracking.nativeIndex = nativeIndex();
  tracking.href = window.location.href;
  const history = window.history;
  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);

  tracking.markCurrentEntry = () => {
    const current: unknown = history.state;
    if (isHistoryRecord(current) && stateIndex(current) !== tracking.index) {
      // Clone only the top level: retain Next's __NA and internal router tree.
      replace({ ...current, [INDEX_KEY]: tracking.index }, "");
    }
  };
  history.pushState = (data: unknown, unused: string, url?: string | URL | null) => {
    const nextIndex = tracking.index + 1;
    push(isHistoryRecord(data) ? { ...data, [INDEX_KEY]: nextIndex } : data, unused, url);
    tracking.index = nextIndex;
    rememberCurrentEntry(tracking);
  };
  history.replaceState = (data: unknown, unused: string, url?: string | URL | null) => {
    replace(isHistoryRecord(data) ? { ...data, [INDEX_KEY]: tracking.index } : data, unused, url);
    rememberCurrentEntry(tracking);
  };
  tracking.markCurrentEntry();
}

export function registerAgentHistoryGuard(guard: HistoryGuard) {
  prepareNavigationHistory();
  const tracking = tracker();
  tracking.guard = guard;
  return () => {
    if (tracking.guard === guard) tracking.guard = null;
  };
}

export function leaveAgentHistory(intent: AgentHistoryIntent) {
  const tracking = tracker();
  tracking.allowed = true;
  const navigation = (window as NavigationWindow).navigation;
  if (intent.key && navigation?.traverseTo) {
    const result = navigation.traverseTo(intent.key);
    void result.finished.catch(() => { tracking.allowed = false; });
  } else window.history.go(intent.delta);
}
