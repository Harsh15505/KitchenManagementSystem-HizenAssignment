'use client';

import { Clock, Leaf, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { KitchenClock } from '@/components/kitchen-clock';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ApiError } from '@/lib/api-client';
import { AuthProvider, useAuth, useMeQuery } from '@/lib/auth';
import { visibleSections } from '@/lib/nav';
import { cn } from '@/lib/utils';

/** Loads the session, then renders the permission-driven shell. 401 → back to sign-in. */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const meQuery = useMeQuery();

  useEffect(() => {
    if (meQuery.error instanceof ApiError && meQuery.error.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [meQuery.error, pathname, router]);

  if (!meQuery.data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        {meQuery.isError && !(meQuery.error instanceof ApiError && meQuery.error.status === 401) ? (
          <p className="text-sm text-destructive">Could not load your session. Refresh to retry.</p>
        ) : (
          <>
            <span className="flex size-12 animate-pulse items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Leaf className="size-6" aria-hidden />
            </span>
            <span className="text-sm text-muted-foreground">Opening the kitchen…</span>
          </>
        )}
      </div>
    );
  }

  return (
    <AuthProvider me={meQuery.data}>
      <Frame>{children}</Frame>
    </AuthProvider>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function Frame({ children }: { children: ReactNode }) {
  const { me, ability, logout } = useAuth();
  const pathname = usePathname();
  const sections = visibleSections(ability);
  // The most specific match wins, so /menu/preview lights "Menu preview", not "Menu" as well.
  const activeHref = sections
    .flatMap((s) => s.items)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="flex min-h-svh flex-1 flex-col md:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-svh md:w-60 md:shrink-0 md:flex-col">
        <Link href="/dashboard" className="flex h-16 items-center gap-2.5 px-5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Leaf className="size-4.5" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block font-heading text-lg font-semibold text-sidebar-accent-foreground">
              Fernleaf
            </span>
            <span className="block text-[11px] tracking-wide text-sidebar-foreground/70 uppercase">
              Kitchen Ops
            </span>
          </span>
        </Link>
        <nav className="nav-scroll flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:gap-4 md:overflow-y-auto md:pb-6">
          {sections.map((section) => (
            <div key={section.title} className="flex gap-1 md:flex-col md:gap-0.5">
              <div className="hidden px-3 pb-1 text-[11px] font-medium tracking-wider text-sidebar-foreground/55 uppercase md:block">
                {section.title}
              </div>
              {section.items.map((item) => {
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors',
                      active
                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                    )}
                  >
                    {active && (
                      <span className="absolute inset-y-1.5 left-0 hidden w-1 rounded-full bg-sidebar-primary md:block" />
                    )}
                    <item.icon
                      className={cn('size-4', active ? 'text-sidebar-primary' : 'opacity-80')}
                      aria-hidden
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="hidden border-t border-sidebar-border px-5 py-3 text-xs text-sidebar-foreground/60 md:block">
          Kitchen time · Asia/Kolkata
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/85 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" aria-hidden />
            <KitchenClock />
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(buttonVariants({ variant: 'ghost' }), 'h-10 gap-2.5 px-2')}
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials(me.user.name)}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-medium">{me.user.name}</span>
                  <span className="block text-xs text-muted-foreground">{me.role.name}</span>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Base UI requires a group label to sit inside a Menu.Group. */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{me.user.email}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void logout()}>
                  <LogOut className="size-4" aria-hidden />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main
          key={pathname}
          className="animate-rise mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
