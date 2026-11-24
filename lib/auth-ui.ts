export type AuthMode = "sign-in" | "sign-up";
export type OAuthProviderId = "google" | "github";
export type OAuthAvailability = Readonly<Record<OAuthProviderId, boolean>>;

export const providerNames: Record<OAuthProviderId, string> = {
  google: "Google",
  github: "GitHub",
};

function hasUnsafeCharacters(value: string) {
  return value.includes("\\") || Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

/** OAuth destinations stay on this application, including after mode switches. */
export function getSafeCallbackUrl(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || hasUnsafeCharacters(value)) {
    return "/";
  }

  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || hasUnsafeCharacters(decoded)) return "/";
    const url = new URL(value, "https://callback.invalid");
    if (url.origin !== "https://callback.invalid") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function getAuthSwitchHref(mode: AuthMode, callbackUrl: string): string {
  const target = mode === "sign-in" ? "/sign-up" : "/sign-in";
  const safeUrl = getSafeCallbackUrl(callbackUrl);
  return safeUrl === "/" ? target : `${target}?${new URLSearchParams({ callbackUrl: safeUrl })}`;
}

const errorMessages: Record<string, string> = {
  Configuration: "Sign-in isn’t configured for this workspace yet. Connect an OAuth provider to continue.",
  AccessDenied: "That account wasn’t granted access. Try again with an account that can access this workspace.",
  OAuthAccountNotLinked: "This email is linked to another sign-in method. Continue with the provider you used before.",
  OAuthSignin: "We couldn’t connect to that provider. Please try again.",
  OAuthCallback: "The provider couldn’t complete sign-in. Please try again.",
  OAuthCreateAccount: "We couldn’t create your account with that provider. Please try again.",
  SessionRequired: "Sign in to continue to your workspace.",
  Verification: "That sign-in link has expired. Request a new link and try again.",
};

export function getAuthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return Object.hasOwn(errorMessages, code)
    ? errorMessages[code]
    : "Something interrupted sign-in. Please try again.";
}
