import { SetMetadata } from '@nestjs/common';
import type { AppAbility } from '@fernleaf/shared';

/** A policy is a predicate over the caller's CASL ability, e.g. (a) => a.can('create', 'Order'). */
export type PolicyHandler = (ability: AppAbility) => boolean;

export const ACCESS_KEY = 'fernleaf:access';

export type AccessRule =
  { kind: 'public' } | { kind: 'any-user' } | { kind: 'policies'; handlers: PolicyHandler[] };

/** No session needed (login, health). */
export const Public = () => SetMetadata(ACCESS_KEY, { kind: 'public' } satisfies AccessRule);

/** Any signed-in staff member, whatever their permissions (e.g. "who am I?"). */
export const AnyUser = () => SetMetadata(ACCESS_KEY, { kind: 'any-user' } satisfies AccessRule);

/** Signed in AND every handler passes against the caller's ability (ADR-023). */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(ACCESS_KEY, { kind: 'policies', handlers } satisfies AccessRule);
