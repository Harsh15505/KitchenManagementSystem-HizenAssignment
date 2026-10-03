'use client';

import { AbilityProvider, useAbility as useCaslAbility } from '@casl/react';
import { type AppAbility, defineAbilityFor, type MeResponse } from '@fernleaf/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react';
import { api } from './api-client';

/**
 * The signed-in user and their CASL ability, built from the permission codes the API returns
 * with the SAME buildRules() the backend uses. UI checks are cosmetic: the API is the gate.
 */
interface AuthContextValue {
  me: MeResponse;
  ability: AppAbility;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const meQueryKey = ['auth', 'me'] as const;

export function useMeQuery() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => api<MeResponse>('/auth/me'),
    retry: false,
  });
}

export function AuthProvider({ me, children }: { me: MeResponse; children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const ability = useMemo(
    () => defineAbilityFor({ id: me.user.id, permissions: me.permissions }),
    [me.user.id, me.permissions],
  );

  const logout = useCallback(async () => {
    await api<void>('/auth/logout', { method: 'POST' }).catch(() => undefined);
    queryClient.clear();
    router.replace('/login');
  }, [queryClient, router]);

  const value = useMemo(() => ({ me, ability, logout }), [me, ability, logout]);
  return (
    <AuthContext.Provider value={value}>
      <AbilityProvider value={ability}>{children}</AbilityProvider>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

export function useAbility(): AppAbility {
  return useCaslAbility<AppAbility>();
}

/** <Can I="create" a="Order">…</Can> reads the ability from the provider above. */
export { Can } from '@casl/react';
