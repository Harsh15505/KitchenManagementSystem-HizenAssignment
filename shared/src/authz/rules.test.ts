import { subject } from '@casl/ability';
import { describe, expect, it } from 'vitest';
import { ALL_PERMISSION_CODES } from '../permissions/catalogue';
import { DEFAULT_ROLES } from '../permissions/default-roles.seed';
import { buildRules, defineAbilityFor } from './rules';

const roleKeys = ['admin', 'kitchen', 'dispatch', 'driver'] as const;
const [ADMIN, KITCHEN, DISPATCH, DRIVER] = roleKeys.map((key) => {
  const role = DEFAULT_ROLES.find((r) => r.key === key);
  if (!role) throw new Error(`missing default role ${key}`);
  return defineAbilityFor({ id: `user-${key}`, permissions: role.permissions });
});

const drop = (driverId: string) => subject('Drop', { id: 'drop-1', driverId });

describe('BR-ACC-01: abilities come only from permission codes', () => {
  it('every catalogue code grants something (no dead codes)', () => {
    for (const code of ALL_PERMISSION_CODES) {
      expect(buildRules({ id: 'u', permissions: [code] }).length, code).toBeGreaterThan(0);
    }
  });

  it('unknown codes from the database grant nothing', () => {
    expect(buildRules({ id: 'u', permissions: ['orders.delete-everything'] })).toEqual([]);
  });

  it('a brand-new role is just data: any code combination works without code changes', () => {
    const finance = defineAbilityFor({ id: 'u', permissions: ['billing.read', 'money.read'] });
    expect(finance.can('read', 'Invoice')).toBe(true);
    expect(finance.can('create', 'Order')).toBe(false);
  });
});

describe('default roles (TRD §5.5)', () => {
  it('admin can do everything except act as a driver', () => {
    expect(ADMIN?.can('read', 'DriverDashboard')).toBe(false);
    expect(ADMIN?.can('create', 'Order')).toBe(true);
    expect(ADMIN?.can('read', 'Money')).toBe(true);
    expect(ADMIN?.can('run', 'Cutoff')).toBe(true);
    // Admin delivers any drop through dispatch.manage, not through the driver row rule.
    expect(ADMIN?.can('deliver', drop('someone-else'))).toBe(true);
  });

  it('kitchen works prep units, reads orders, never sees money', () => {
    expect(KITCHEN?.can('work', 'PrepUnit')).toBe(true);
    expect(KITCHEN?.can('read', 'Order')).toBe(true);
    expect(KITCHEN?.can('read', 'Money')).toBe(false);
    expect(KITCHEN?.can('create', 'Order')).toBe(false);
    expect(KITCHEN?.can('forceComplete', 'Order')).toBe(false);
  });

  it('dispatch moves any drop but cannot touch billing or money', () => {
    expect(DISPATCH?.can('assignDriver', 'Drop')).toBe(true);
    expect(DISPATCH?.can('deliver', drop('any-driver'))).toBe(true);
    expect(DISPATCH?.can('read', 'Invoice')).toBe(false);
    expect(DISPATCH?.can('read', 'Money')).toBe(false);
  });

  it('BR-DSP-07: a driver can read and deliver only their own drops', () => {
    expect(DRIVER?.can('read', drop('user-driver'))).toBe(true);
    expect(DRIVER?.can('deliver', drop('user-driver'))).toBe(true);
    expect(DRIVER?.can('read', drop('another-driver'))).toBe(false);
    expect(DRIVER?.can('deliver', drop('another-driver'))).toBe(false);
    expect(DRIVER?.can('assignDriver', 'Drop')).toBe(false);
    expect(DRIVER?.can('read', 'Order')).toBe(false);
  });
});
