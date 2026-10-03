'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
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
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </Button>
  );
}
