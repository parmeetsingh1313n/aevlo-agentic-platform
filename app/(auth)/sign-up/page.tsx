import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create your Aevlo account using Google or GitHub. No new password to remember.",
};

export default function SignUpPage() {
  return <AuthPage mode="sign-up" />;
}
