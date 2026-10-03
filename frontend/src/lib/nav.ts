import type { Action, AppAbility, SubjectName } from '@fernleaf/shared';
import { LayoutDashboard, type LucideIcon } from 'lucide-react';

/**
 * Navigation is derived from abilities, never from role names (FR-ACC-04). Items are added as
 * their pages ship; each declares the ability that unlocks it.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown when the user can do ANY of these. */
  anyOf: ReadonlyArray<readonly [Action, SubjectName]>;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    anyOf: [
      ['read', 'AdminDashboard'],
      ['read', 'KitchenDashboard'],
      ['read', 'DispatchDashboard'],
      ['read', 'DriverDashboard'],
    ],
  },
];

export function visibleNav(ability: AppAbility): NavItem[] {
  return NAV_ITEMS.filter((item) =>
    item.anyOf.some(([action, subject]) => ability.can(action, subject)),
  );
}
