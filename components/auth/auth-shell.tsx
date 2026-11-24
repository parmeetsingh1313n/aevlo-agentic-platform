// Split composition adapted from Login 3 by Mohammad Shehadeh (MIT).
// https://github.com/MohammadShehadeh/hirael — original Aevlo visuals and copy.
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, CircleCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AuthMode } from "@/lib/auth-ui";
import { RoutinePreview } from "./routine-preview";
import { authStyles as styles } from "./auth-styles";

export function AuthShell({ mode, children }: { mode: AuthMode | "home"; children: ReactNode }) {
  return (
    <div className={styles.shell} data-mode={mode}>
      <a href="#auth-content" className={styles.skipLink}>Skip to main content</a>
      <div className={styles.frame}>
        <aside className={styles.storyPane} aria-label="About Aevlo">
          <Brand />
          <div className={styles.storyContent}>
            <div className={styles.storyCopy}>
              <h2 className={styles.storyHeading}>A little less busy.<br />A lot more done.</h2>
              <p className={styles.storyDescription}>Give your recurring work a routine.<br /> Keep your attention for everything else.</p>
            </div>
            <RoutinePreview enhancedMotion={mode !== "home"} />
          </div>
          <p className={styles.storyFooter}>
            <CircleCheck size={17} strokeWidth={1.5} aria-hidden="true" />
            Set it once. Stay in the loop.
          </p>
        </aside>

        <main id="auth-content" className={styles.authPane} tabIndex={-1}>
          <nav className={styles.paneTop} aria-label="Page navigation">
            <Brand className={styles.mobileBrand} />
            <div className={styles.topActions}>
              <ThemeToggle />
              {mode === "home" ? (
                <Link href="/sign-in" className={styles.backLink}>Sign in <ArrowUpRight size={15} aria-hidden="true" /></Link>
              ) : (
                <Link href="/" className={styles.backLink}><ArrowLeft size={15} aria-hidden="true" /> Back home</Link>
              )}
            </div>
          </nav>
          <div className={styles.formPosition}>{children}</div>
          <footer className={styles.paneFooter}>
            <span>Less managing. More making.</span>
            <span>Aevlo © 2026</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
