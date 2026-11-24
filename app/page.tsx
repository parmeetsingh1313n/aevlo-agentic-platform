import Link from "next/link";
import { ArrowUpRight, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { BrandMark } from "@/components/brand";
import { authStyles as styles } from "@/components/auth/auth-styles";

export default function Home() {
  return (
    <AuthShell mode="home">
      <div className={`${styles.formBody} ${styles.entryBody}`}>
        <div className={styles.entryMark}><BrandMark /></div>
        <header className={styles.formHeader}>
          <h1 className={styles.entryHeading}>Make room for<br />your real work.</h1>
          <p className={styles.formDescription}>A home for your AI agents and everyday routines. Less repeat work. More of what matters.</p>
        </header>
        <div className={styles.entryActions}>
          <Link href="/sign-up" className={styles.primaryLink}>Create an account <ArrowUpRight size={18} aria-hidden="true" /></Link>
          <Link href="/sign-in" className={styles.secondaryLink}>I already have an account</Link>
        </div>
        <p className={styles.passwordNote}><KeyRound size={14} aria-hidden="true" /> Get started with Google or GitHub.</p>
        <p className={styles.privacyNote}>Aevlo is taking shape. This is an early preview.</p>
      </div>
    </AuthShell>
  );
}
