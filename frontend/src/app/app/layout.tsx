import { AppShell } from "@/components/veil/shell";

/** Authenticated shell: navigation rail + page transitions for /app/*. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
