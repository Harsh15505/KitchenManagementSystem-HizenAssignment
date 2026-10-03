'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CreateStaffInput,
  createStaffSchema,
  type Paginated,
  type RoleSummary,
  type StaffMember,
} from '@fernleaf/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { type Path, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useAbility, useAuth } from '@/lib/auth';

const PAGE_SIZE = 10;

export function StaffManager() {
  const ability = useAbility();
  const canManage = ability.can('create', 'Staff');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');

  const staff = useQuery({
    queryKey: ['staff', { page, q }],
    queryFn: () =>
      api<Paginated<StaffMember>>(
        `/staff?page=${page}&pageSize=${PAGE_SIZE}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
    placeholderData: keepPreviousData,
  });
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api<RoleSummary[]>('/roles') });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Staff</h1>
        <p className="text-sm text-muted-foreground">
          Each staff member has exactly one role. Role changes and deactivation sign the person out
          everywhere.
        </p>
      </div>

      {canManage && roles.data && <CreateStaffCard roles={roles.data} />}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Accounts</CardTitle>
          <Input
            className="max-w-xs"
            placeholder="Search name or email"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.data?.items.map((member) => (
                <StaffRow
                  key={member.id}
                  member={member}
                  roles={roles.data ?? []}
                  canManage={canManage}
                />
              ))}
              {staff.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No staff match this search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {staff.data && staff.data.totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 pt-4 text-sm">
              <span className="text-muted-foreground">
                Page {staff.data.page} of {staff.data.totalPages} · {staff.data.total} accounts
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
                disabled={page >= staff.data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StaffRow({
  member,
  roles,
  canManage,
}: {
  member: StaffMember;
  roles: RoleSummary[];
  canManage: boolean;
}) {
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const isSelf = member.id === me.user.id;
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState('');

  const update = useMutation({
    mutationFn: (body: Partial<Pick<StaffMember, 'isActive'>> & { roleId?: string }) =>
      api<StaffMember>(`/staff/${member.id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (updated) => {
      toast.success(`${updated.name} updated`);
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Update failed'),
  });

  const reset = useMutation({
    mutationFn: () =>
      api<void>(`/staff/${member.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => {
      toast.success(`Password reset for ${member.name}. Their sessions were signed out.`);
      setResetting(false);
      setPassword('');
    },
    onError: (error) => {
      const message =
        error instanceof ApiError
          ? (error.fieldErrors?.password?.[0] ?? error.message)
          : 'Reset failed';
      toast.error(message);
    },
  });

  return (
    <TableRow className={member.isActive ? undefined : 'opacity-60'}>
      <TableCell className="font-medium">
        {member.name}
        {isSelf && <span className="ml-1 text-muted-foreground">(you)</span>}
      </TableCell>
      <TableCell>{member.email}</TableCell>
      <TableCell>
        {canManage ? (
          <NativeSelect
            aria-label={`Role for ${member.name}`}
            value={member.role.id}
            disabled={isSelf || update.isPending}
            onChange={(e) => update.mutate({ roleId: e.target.value })}
          >
            {roles.map((role) => (
              <NativeSelectOption key={role.id} value={role.id}>
                {role.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : (
          member.role.name
        )}
      </TableCell>
      <TableCell>
        <Badge variant={member.isActive ? 'secondary' : 'outline'}>
          {member.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      {canManage && (
        <TableCell className="text-right">
          {resetting ? (
            <form
              className="flex justify-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                reset.mutate();
              }}
            >
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                className="w-40"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button size="sm" type="submit" disabled={reset.isPending}>
                Save
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setResetting(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setResetting(true)}>
                Reset password
              </Button>
              <Button
                size="sm"
                variant={member.isActive ? 'outline' : 'default'}
                disabled={isSelf || update.isPending}
                onClick={() => update.mutate({ isActive: !member.isActive })}
              >
                {member.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}

function CreateStaffCard({ roles }: { roles: RoleSummary[] }) {
  const queryClient = useQueryClient();
  const form = useForm<CreateStaffInput>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: { name: '', email: '', roleId: roles[0]?.id ?? '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await api<StaffMember>('/staff', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      toast.success(`${created.name} can now sign in as ${created.role.name}`);
      form.reset({ name: '', email: '', roleId: values.roleId, password: '' });
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          form.setError(field as Path<CreateStaffInput>, { message: messages[0] });
        }
      } else {
        toast.error(error instanceof ApiError ? error.message : 'Could not create the account');
      }
    }
  });

  const fieldError = (name: keyof CreateStaffInput) =>
    errors[name] ? <p className="text-sm text-destructive">{errors[name]?.message}</p> : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a staff member</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4 md:grid-cols-5 md:items-start">
          <div className="space-y-1">
            <Label htmlFor="new-name">Name</Label>
            <Input id="new-name" aria-invalid={!!errors.name} {...form.register('name')} />
            {fieldError('name')}
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              type="email"
              aria-invalid={!!errors.email}
              {...form.register('email')}
            />
            {fieldError('email')}
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-role">Role</Label>
            <NativeSelect id="new-role" className="w-full" {...form.register('roleId')}>
              {roles.map((role) => (
                <NativeSelectOption key={role.id} value={role.id}>
                  {role.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {fieldError('roleId')}
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-password">Initial password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...form.register('password')}
            />
            {fieldError('password')}
          </div>
          <Button type="submit" className="md:mt-6" disabled={isSubmitting}>
            {isSubmitting ? 'Adding…' : 'Add staff member'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
