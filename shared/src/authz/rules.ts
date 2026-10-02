import {
  AbilityBuilder,
  createMongoAbility,
  type ForcedSubject,
  type MongoAbility,
  type RawRuleOf,
} from '@casl/ability';
import { isPermissionCode, type PermissionCode } from '../permissions/catalogue';

/**
 * Permission codes → CASL rules (ADR-023). This is the only place codes are interpreted, and it
 * never looks at role names. The same rules power the backend guard (Prisma ability) and the
 * frontend <Can> (Mongo ability), so conditions stay simple equalities that both understand.
 *
 * Abilities answer "may this user attempt this?". Business state rules (only Confirmed orders
 * can be cooked, locked after cut-off) stay in the domain functions.
 */

export type Action =
  | 'manage'
  | 'read'
  | 'create'
  | 'update'
  | 'cancel'
  | 'reject'
  | 'override'
  | 'run'
  | 'work'
  | 'forceComplete'
  | 'assignDriver' // choose the drop's driver (FR-DSP-03)
  | 'markReady' // drop is dispatch-ready (BR-DSP-02)
  | 'sendOut' // drop is out for delivery (BR-DSP-03)
  | 'deliver'; // drop delivered (BR-DSP-04)

export type SubjectName =
  | 'AdminDashboard'
  | 'KitchenDashboard'
  | 'DispatchDashboard'
  | 'DriverDashboard'
  | 'Staff'
  | 'Role'
  | 'Settings'
  | 'ReferenceData'
  | 'Catalogue'
  | 'Menu'
  | 'Pricing'
  | 'Company'
  | 'Employee'
  | 'Order'
  | 'Money'
  | 'Cutoff'
  | 'KitchenBoard'
  | 'PrepUnit'
  | 'DispatchBoard'
  | 'Drop'
  | 'Invoice'
  | 'DemoData'
  | 'all';

/**
 * Subjects whose rules have conditions declare the fields those conditions use, so a typo in
 * `{ driverId }` is a compile error. Check one with `subject('Drop', record)` from @casl/ability.
 */
export type DropSubject = ForcedSubject<'Drop'> & { driverId: string | null };

export type AppSubject = SubjectName | DropSubject;
export type AppAbility = MongoAbility<[Action, AppSubject]>;
export type AppRule = RawRuleOf<AppAbility>;

export interface AbilityUser {
  id: string;
  permissions: readonly string[];
}

type Grant = (can: AbilityBuilder<AppAbility>['can'], user: AbilityUser) => void;

/**
 * Exhaustive by type: adding a permission code without saying what it grants fails to compile.
 */
const GRANTS: Record<PermissionCode, Grant> = {
  'dashboard.admin': (can) => can('read', 'AdminDashboard'),
  'dashboard.kitchen': (can) => can('read', 'KitchenDashboard'),
  'dashboard.dispatch': (can) => can('read', 'DispatchDashboard'),
  'dashboard.driver': (can) => can('read', 'DriverDashboard'),

  'staff.read': (can) => can('read', 'Staff'),
  'staff.manage': (can) => can('manage', 'Staff'),
  'roles.manage': (can) => can('manage', 'Role'),

  'settings.read': (can) => can('read', 'Settings'),
  'settings.manage': (can) => can('update', 'Settings'),
  'reference.read': (can) => can('read', 'ReferenceData'),
  'reference.manage': (can) => can('manage', 'ReferenceData'),

  'catalogue.read': (can) => can('read', 'Catalogue'),
  'catalogue.manage': (can) => can('manage', 'Catalogue'),
  'menu.read': (can) => can('read', 'Menu'),
  'menu.manage': (can) => can('manage', 'Menu'),
  'pricing.read': (can) => can('read', 'Pricing'),
  'pricing.manage': (can) => can('manage', 'Pricing'),

  'companies.read': (can) => can('read', 'Company'),
  'companies.manage': (can) => can('manage', 'Company'),
  'employees.read': (can) => can('read', 'Employee'),
  'employees.manage': (can) => can('manage', 'Employee'),

  'orders.read': (can) => can('read', 'Order'),
  'orders.create': (can) => can('create', 'Order'),
  'orders.edit': (can) => can('update', 'Order'),
  'orders.cancel': (can) => can('cancel', 'Order'),
  'orders.reject': (can) => can('reject', 'Order'),
  'orders.override': (can) => can('override', 'Order'),

  'money.read': (can) => can('read', 'Money'),

  'cutoff.read': (can) => can('read', 'Cutoff'),
  'cutoff.run': (can) => can('run', 'Cutoff'),

  'kitchen.read': (can) => can('read', 'KitchenBoard'),
  'kitchen.work': (can) => can('work', 'PrepUnit'),
  'kitchen.forceComplete': (can) => can('forceComplete', 'Order'),

  'dispatch.read': (can) => {
    can('read', 'DispatchBoard');
    can('read', 'Drop');
  },
  'dispatch.manage': (can) => can(['assignDriver', 'markReady', 'sendOut', 'deliver'], 'Drop'),
  // Row rule: drivers only ever see and deliver drops assigned to them (BR-DSP-07).
  'delivery.perform': (can, user) => can(['read', 'deliver'], 'Drop', { driverId: user.id }),

  'billing.read': (can) => can('read', 'Invoice'),
  'billing.manage': (can) => can('manage', 'Invoice'),

  'demo.manage': (can) => can('manage', 'DemoData'),
};

/** Raw CASL rules for a user. Unknown codes (e.g. stale DB data) grant nothing. */
export function buildRules(user: AbilityUser): AppRule[] {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  for (const code of new Set(user.permissions)) {
    if (isPermissionCode(code)) GRANTS[code](builder.can, user);
  }
  return builder.rules;
}

/** Ability for in-memory checks (frontend <Can>, unit tests). The backend wraps the same rules for Prisma. */
export function defineAbilityFor(user: AbilityUser): AppAbility {
  return createMongoAbility<AppAbility>(buildRules(user));
}
