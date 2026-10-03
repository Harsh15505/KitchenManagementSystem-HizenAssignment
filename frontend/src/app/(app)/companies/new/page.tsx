'use client';

import { type CompanyDetail, createCompanySchema, type FieldErrors } from '@fernleaf/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { RequireAbility } from '@/components/require-ability';
import { Button } from '@/components/ui/button';
import { StepTitle } from '@/components/step-title';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api-client';
import { CompanyFields, companyFieldsBody, companyFieldsFrom } from '../company-fields';

export default function NewCompanyPage() {
  return (
    <RequireAbility action="manage" subject="Company">
      <NewCompanyForm />
    </RequireAbility>
  );
}

/** A-29: the company is created with its owner, first domain and default address together. */
function NewCompanyForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [fields, setFields] = useState(companyFieldsFrom());
  const [domain, setDomain] = useState('');
  const [owner, setOwner] = useState({ name: '', email: '', phone: '' });
  const [address, setAddress] = useState({
    label: 'Head office',
    line1: '',
    line2: '',
    city: '',
    postalCode: '',
    accessNotes: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createCompanySchema.safeParse({
      ...companyFieldsBody(fields),
      domain,
      address,
      owner: { ...owner, phone: owner.phone.trim() || null },
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues)
        (next[issue.path.join('.')] ??= []).push(issue.message);
      setErrors(next);
      toast.error('Check the highlighted fields');
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const created = await api<CompanyDetail>('/companies', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      toast.success(`${created.name} created`);
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
      router.replace(`/companies/${created.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors ?? {});
        toast.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  }

  const err = (key: string) =>
    errors[key] ? <p className="text-sm text-destructive">{errors[key]?.[0]}</p> : null;

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/companies"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> Companies
      </Link>
      <form onSubmit={submit} noValidate className="space-y-6">
        <Card>
          <CardHeader>
            <StepTitle n={1}>Company</StepTitle>
            <CardDescription>
              Name, price tier, billing contact and delivery calendar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset disabled={saving}>
              <CompanyFields value={fields} onChange={setFields} errors={errors} />
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <StepTitle n={2}>Email domain and owner</StepTitle>
            <CardDescription>
              Employees sign up with this domain. The owner is the company&apos;s main contact.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset disabled={saving} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="co-domain">Email domain (more can be added later)</Label>
                <Input
                  id="co-domain"
                  placeholder="acme.example"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
                {err('domain')}
              </div>
              <div />
              <div className="space-y-1.5">
                <Label htmlFor="ow-name">Owner name</Label>
                <Input
                  id="ow-name"
                  value={owner.name}
                  onChange={(e) => setOwner({ ...owner, name: e.target.value })}
                />
                {err('owner.name')}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ow-email">Owner email (on the domain above)</Label>
                <Input
                  id="ow-email"
                  type="email"
                  value={owner.email}
                  onChange={(e) => setOwner({ ...owner, email: e.target.value })}
                />
                {err('owner.email')}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ow-phone">Owner phone (optional)</Label>
                <Input
                  id="ow-phone"
                  value={owner.phone}
                  onChange={(e) => setOwner({ ...owner, phone: e.target.value })}
                />
                {err('owner.phone')}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <StepTitle n={3}>Default delivery address</StepTitle>
            <CardDescription>Orders go here unless an employee may choose another.</CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset disabled={saving} className="grid gap-4 md:grid-cols-2">
              {(
                [
                  ['label', 'Label'],
                  ['line1', 'Street address'],
                  ['line2', 'Floor, building (optional)'],
                  ['city', 'City'],
                  ['postalCode', 'Postal code'],
                  ['accessNotes', 'Access notes (optional)'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`addr-${key}`}>{label}</Label>
                  <Input
                    id={`addr-${key}`}
                    value={address[key]}
                    onChange={(e) => setAddress({ ...address, [key]: e.target.value })}
                  />
                  {err(`address.${key}`)}
                </div>
              ))}
            </fieldset>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" disabled={saving}>
          {saving ? 'Creating…' : 'Create company'}
        </Button>
      </form>
    </div>
  );
}
