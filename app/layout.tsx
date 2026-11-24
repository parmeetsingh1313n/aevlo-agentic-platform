import { AuthProvider } from "@/components/session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { brand } from "@/lib/brand";
import "./globals.css";
import type { Metadata } from "next";
import { bricolage, ibmPlexMono, manrope } from "./fonts";

export const metadata: Metadata = {
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${bricolage.variable} ${ibmPlexMono.variable}`}>
      <body>
        <ThemeProvider><AuthProvider>{children}</AuthProvider></ThemeProvider>
      </body>
    </html>
  );
}
