import type { Action, AppAbility, SubjectName } from '@fernleaf/shared';
import {
  BookOpen,
  Building2,
  Carrot,
  ChefHat,
  ClipboardList,
  Contact,
  Eye,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  type LucideIcon,
  Receipt,
  Route,
  Settings,
  Tags,
  Truck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

/**
 * Navigation is derived from abilities, never from role names (FR-ACC-04). Each item declares the
 * ability that unlocks it; empty sections disappear, so a driver sees two links and an admin all.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown when the user can do ANY of these. */
  anyOf: ReadonlyArray<readonly [Action, SubjectName]>;
}

export interface NavSection {
  title: string;
  items: readonly NavItem[];
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: 'Today',
    items: [
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
      {
        href: '/kitchen',
        label: 'Kitchen board',
        icon: ChefHat,
        anyOf: [['read', 'KitchenBoard']],
      },
      {
        href: '/dispatch',
        label: 'Dispatch board',
        icon: Truck,
        anyOf: [['read', 'DispatchBoard']],
      },
      {
        href: '/driver',
        label: 'My deliveries',
        icon: Route,
        anyOf: [['read', 'DriverDashboard']],
      },
    ],
  },
  {
    title: 'Orders & billing',
    items: [
      { href: '/orders', label: 'Orders', icon: ClipboardList, anyOf: [['read', 'Order']] },
      { href: '/cutoff', label: 'Cut-off', icon: LockKeyhole, anyOf: [['read', 'Cutoff']] },
      { href: '/billing', label: 'Billing', icon: Receipt, anyOf: [['read', 'Invoice']] },
    ],
  },
  {
    title: 'Customers',
    items: [
      { href: '/companies', label: 'Companies', icon: Building2, anyOf: [['read', 'Company']] },
      { href: '/employees', label: 'Employees', icon: Contact, anyOf: [['read', 'Employee']] },
    ],
  },
  {
    title: 'Food & pricing',
    items: [
      {
        href: '/catalogue/dishes',
        label: 'Dishes',
        icon: UtensilsCrossed,
        anyOf: [['read', 'Catalogue']],
      },
      {
        href: '/catalogue/options',
        label: 'Options',
        icon: Carrot,
        anyOf: [['read', 'Catalogue']],
      },
      { href: '/menu', label: 'Menu', icon: BookOpen, anyOf: [['read', 'Menu']] },
      { href: '/menu/preview', label: 'Menu preview', icon: Eye, anyOf: [['read', 'Menu']] },
      { href: '/pricing', label: 'Pricing', icon: Tags, anyOf: [['read', 'Pricing']] },
    ],
  },
  {
    title: 'Setup',
    items: [
      { href: '/settings/staff', label: 'Staff', icon: Users, anyOf: [['read', 'Staff']] },
      {
        href: '/settings/reference',
        label: 'Reference data',
        icon: ListChecks,
        anyOf: [['read', 'ReferenceData']],
      },
      { href: '/settings', label: 'Settings', icon: Settings, anyOf: [['read', 'Settings']] },
    ],
  },
];

const allowed = (ability: AppAbility, item: NavItem) =>
  item.anyOf.some(([action, subject]) => ability.can(action, subject));

/** The sections this user may see, with only the items they may open. */
export function visibleSections(ability: AppAbility): NavSection[] {
  return NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => allowed(ability, i)),
  })).filter((s) => s.items.length > 0);
}
