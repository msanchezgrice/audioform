import Link from "next/link";
import styles from "./auth-page.module.css";

export const authAppearance = {
  elements: {
    rootBox: styles.clerkRoot,
    cardBox: styles.clerkCardBox,
    card: styles.clerkCard,
  },
};

export function AuthPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <section className={styles.cardArea}>{children}</section>
    </main>
  );
}

export function AuthFallback({ children }: { children: React.ReactNode }) {
  return <div className={styles.fallback}>{children}</div>;
}

export function AuthMachineNote() {
  return (
    <p className={styles.machineNote}>
      Building with an agent? <Link href="/docs/getting-started">Start without a human account.</Link>
    </p>
  );
}
