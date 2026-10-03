import { AppShell } from '@/components/app-shell';

/** Every signed-in page shares the permission-driven shell. */
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return <AppShell>{children}</AppShell>;
}
