'use client';

import type { SubjectName } from '@fernleaf/shared';
import { type ReactNode, useState } from 'react';
import { useAbility } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { AdminSection } from './admin-section';
import { DispatchSection, DriverSection, KitchenSection } from './role-sections';
import { ToolbarSlotContext } from './toolbar';

/**
 * Every role lands here (FR-DSH-01). The page is composed of the sections the user's abilities
 * allow, so a new role with a mix of permissions gets a matching dashboard with no code change.
 * Definitions: PRD §8.
 */
const SECTIONS: ReadonlyArray<{
  subject: SubjectName;
  title: string;
  render: () => ReactNode;
}> = [
  {
    subject: 'AdminDashboard',
    title: 'Operations',
    render: () => <AdminSection />,
  },
  {
    subject: 'KitchenDashboard',
    title: 'Kitchen',
    render: () => <KitchenSection />,
  },
  {
    subject: 'DispatchDashboard',
    title: 'Dispatch',
    render: () => <DispatchSection />,
  },
  {
    subject: 'DriverDashboard',
    title: 'My deliveries',
    render: () => <DriverSection />,
  },
];

export default function DashboardPage() {
  const ability = useAbility();
  const sections = SECTIONS.filter((s) => ability.can('read', s.subject));
  const [active, setActive] = useState(0);
  // The section's own controls render into this slot, on the title row (see toolbar.tsx).
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const current = sections[Math.min(active, sections.length - 1)];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="page-title">Dashboard</h1>
        <div ref={setSlot} className="flex flex-wrap items-center gap-2" />
      </div>
      {sections.length > 1 && (
        <div role="tablist" aria-label="Dashboard" className="flex flex-wrap gap-1 border-b">
          {sections.map((s, i) => (
            <button
              key={s.subject}
              type="button"
              role="tab"
              aria-selected={current === s}
              onClick={() => setActive(i)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm',
                current === s
                  ? 'border-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}
      <ToolbarSlotContext.Provider value={slot}>
        {current ? (
          current.render()
        ) : (
          <p className="text-sm text-muted-foreground">No dashboard for your role.</p>
        )}
      </ToolbarSlotContext.Provider>
    </div>
  );
}
