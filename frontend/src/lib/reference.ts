'use client';

import type { ReferenceItem, ReferenceType } from '@fernleaf/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api-client';

/** Reference lists change rarely: cache them for the session. */
export function useReferenceList(type: ReferenceType) {
  return useQuery({
    queryKey: ['reference', type],
    queryFn: () => api<ReferenceItem[]>(`/reference/${type}`),
    staleTime: 5 * 60_000,
  });
}

export function nameLookup(items: ReferenceItem[] | undefined): Map<string, string> {
  return new Map((items ?? []).map((item) => [item.id, item.name]));
}
