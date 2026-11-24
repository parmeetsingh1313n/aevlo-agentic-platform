import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Aevlo workspace with Google or GitHub.",
};

export default function SignInPage() {
  return <AuthPage mode="sign-in" />;
}
