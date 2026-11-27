import type { AuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { saveOAuthUser } from "@/db/users";

export const authOptions: AuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "placeholder-id",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "placeholder-secret",
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "placeholder-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder-secret",
    }),
  ],
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
    newUser: "/sign-up",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.trim();
      if (!email) return "/sign-in?error=OAuthEmailMissing";

      try {
        await saveOAuthUser({ email, name: user.name });
        return true;
      } catch {
        // Never expose database credentials or provider data in redirects/logs.
        console.error("[auth] Could not save the OAuth user to the database.");
        return "/sign-in?error=AccountPersistence";
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "default-development-secret-change-in-env",
};
