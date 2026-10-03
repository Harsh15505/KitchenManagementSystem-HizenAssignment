import { ChefHat, Leaf, LockKeyhole, Truck } from 'lucide-react';
import { Suspense } from 'react';
import { SystemStatus } from '@/components/system-status';
import { ThemeToggle } from '@/components/theme-toggle';
import { LoginForm } from './login-form';

const HIGHLIGHTS = [
  {
    icon: LockKeyhole,
    title: 'Cut-off aware ordering',
    text: 'Orders lock on kitchen working days, IST.',
  },
  {
    icon: ChefHat,
    title: 'Kitchen board by station',
    text: 'Every combination is a prep unit, on time.',
  },
  {
    icon: Truck,
    title: 'Dispatch, drivers, billing',
    text: 'From the pass to the invoice, one system.',
  },
];

export default function LoginPage() {
  return (
    <main className="grid min-h-svh flex-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 size-[28rem] rounded-full bg-sidebar-primary/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-emerald-400/10 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Leaf className="size-5" aria-hidden />
          </span>
          <span className="font-heading text-2xl font-semibold text-sidebar-accent-foreground">
            Fernleaf Kitchen
          </span>
        </div>
        <div className="relative max-w-md space-y-8">
          <h1 className="font-heading text-4xl leading-tight font-semibold text-sidebar-accent-foreground">
            Boxed meals for busy offices, cooked and delivered on time.
          </h1>
          <ul className="space-y-5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-primary">
                  <h.icon className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block font-medium text-sidebar-accent-foreground">
                    {h.title}
                  </span>
                  <span className="block text-sm text-sidebar-foreground/75">{h.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-sidebar-foreground/60">
          Internal operations panel · Kitchen time Asia/Kolkata
        </p>
      </section>

      {/* Sign-in */}
      <section className="relative flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 lg:hidden">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Leaf className="size-4" aria-hidden />
              </span>
              <span className="font-heading text-lg font-semibold">Fernleaf Kitchen</span>
            </div>
            <h2 className="font-heading text-3xl font-semibold">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in with your staff account.</p>
          </div>
          {/* useSearchParams (for ?next=) needs a Suspense boundary in the App Router. */}
          <Suspense>
            <LoginForm />
          </Suspense>
          <SystemStatus />
        </div>
      </section>
    </main>
  );
}
