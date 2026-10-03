'use client';

import { type CompanyDetail, type FieldErrors, updateCompanySchema } from '@fernleaf/shared';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { RequireAbility } from '@/components/require-ability';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { describeDays } from '@/components/weekday-picker';
import { useAbility } from '@/lib/auth';
import { CompanyFields, companyFieldsBody, companyFieldsFrom } from '../company-fields';
import { AddressesCard, DomainsCard, HolidaysCard } from './sections';
import { EmployeesCard } from './employees-card';
import { MenuVisibilityCard } from './menu-visibility-card';
import { useCompany, useCompanyAction } from './use-company';

export default function CompanyPage() {
  const { id } = useParams<{ id: string }>();
  const company = useCompany(id);
  return (
    <RequireAbility action="read" subject="Company">
      <div className="max-w-5xl space-y-6">
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Companies
        </Link>
        {company.data ? <CompanyView company={company.data} /> : <Skeleton className="h-96" />}
      </div>
    </RequireAbility>
  );
}

function CompanyView({ company }: { company: CompanyDetail }) {
  const ability = useAbility();
  const act = useCompanyAction(company.id);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 page-title">
            {company.name}
            {!company.isActive && <Badge variant="secondary">Inactive</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {company.effectiveTier.name} tier{company.priceTier ? '' : ' (default)'} · delivers{' '}
            {describeDays(company.workingDays)} · owner {company.owner?.name ?? '-'} ·{' '}
            {company.employeeCount} employees
          </p>
        </div>
        {ability.can('manage', 'Company') && (
          <Button
            variant="outline"
            onClick={() =>
              void act(
                '',
                'PATCH',
                { isActive: !company.isActive },
                company.isActive ? 'Company deactivated' : 'Company reactivated',
              )
            }
          >
            {company.isActive ? 'Deactivate company' : 'Reactivate company'}
          </Button>
        )}
      </div>
      <SettingsCard key={company.id + company.name} company={company} />
      <div className="grid gap-6 lg:grid-cols-2">
        <DomainsCard company={company} />
        <HolidaysCard company={company} />
      </div>
      <AddressesCard company={company} />
      {ability.can('read', 'Menu') && <MenuVisibilityCard company={company} />}
      {ability.can('read', 'Employee') && <EmployeesCard company={company} />}
    </>
  );
}

function SettingsCard({ company }: { company: CompanyDetail }) {
  const canManage = useAbility().can('manage', 'Company');
  const act = useCompanyAction(company.id);
  const [fields, setFields] = useState(() => companyFieldsFrom(company));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = updateCompanySchema.safeParse(companyFieldsBody(fields));
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues)
        (next[issue.path.join('.')] ??= []).push(issue.message);
      setErrors(next);
      return;
    }
    setSaving(true);
    const result = await act('', 'PATCH', parsed.data, 'Company saved');
    setErrors(result.ok ? {} : (result.error?.fieldErrors ?? {}));
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} noValidate>
          <fieldset disabled={!canManage || saving}>
            <CompanyFields value={fields} onChange={setFields} errors={errors} />
          </fieldset>
          {canManage && (
            <Button type="submit" className="mt-6" disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
