'use client';

import type { Action, SubjectName } from '@fernleaf/shared';
import { ShieldX } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAbility } from '@/lib/auth';

/**
 * Page-level gate: shows a 403 notice instead of the page. Cosmetic only; the API refuses the
 * data anyway (FR-ACC-03).
 */
export function RequireAbility({
  action,
  subject,
  children,
}: {
  action: Action;
  subject: SubjectName;
  children: ReactNode;
}) {
  const ability = useAbility();
  if (ability.can(action, subject)) return <>{children}</>;
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <ShieldX className="size-8 text-muted-foreground" aria-hidden />
      <h1 className="text-lg font-semibold">You don&apos;t have access to this page</h1>
      <p className="text-sm text-muted-foreground">Ask an admin if you need it for your work.</p>
    </div>
  );
}
