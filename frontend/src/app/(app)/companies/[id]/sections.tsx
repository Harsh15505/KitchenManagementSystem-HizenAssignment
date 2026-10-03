'use client';

import { type CompanyAddressDto, type CompanyDetail, addressInputSchema } from '@fernleaf/shared';
import { X } from 'lucide-react';
import { useState } from 'react';
import { HolidayConflicts, useOpenOrdersOn } from '@/components/holiday-conflicts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAbility } from '@/lib/auth';
import { useCompanyAction } from './use-company';

/** BR-CMP-01: employees' emails must be on one of these. */
export function DomainsCard({ company }: { company: CompanyDetail }) {
  const canManage = useAbility().can('manage', 'Company');
  const act = useCompanyAction(company.id);
  const [domain, setDomain] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email domains</CardTitle>
        <CardDescription>
          Employee emails must use one of these. Public providers are refused.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="flex flex-wrap gap-2">
          {company.domains.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
            >
              @{d.domain}
              {canManage && company.domains.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove ${d.domain}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    void act(`/domains/${d.id}`, 'DELETE', undefined, 'Domain removed')
                  }
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {canManage && (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const result = await act('/domains', 'POST', { domain }, 'Domain added');
              if (result.ok) setDomain('');
            }}
          >
            <Input
              aria-label="New domain"
              placeholder="another-domain.example"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!domain.trim()}>
              Add
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/** FR-CMP-02: dated company holidays (deliveries can't land on them; cut-off is unaffected). */
export function HolidaysCard({ company }: { company: CompanyDetail }) {
  const canManage = useAbility().can('manage', 'Company');
  const act = useCompanyAction(company.id);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  // FR-CMP-05: after adding, keep the warning for that date until dismissed.
  const [reviewDate, setReviewDate] = useState('');
  const checkDate = date || reviewDate;
  const conflicts = useOpenOrdersOn(checkDate, company.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company holidays</CardTitle>
        <CardDescription>
          No deliveries on these dates. The kitchen cut-off is not affected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {company.holidays.length === 0 && (
          <p className="text-sm text-muted-foreground">No holidays set.</p>
        )}
        <ul className="space-y-1.5">
          {company.holidays.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
            >
              <span>
                <span className="font-mono">{h.date}</span> · {h.name}
              </span>
              {canManage && (
                <button
                  type="button"
                  aria-label={`Remove ${h.name}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    void act(`/holidays/${h.id}`, 'DELETE', undefined, 'Holiday removed')
                  }
                >
                  <X className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {canManage && (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const result = await act('/holidays', 'POST', { date, name }, 'Holiday added');
              if (result.ok) {
                setReviewDate(conflicts.data?.total ? date : '');
                setDate('');
                setName('');
              }
            }}
          >
            <Input
              aria-label="Holiday date"
              type="date"
              className="w-40"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Input
              aria-label="Holiday name"
              className="flex-1"
              placeholder="Diwali"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!date || !name.trim()}>
              {date && conflicts.data?.total ? 'Add anyway' : 'Add'}
            </Button>
          </form>
        )}
        {canManage && checkDate && (
          <HolidayConflicts
            data={conflicts.data}
            companyId={company.id}
            added={!date}
            onDismiss={() => setReviewDate('')}
          />
        )}
      </CardContent>
    </Card>
  );
}

const EMPTY_ADDRESS = {
  label: '',
  line1: '',
  line2: '',
  city: '',
  postalCode: '',
  accessNotes: '',
};
type AddressForm = typeof EMPTY_ADDRESS;

/** FR-CMP-01: delivery addresses; exactly one default; archived, never deleted. */
export function AddressesCard({ company }: { company: CompanyDetail }) {
  const canManage = useAbility().can('manage', 'Company');
  const act = useCompanyAction(company.id);
  const [editing, setEditing] = useState<CompanyAddressDto | 'new' | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Delivery addresses</CardTitle>
          <CardDescription>
            Orders go to the default unless the employee may choose.
          </CardDescription>
        </div>
        {canManage && editing === null && (
          <Button size="sm" onClick={() => setEditing('new')}>
            Add address
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {editing === 'new' && (
          <AddressEditor
            initial={EMPTY_ADDRESS}
            onCancel={() => setEditing(null)}
            onSave={async (form) => {
              const r = await act('/addresses', 'POST', form, 'Address added');
              if (r.ok) setEditing(null);
            }}
          />
        )}
        {company.addresses.map((a) =>
          editing !== 'new' && editing?.id === a.id ? (
            <AddressEditor
              key={a.id}
              initial={a}
              onCancel={() => setEditing(null)}
              onSave={async (form) => {
                const r = await act(`/addresses/${a.id}`, 'PATCH', form, 'Address saved');
                if (r.ok) setEditing(null);
              }}
            />
          ) : (
            <div
              key={a.id}
              className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3 ${a.isActive ? '' : 'opacity-60'}`}
            >
              <div className="text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {a.label}
                  {a.isDefault && <Badge>Default</Badge>}
                  {!a.isActive && <Badge variant="secondary">Archived</Badge>}
                </div>
                <p className="text-muted-foreground">
                  {[a.line1, a.line2, `${a.city} ${a.postalCode}`].filter(Boolean).join(', ')}
                </p>
                {a.accessNotes && <p className="text-xs text-muted-foreground">{a.accessNotes}</p>}
              </div>
              {canManage && (
                <div className="flex gap-1">
                  {!a.isDefault && a.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void act(
                          `/default-address/${a.id}`,
                          'PUT',
                          undefined,
                          `${a.label} is now the default`,
                        )
                      }
                    >
                      Make default
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
                    Edit
                  </Button>
                  {!a.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void act(
                          `/addresses/${a.id}`,
                          'PATCH',
                          { isActive: !a.isActive },
                          a.isActive ? 'Address archived' : 'Address restored',
                        )
                      }
                    >
                      {a.isActive ? 'Archive' : 'Restore'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ),
        )}
      </CardContent>
    </Card>
  );
}

function AddressEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: AddressForm;
  onSave: (form: AddressForm) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AddressForm>({
    label: initial.label,
    line1: initial.line1,
    line2: initial.line2,
    city: initial.city,
    postalCode: initial.postalCode,
    accessNotes: initial.accessNotes,
  });
  const [error, setError] = useState<string | null>(null);
  const fields: ReadonlyArray<[keyof AddressForm, string]> = [
    ['label', 'Label'],
    ['line1', 'Street address'],
    ['line2', 'Floor, building (optional)'],
    ['city', 'City'],
    ['postalCode', 'Postal code'],
    ['accessNotes', 'Access notes (optional)'],
  ];
  return (
    <form
      noValidate
      className="space-y-3 rounded-lg border bg-muted/30 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = addressInputSchema.safeParse(form);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? 'Check the address');
          return;
        }
        setError(null);
        await onSave(parsed.data);
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map(([key, label]) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`ad-${key}`}>{label}</Label>
            <Input
              id={`ad-${key}`}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit">Save address</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
