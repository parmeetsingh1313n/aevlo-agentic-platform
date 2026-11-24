"use client";

import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { getAuthErrorMessage, getAuthSwitchHref, getSafeCallbackUrl, providerNames, type AuthMode, type OAuthAvailability, type OAuthProviderId } from "@/lib/auth-ui";
import { AuthFormView } from "./auth-form-view";

export function AuthForm({ mode, availability }: { mode: AuthMode; availability: OAuthAvailability }) {
  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"));
  const [loadingProvider, setLoadingProvider] = useState<OAuthProviderId | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const pending = useRef(false);
  const error = localError ?? (loadingProvider ? null : getAuthErrorMessage(searchParams.get("error")));

  async function onContinue(provider: OAuthProviderId) {
    if (pending.current) return;
    setLocalError(null);
    if (!availability[provider]) {
      setLocalError(`${providerNames[provider]} sign-in is currently unavailable. Please try again later.`);
      return;
    }

    pending.current = true;
    setLoadingProvider(provider);
    try {
      const response = await signIn(provider, { callbackUrl });
      if (response?.error) setLocalError(getAuthErrorMessage(response.error));
    } catch {
      setLocalError("Couldn’t reach the sign-in service. Check your connection and try again.");
    } finally {
      pending.current = false;
      setLoadingProvider(null);
    }
  }

  return <AuthFormView mode={mode} loadingProvider={loadingProvider} error={error} switchHref={getAuthSwitchHref(mode, callbackUrl)} onContinue={onContinue} />;
}
