import type { Action, AppAbility, SubjectName } from '@fernleaf/shared';
import {
  Carrot,
  ChefHat,
  ClipboardList,
  Route,
  Truck,
  LockKeyhole,
  BookOpen,
  Building2,
  Contact,
  Eye,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Settings,
  Tags,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

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
  { href: '/kitchen', label: 'Kitchen board', icon: ChefHat, anyOf: [['read', 'KitchenBoard']] },
  { href: '/dispatch', label: 'Dispatch board', icon: Truck, anyOf: [['read', 'DispatchBoard']] },
  { href: '/driver', label: 'My deliveries', icon: Route, anyOf: [['read', 'DriverDashboard']] },
  { href: '/orders', label: 'Orders', icon: ClipboardList, anyOf: [['read', 'Order']] },
  { href: '/cutoff', label: 'Cut-off', icon: LockKeyhole, anyOf: [['read', 'Cutoff']] },
  { href: '/companies', label: 'Companies', icon: Building2, anyOf: [['read', 'Company']] },
  { href: '/employees', label: 'Employees', icon: Contact, anyOf: [['read', 'Employee']] },
  {
    href: '/catalogue/dishes',
    label: 'Dishes',
    icon: UtensilsCrossed,
    anyOf: [['read', 'Catalogue']],
  },
  { href: '/catalogue/options', label: 'Options', icon: Carrot, anyOf: [['read', 'Catalogue']] },
  { href: '/menu', label: 'Menu', icon: BookOpen, anyOf: [['read', 'Menu']] },
  { href: '/menu/preview', label: 'Menu preview', icon: Eye, anyOf: [['read', 'Menu']] },
  { href: '/pricing', label: 'Pricing', icon: Tags, anyOf: [['read', 'Pricing']] },
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
