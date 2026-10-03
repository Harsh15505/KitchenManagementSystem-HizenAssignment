import type { Action, AppAbility, SubjectName } from '@fernleaf/shared';
import { LayoutDashboard, ListChecks, type LucideIcon, Settings, Users } from 'lucide-react';

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
  { href: '/settings/staff', label: 'Staff', icon: Users, anyOf: [['read', 'Staff']] },
  {
    href: '/settings/reference',
    label: 'Reference data',
    icon: ListChecks,
    anyOf: [['read', 'ReferenceData']],
  },
  { href: '/settings', label: 'Settings', icon: Settings, anyOf: [['read', 'Settings']] },
];

export function visibleNav(ability: AppAbility): NavItem[] {
  return NAV_ITEMS.filter((item) =>
    item.anyOf.some(([action, subject]) => ability.can(action, subject)),
  );
}
