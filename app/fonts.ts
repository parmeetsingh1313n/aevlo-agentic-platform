import localFont from "next/font/local";

export const manrope = localFont({
  src: "../fonts/Manrope.ttf",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-manrope",
});

export const bricolage = localFont({
  src: "../fonts/BricolageGrotesque.ttf",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-bricolage",
});

export const ibmPlexMono = localFont({
  src: [
    { path: "../fonts/IBMPlexMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/IBMPlexMono-Medium.ttf", weight: "500", style: "normal" },
  ],
  display: "swap",
  variable: "--font-ibm-plex-mono",
  fallback: ["monospace"],
  adjustFontFallback: false,
  preload: false,
});

// The supplied italic file contains HTML. Its native face is intentionally deferred.
