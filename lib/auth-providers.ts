import type { OAuthAvailability } from "./auth-ui";

function isConfigured(value: string | undefined): boolean {
  const credential = value?.trim();
  return Boolean(credential && !/^(your[-_]|placeholder|replace[-_]?me|changeme|example$)/i.test(credential));
}

/** Import from server components only. Never serialize credential values. */
export function getOAuthAvailability(environment: NodeJS.ProcessEnv = process.env): OAuthAvailability {
  return {
    google: isConfigured(environment.GOOGLE_CLIENT_ID) && isConfigured(environment.GOOGLE_CLIENT_SECRET),
    github: isConfigured(environment.GITHUB_CLIENT_ID) && isConfigured(environment.GITHUB_CLIENT_SECRET),
  };
}
