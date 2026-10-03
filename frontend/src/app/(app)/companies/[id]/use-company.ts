'use client';

import type { CompanyDetail } from '@fernleaf/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, api } from '@/lib/api-client';

export const companyKey = (id: string) => ['company', id] as const;

export function useCompany(id: string) {
  return useQuery({
    queryKey: companyKey(id),
    queryFn: () => api<CompanyDetail>(`/companies/${id}`),
  });
}

/**
 * Company sub-resource endpoints all return the updated CompanyDetail: store it, toast, and
 * report success so forms can reset. Errors are toasted and returned for field mapping.
 */
export function useCompanyAction(id: string) {
  const queryClient = useQueryClient();
  return async (
    path: string,
    method: string,
    body?: unknown,
    ok?: string,
  ): Promise<{ ok: true } | { ok: false; error: ApiError | null }> => {
    try {
      const updated = await api<CompanyDetail>(`/companies/${id}${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      queryClient.setQueryData(companyKey(id), updated);
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
      if (ok) toast.success(ok);
      return { ok: true };
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
      return { ok: false, error: error instanceof ApiError ? error : null };
    }
  };
}
