import { Suspense } from "react";
import { connection } from "next/server";
import type { AuthMode } from "@/lib/auth-ui";
import { getOAuthAvailability } from "@/lib/auth-providers";
import { AuthForm } from "./auth-form";
import { AuthFormSkeleton } from "./auth-form-view";
import { AuthShell } from "./auth-shell";

export async function AuthPage({ mode }: { mode: AuthMode }) {
  // Availability must reflect the server's runtime configuration, not a build snapshot.
  await connection();
  const availability = getOAuthAvailability();
  return (
    <AuthShell mode={mode}>
      <Suspense fallback={<AuthFormSkeleton mode={mode} />}>
        <AuthForm mode={mode} availability={availability} />
      </Suspense>
    </AuthShell>
  );
}
