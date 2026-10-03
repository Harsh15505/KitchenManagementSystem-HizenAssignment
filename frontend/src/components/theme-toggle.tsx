'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';

// The theme is only known in the browser; render a neutral icon on the server pass.
const subscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

/** Light / dark switch; the choice is remembered in this browser. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === 'dark';

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const next = dark ? 'light' : 'dark';
    const apply = () => {
      // Set the class ourselves so the browser's "after" snapshot already has the new theme;
      // next-themes applies the same class again in its effect.
      const root = document.documentElement;
      root.classList.toggle('dark', next === 'dark');
      root.style.colorScheme = next;
      flushSync(() => setTheme(next));
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduced) {
      apply();
      return;
    }
    // The new theme grows as a circle from the button over a snapshot of the old one.
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(apply);
    // `ready` rejects when the browser skips the transition (e.g. a hidden tab); the theme has
    // still switched, so there is nothing to animate (BUG-012).
    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
          },
          {
            duration: 600,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        );
      })
      .catch(() => {});
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      onClick={toggle}
    >
      {dark ? (
        <Sun className="size-4 animate-in duration-500 spin-in-90 fade-in" aria-hidden />
      ) : (
        <Moon className="size-4 animate-in duration-500 fade-in spin-in-[-90deg]" aria-hidden />
      )}
    </Button>
  );
}
