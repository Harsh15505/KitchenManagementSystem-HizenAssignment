'use client';

import { useEffect, useState } from 'react';

/** "in 2 h 13 min" / "now", ticking every 30 s against the server's clock (`now` from the API). */
export function Countdown({ to, now }: { to: string; now: string }) {
  const [offset] = useState(() => Date.parse(now) - Date.now());
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const ms = Date.parse(to) - (tick + offset);
  if (ms <= 0) return <span>passed</span>;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return (
    <span>
      in {h > 0 ? `${h} h ` : ''}
      {m} min
    </span>
  );
}
