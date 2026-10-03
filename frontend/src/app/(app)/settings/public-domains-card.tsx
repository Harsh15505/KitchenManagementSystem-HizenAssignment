'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiError, api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';

/** BR-CMP-01: companies can never claim these as their email domain. */
export function PublicDomainsCard() {
  const canEdit = useAbility().can('update', 'Settings');
  const queryClient = useQueryClient();
  const domains = useQuery({
    queryKey: ['public-domains'],
    queryFn: () => api<string[]>('/settings/public-domains'),
  });
  const [domain, setDomain] = useState('');

  const update = (list: string[]) => queryClient.setQueryData(['public-domains'], list);
  const onError = (error: unknown) =>
    toast.error(
      error instanceof ApiError
        ? (error.fieldErrors?.domain?.[0] ?? error.message)
        : 'Something went wrong',
    );

  const add = useMutation({
    mutationFn: () =>
      api<string[]>('/settings/public-domains', {
        method: 'POST',
        body: JSON.stringify({ domain }),
      }),
    onSuccess: (list) => {
      update(list);
      setDomain('');
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (d: string) =>
      api<string[]>(`/settings/public-domains/${encodeURIComponent(d)}`, { method: 'DELETE' }),
    onSuccess: update,
    onError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Public email domains</CardTitle>
        <CardDescription>
          Free mail providers. A company can&apos;t register these as its domain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {domains.data?.map((d) => (
            <Badge key={d} variant="secondary" className="gap-1">
              {d}
              {canEdit && (
                <button type="button" aria-label={`Remove ${d}`} onClick={() => remove.mutate(d)}>
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
        {canEdit && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <Input
              placeholder="e.g. fastmail.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
            />
            <Button type="submit" disabled={add.isPending}>
              Add
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
