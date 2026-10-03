'use client';

import { RequireAbility } from '@/components/require-ability';
import { DemoDataCard } from './demo-data-card';
import { HolidaysCard } from './holidays-card';
import { PlatformSettingsForm } from './platform-settings-form';
import { PublicDomainsCard } from './public-domains-card';

/** FR-SET-01/02: everything staff need to change without editing code or the database. */
export default function SettingsPage() {
  return (
    <RequireAbility action="read" subject="Settings">
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Kitchen calendar, cut-off and platform timings. Changes apply immediately.
          </p>
        </div>
        <PlatformSettingsForm />
        <div className="grid gap-6 lg:grid-cols-2">
          <HolidaysCard />
          <PublicDomainsCard />
        </div>
        <DemoDataCard />
      </div>
    </RequireAbility>
  );
}
