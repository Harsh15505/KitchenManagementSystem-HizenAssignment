import { ALL_PERMISSION_CODES, type PermissionCode } from './catalogue';

/**
 * Seed data for the four system roles (TRD §5.5). These keys are data, not code paths:
 * nothing in the application branches on them. A new role is a new row with codes.
 */
export interface RoleSeed {
  key: string;
  name: string;
  description: string;
  permissions: readonly PermissionCode[];
}

export const DEFAULT_ROLES: readonly RoleSeed[] = [
  {
    key: 'admin',
    name: 'Admin',
    description: 'Everything. Admins act on drops through dispatch permissions, not as drivers.',
    permissions: ALL_PERMISSION_CODES.filter((code) => code !== 'delivery.perform'),
  },
  {
    key: 'kitchen',
    name: 'Kitchen',
    description: 'Sees what to cook and marks prep units started and done.',
    permissions: [
      'dashboard.kitchen',
      'kitchen.read',
      'kitchen.work',
      'catalogue.read',
      'reference.read',
      'orders.read',
    ],
  },
  {
    key: 'dispatch',
    name: 'Dispatch',
    description: 'Moves cooked orders out of the door, assigns drivers and tracks delivery.',
    permissions: [
      'dashboard.dispatch',
      'dispatch.read',
      'dispatch.manage',
      'kitchen.read',
      'orders.read',
      'companies.read',
      'reference.read',
    ],
  },
  {
    key: 'driver',
    name: 'Driver',
    description: 'Sees only their own drops for today and marks them delivered.',
    permissions: ['dashboard.driver', 'delivery.perform'],
  },
];
