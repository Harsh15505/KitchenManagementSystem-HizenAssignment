'use client';

import type { SubjectName } from '@fernleaf/shared';
import { type ReactNode, useState } from 'react';
import { useAbility, useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { AdminSection } from './admin-section';
import { DispatchSection, DriverSection, KitchenSection } from './role-sections';

/**
 * Every role lands here (FR-DSH-01). The page is composed of the sections the user's abilities
 * allow, so a new role with a mix of permissions gets a matching dashboard with no code change.
 * Definitions: PRD §8.
 */
const SECTIONS: ReadonlyArray<{
  subject: SubjectName;
  title: string;
  question: string;
  render: () => ReactNode;
}> = [
  {
    subject: 'AdminDashboard',
    title: 'Operations',
    question: 'Is today on track, what needs me, are we getting paid?',
    render: () => <AdminSection />,
  },
  {
    subject: 'KitchenDashboard',
    title: 'Kitchen',
    question: 'What do I cook, by when, where are we behind?',
    render: () => <KitchenSection />,
  },
  {
    subject: 'DispatchDashboard',
    title: 'Dispatch',
    question: 'What leaves next, who drives it, what is late?',
    render: () => <DispatchSection />,
  },
  {
    subject: 'DriverDashboard',
    title: 'My deliveries',
    question: 'Where do I go next?',
    render: () => <DriverSection />,
  },
];

export default function DashboardPage() {
  const { me } = useAuth();
  const ability = useAbility();
  const sections = SECTIONS.filter((s) => ability.can('read', s.subject));
  const [active, setActive] = useState(0);
  const current = sections[Math.min(active, sections.length - 1)];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Good to see you, {me.user.name.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground">
          {current ? current.question : `Signed in as ${me.role.name}`}
        </p>
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
      {current ? (
        current.render()
      ) : (
        <p className="text-sm text-muted-foreground">No dashboard for your role.</p>
      )}
    </div>
  );
}
