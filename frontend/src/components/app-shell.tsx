'use client';

import { ChefHat, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { KitchenClock } from '@/components/kitchen-clock';
import { Skeleton } from '@/components/ui/skeleton';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ApiError } from '@/lib/api-client';
import { AuthProvider, useAuth, useMeQuery } from '@/lib/auth';
import { visibleNav } from '@/lib/nav';
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
      <div className="flex flex-1 items-center justify-center p-8">
        {meQuery.isError && !(meQuery.error instanceof ApiError && meQuery.error.status === 401) ? (
          <p className="text-sm text-destructive">Could not load your session. Refresh to retry.</p>
        ) : (
          <Skeleton className="h-8 w-48" />
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

function Frame({ children }: { children: ReactNode }) {
  const { me, ability, logout } = useAuth();
  const pathname = usePathname();
  const items = visibleNav(ability);

  return (
    <div className="flex min-h-svh flex-1 flex-col md:flex-row">
      <aside className="border-b bg-muted/30 md:w-56 md:border-b-0 md:border-r">
        <div className="flex h-14 items-center gap-2 px-4 font-semibold">
          <ChefHat className="size-5" aria-hidden />
          Fernleaf Kitchen
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap',
                  active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b px-4">
          <KitchenClock />
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              {me.user.name}
              <span className="text-muted-foreground">· {me.role.name}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{me.user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void logout()}>
                <LogOut className="size-4" aria-hidden />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
