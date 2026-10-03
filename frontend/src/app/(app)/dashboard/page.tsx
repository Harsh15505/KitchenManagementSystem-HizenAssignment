'use client';

import type { SubjectName } from '@fernleaf/shared';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAbility, useAuth } from '@/lib/auth';

/**
 * Every role lands here (FR-DSH-01). The page is composed of the sections the user's abilities
 * allow, so a new role with a mix of permissions gets a matching dashboard with no code change.
 * Figures arrive in P9 (definitions: PRD §8).
 */
const SECTIONS: ReadonlyArray<{ subject: SubjectName; title: string; question: string }> = [
  {
    subject: 'AdminDashboard',
    title: 'Operations overview',
    question: 'Is today on track, what needs me, are we getting paid?',
  },
  {
    subject: 'KitchenDashboard',
    title: 'Kitchen',
    question: 'What do I cook, by when, where are we behind?',
  },
  {
    subject: 'DispatchDashboard',
    title: 'Dispatch',
    question: 'What leaves next, who drives it, what is late?',
  },
  { subject: 'DriverDashboard', title: 'My deliveries today', question: 'Where do I go next?' },
];

export default function DashboardPage() {
  const { me } = useAuth();
  const ability = useAbility();
  const sections = SECTIONS.filter((s) => ability.can('read', s.subject));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {me.user.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-muted-foreground">Signed in as {me.role.name}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.subject}>
            <CardHeader>
              <CardTitle>{s.title}</CardTitle>
              <CardDescription>{s.question}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
