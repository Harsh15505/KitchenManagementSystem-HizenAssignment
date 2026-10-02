'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';

interface Liveness {
  ok: boolean;
  uptimeS: number;
}

interface Readiness {
  ok: boolean;
  db: string;
  latencyMs: number;
}

/** Shows whether the browser → Next.js → NestJS → Postgres path works end to end. */
export function SystemStatus() {
  const api$ = useQuery({ queryKey: ['health'], queryFn: () => api<Liveness>('/health') });
  const db$ = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: () => api<Readiness>('/health/ready'),
    enabled: api$.isSuccess,
  });

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>System</span>
      <StatusBadge label="API" loading={api$.isPending} ok={api$.isSuccess} />
      <StatusBadge
        label={db$.data ? `Database · ${db$.data.latencyMs} ms` : 'Database'}
        loading={api$.isSuccess && db$.isPending}
        ok={db$.isSuccess}
      />
    </div>
  );
}

function StatusBadge({ label, loading, ok }: { label: string; loading: boolean; ok: boolean }) {
  if (loading) return <Badge variant="outline">{label}: checking…</Badge>;
  return (
    <Badge variant={ok ? 'secondary' : 'destructive'}>{`${label}: ${ok ? 'up' : 'down'}`}</Badge>
  );
}
