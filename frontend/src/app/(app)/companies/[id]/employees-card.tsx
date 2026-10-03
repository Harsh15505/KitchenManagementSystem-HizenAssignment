'use client';

import {
  type CompanyDetail,
  type CompanyListItem,
  createEmployeeSchema,
  type EmployeeDto,
  type FieldErrors,
  moveEmployeeSchema,
  type Paginated,
  updateEmployeeSchema,
} from '@fernleaf/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ChipSelect } from '@/components/chip-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError, api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { nameLookup, useReferenceList } from '@/lib/reference';
import { companyKey } from './use-company';

type Mode =
  | { kind: 'new' }
  | { kind: 'edit'; employee: EmployeeDto }
  | { kind: 'move'; employee: EmployeeDto };

/** FR-EMP-01/02: this company's employees, their flags and dietary needs, moves and ownership. */
export function EmployeesCard({ company }: { company: CompanyDetail }) {
  const ability = useAbility();
  const canManage = ability.can('manage', 'Employee');
  const canManageCompany = ability.can('manage', 'Company');
  const queryClient = useQueryClient();
  const allergens = useReferenceList('allergens');
  const tags = useReferenceList('dietary-tags');
  const allergenName = nameLookup(allergens.data);
  const tagName = nameLookup(tags.data);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode | null>(null);

  const params = new URLSearchParams({ companyId: company.id, page: String(page), pageSize: '25' });
  if (q) params.set('q', q);
  const employees = useQuery({
    queryKey: ['employees', params.toString()],
    queryFn: () => api<Paginated<EmployeeDto>>(`/employees?${params}`),
    placeholderData: keepPreviousData,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['employees'] });
    void queryClient.invalidateQueries({ queryKey: companyKey(company.id) });
    setMode(null);
  };

  async function makeOwner(employee: EmployeeDto) {
    try {
      await api(`/employees/${employee.id}/make-owner`, { method: 'POST' });
      toast.success(`${employee.name} now owns ${company.name}`);
      refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not transfer ownership');
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Employees</CardTitle>
          <CardDescription>
            Emails must be on {company.domains.map((d) => `@${d.domain}`).join(' or ')}.
          </CardDescription>
        </div>
        {canManage && mode === null && (
          <Button size="sm" onClick={() => setMode({ kind: 'new' })}>
            Add employee
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {mode?.kind === 'new' && (
          <EmployeeForm company={company} onDone={refresh} onCancel={() => setMode(null)} />
        )}
        {mode?.kind === 'edit' && (
          <EmployeeForm
            key={mode.employee.id}
            company={company}
            employee={mode.employee}
            onDone={refresh}
            onCancel={() => setMode(null)}
          />
        )}
        {mode?.kind === 'move' && (
          <MoveForm employee={mode.employee} onDone={refresh} onCancel={() => setMode(null)} />
        )}
        <Input
          className="max-w-xs"
          placeholder="Search name or email"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>May change</TableHead>
              <TableHead>Allergies</TableHead>
              <TableHead>Preferences</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.data?.items.map((e) => (
              <TableRow key={e.id} className={e.isActive ? undefined : 'opacity-60'}>
                <TableCell>
                  <div className="font-medium">
                    {e.name} {e.isOwner && <Badge className="ml-1">Owner</Badge>}
                    {!e.isActive && (
                      <Badge variant="secondary" className="ml-1">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{e.email}</div>
                </TableCell>
                <TableCell className="text-xs">
                  {[
                    e.canChooseAddress && 'address',
                    e.canChangeDeliveryTime && 'time',
                    e.canChangePackaging && 'packaging',
                  ]
                    .filter(Boolean)
                    .join(', ') || <span className="text-muted-foreground">nothing</span>}
                </TableCell>
                <TableCell className="space-x-1">
                  {e.allergenIds.map((id) => (
                    <Badge key={id} variant="destructive">
                      {allergenName.get(id) ?? 'Allergen'}
                    </Badge>
                  ))}
                </TableCell>
                <TableCell className="space-x-1">
                  {e.dietaryTagIds.map((id) => (
                    <Badge key={id} variant="outline">
                      {tagName.get(id) ?? 'Tag'}
                    </Badge>
                  ))}
                </TableCell>
                <TableCell className="space-x-1 text-right whitespace-nowrap">
                  {canManage && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMode({ kind: 'edit', employee: e })}
                      >
                        Edit
                      </Button>
                      {!e.isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMode({ kind: 'move', employee: e })}
                        >
                          Move
                        </Button>
                      )}
                    </>
                  )}
                  {canManageCompany && !e.isOwner && e.isActive && (
                    <Button variant="ghost" size="sm" onClick={() => void makeOwner(e)}>
                      Make owner
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {employees.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No employees match.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {employees.data && employees.data.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <span className="text-muted-foreground">
              Page {employees.data.page} of {employees.data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= employees.data.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmployeeForm({
  company,
  employee,
  onDone,
  onCancel,
}: {
  company: CompanyDetail;
  employee?: EmployeeDto;
  onDone: () => void;
  onCancel: () => void;
}) {
  const allergens = useReferenceList('allergens');
  const tags = useReferenceList('dietary-tags');
  const [form, setForm] = useState({
    name: employee?.name ?? '',
    email: employee?.email ?? (company.domains[0] ? `@${company.domains[0].domain}` : ''),
    phone: employee?.phone ?? '',
    canChooseAddress: employee?.canChooseAddress ?? false,
    canChangeDeliveryTime: employee?.canChangeDeliveryTime ?? false,
    canChangePackaging: employee?.canChangePackaging ?? false,
    allergenIds: employee?.allergenIds ?? [],
    dietaryTagIds: employee?.dietaryTagIds ?? [],
    isActive: employee?.isActive ?? true,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form, phone: form.phone.trim() || null };
    const parsed = employee
      ? updateEmployeeSchema.safeParse(body)
      : createEmployeeSchema.safeParse({ ...body, companyId: company.id });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues)
        (next[issue.path.join('.')] ??= []).push(issue.message);
      setErrors(next);
      return;
    }
    setSaving(true);
    try {
      await api(employee ? `/employees/${employee.id}` : '/employees', {
        method: employee ? 'PATCH' : 'POST',
        body: JSON.stringify(parsed.data),
      });
      toast.success(employee ? 'Employee saved' : 'Employee added');
      onDone();
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
  const flag = (
    key: 'canChooseAddress' | 'canChangeDeliveryTime' | 'canChangePackaging' | 'isActive',
    label: string,
  ) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4"
        checked={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
      />
      {label}
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <fieldset disabled={saving} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="emp-name">Name</Label>
            <Input
              id="emp-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            {err('name')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-email">Email</Label>
            <Input
              id="emp-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            {err('email')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-phone">Phone (optional)</Label>
            <Input
              id="emp-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            {err('phone')}
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          {flag('canChooseAddress', 'May choose delivery address')}
          {flag('canChangeDeliveryTime', 'May change delivery time')}
          {flag('canChangePackaging', 'May change packaging')}
          {flag('isActive', 'Active')}
        </div>
        <div className="space-y-2">
          <Label>Allergies</Label>
          <ChipSelect
            label="Allergies"
            items={allergens.data}
            value={form.allergenIds}
            onChange={(v) => setForm({ ...form, allergenIds: v })}
          />
        </div>
        <div className="space-y-2">
          <Label>Dietary preferences</Label>
          <ChipSelect
            label="Dietary preferences"
            items={tags.data}
            value={form.dietaryTagIds}
            onChange={(v) => setForm({ ...form, dietaryTagIds: v })}
          />
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : employee ? 'Save employee' : 'Add employee'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** FR-EMP-02: pick the new company and an email on its domains. Orders already placed stay put. */
function MoveForm({
  employee,
  onDone,
  onCancel,
}: {
  employee: EmployeeDto;
  onDone: () => void;
  onCancel: () => void;
}) {
  const companies = useQuery({
    queryKey: ['companies', 'move-picker'],
    queryFn: () => api<Paginated<CompanyListItem>>('/companies?active=true&pageSize=100'),
  });
  const [companyId, setCompanyId] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const target = companies.data?.items.find((c) => c.id === companyId);
  const localPart = employee.email.split('@')[0] ?? '';

  return (
    <form
      noValidate
      className="space-y-3 rounded-lg border bg-muted/30 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = moveEmployeeSchema.safeParse({ companyId, email });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? 'Choose a company and an email');
          return;
        }
        try {
          await api(`/employees/${employee.id}/move`, {
            method: 'POST',
            body: JSON.stringify(parsed.data),
          });
          toast.success(`${employee.name} moved to ${target?.name ?? 'the new company'}`);
          onDone();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Could not move the employee');
        }
      }}
    >
      <p className="text-sm font-medium">Move {employee.name}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mv-company">New company</Label>
          <NativeSelect
            id="mv-company"
            className="w-full"
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              const next = companies.data?.items.find((c) => c.id === e.target.value);
              if (next?.domains[0]) setEmail(`${localPart}@${next.domains[0]}`);
            }}
          >
            <NativeSelectOption value="">Choose…</NativeSelectOption>
            {companies.data?.items
              .filter((c) => c.id !== employee.company.id)
              .map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mv-email">
            New email{target ? ` (${target.domains.map((d) => `@${d}`).join(' or ')})` : ''}
          </Label>
          <Input
            id="mv-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Orders already placed keep their company, address and prices.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit">Move employee</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
