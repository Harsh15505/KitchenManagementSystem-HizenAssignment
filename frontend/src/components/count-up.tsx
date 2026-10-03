'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from its previous value to the new one (from 0 on first render). Skips the
 * animation when the user prefers reduced motion. `format` turns the number into text.
 */
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  durationMs = 700,
}: {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = from.current;
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - began) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setShown(start + (value - start) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return <span className="tabular-nums">{format(shown)}</span>;
}
