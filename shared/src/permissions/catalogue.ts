/**
 * The permission catalogue: the single source of truth for what can be granted (TRD §5.5).
 * Roles in the database hold arrays of these codes. Code never checks role names (ADR-023).
 */
export const PERMISSIONS = [
  { code: 'dashboard.admin', group: 'Dashboards', label: 'Admin dashboard' },
  { code: 'dashboard.kitchen', group: 'Dashboards', label: 'Kitchen dashboard' },
  { code: 'dashboard.dispatch', group: 'Dashboards', label: 'Dispatch dashboard' },
  { code: 'dashboard.driver', group: 'Dashboards', label: 'Driver dashboard' },

  { code: 'staff.read', group: 'Staff & roles', label: 'View staff' },
  { code: 'staff.manage', group: 'Staff & roles', label: 'Create and edit staff accounts' },
  { code: 'roles.manage', group: 'Staff & roles', label: 'Edit roles and their permissions' },

  { code: 'settings.read', group: 'Settings', label: 'View platform settings' },
  { code: 'settings.manage', group: 'Settings', label: 'Edit platform settings and holidays' },
  { code: 'reference.read', group: 'Settings', label: 'View reference lists' },
  { code: 'reference.manage', group: 'Settings', label: 'Edit reference lists' },

  { code: 'catalogue.read', group: 'Catalogue', label: 'View dishes and options' },
  { code: 'catalogue.manage', group: 'Catalogue', label: 'Edit dishes and options' },
  { code: 'menu.read', group: 'Catalogue', label: 'View the menu' },
  { code: 'menu.manage', group: 'Catalogue', label: 'Edit the menu' },
  { code: 'pricing.read', group: 'Catalogue', label: 'View price tiers' },
  { code: 'pricing.manage', group: 'Catalogue', label: 'Edit price tiers and prices' },

  { code: 'companies.read', group: 'Customers', label: 'View companies' },
  { code: 'companies.manage', group: 'Customers', label: 'Edit companies' },
  { code: 'employees.read', group: 'Customers', label: 'View employees' },
  { code: 'employees.manage', group: 'Customers', label: 'Edit employees' },

  { code: 'orders.read', group: 'Orders', label: 'View orders' },
  { code: 'orders.create', group: 'Orders', label: 'Create orders' },
  { code: 'orders.edit', group: 'Orders', label: 'Edit open orders' },
  { code: 'orders.cancel', group: 'Orders', label: 'Cancel orders' },
  { code: 'orders.reject', group: 'Orders', label: 'Reject orders' },
  { code: 'orders.override', group: 'Orders', label: 'Act after cut-off and override delivery' },

  { code: 'money.read', group: 'Money', label: 'See prices, totals and invoices' },

  { code: 'cutoff.read', group: 'Cut-off', label: 'View cut-off status' },
  { code: 'cutoff.run', group: 'Cut-off', label: 'Run cut-off processing' },

  { code: 'kitchen.read', group: 'Kitchen', label: 'View the kitchen board' },
  { code: 'kitchen.work', group: 'Kitchen', label: 'Start and finish prep units' },
  { code: 'kitchen.forceComplete', group: 'Kitchen', label: 'Force-complete an order' },

  { code: 'dispatch.read', group: 'Dispatch', label: 'View the dispatch board' },
  { code: 'dispatch.manage', group: 'Dispatch', label: 'Assign drivers and move drops' },
  { code: 'delivery.perform', group: 'Dispatch', label: 'Be assigned drops and deliver them' },

  { code: 'billing.read', group: 'Billing', label: 'View billing and invoices' },
  { code: 'billing.manage', group: 'Billing', label: 'Create invoices, mark paid, adjust' },

  { code: 'demo.manage', group: 'Demo', label: 'Regenerate demo data' },
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number]['code'];

export const ALL_PERMISSION_CODES: readonly PermissionCode[] = PERMISSIONS.map((p) => p.code);

const KNOWN_CODES: ReadonlySet<string> = new Set(ALL_PERMISSION_CODES);

export function isPermissionCode(value: string): value is PermissionCode {
  return KNOWN_CODES.has(value);
}
