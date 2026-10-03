'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginSchema, type MeResponse } from '@fernleaf/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api-client';
import { meQueryKey } from '@/lib/auth';

/** The brief publishes these reviewer accounts; one click fills the form. */
const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@test.com' },
  { label: 'Kitchen', email: 'kitchen@test.com' },
  { label: 'Dispatch', email: 'dispatch@test.com' },
  { label: 'Driver', email: 'driver@test.com' },
] as const;
const DEMO_PASSWORD = 'Test@1234';

/** Only same-site relative paths, so ?next= can't redirect to another site. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const me = await api<MeResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      queryClient.setQueryData(meQueryKey, me);
      router.replace(safeNext(searchParams.get('next')));
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (field === 'email' || field === 'password')
            form.setError(field, { message: messages[0] });
        }
      }
      setFormError(error instanceof ApiError ? error.message : 'Sign-in failed. Please try again.');
    }
  });

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            aria-invalid={!!errors.email}
            {...form.register('email')}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...form.register('password')}
          />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Reviewer accounts (password {DEMO_PASSWORD})
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.email}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                form.setValue('email', account.email, { shouldValidate: true });
                form.setValue('password', DEMO_PASSWORD, { shouldValidate: true });
              }}
            >
              {account.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
