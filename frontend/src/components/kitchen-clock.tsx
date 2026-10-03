'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

interface ClockInfo {
  now: string;
  today: string;
  timezone: string;
}

/**
 * Kitchen time, formatted in the kitchen's zone from the server, never the browser's (ADR-006).
 * The server offset is measured once so the clock stays right even if the PC clock is off.
 */
export function KitchenClock() {
  const { data } = useQuery({
    queryKey: ['meta', 'clock'],
    queryFn: async () => ({ info: await api<ClockInfo>('/meta/clock'), fetchedAt: Date.now() }),
    staleTime: Infinity,
  });
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!data) return null;
  const serverNow = new Date(new Date(data.info.now).getTime() + (tick - data.fetchedAt));
  const label = new Intl.DateTimeFormat('en-GB', {
    timeZone: data.info.timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(serverNow);

  return (
    <span className="text-sm tabular-nums text-muted-foreground" title={data.info.timezone}>
      {label} IST
    </span>
  );
}
