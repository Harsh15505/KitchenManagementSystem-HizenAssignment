'use client';

import type { DishDetail } from '@fernleaf/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RequireAbility } from '@/components/require-ability';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { DishForm } from './dish-form';
import { OptionGroupsEditor } from './option-groups-editor';

export default function DishPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const dish = useQuery({
    queryKey: ['dish', id],
    queryFn: () => api<DishDetail>(`/dishes/${id}`),
    enabled: !isNew,
  });

  return (
    <RequireAbility action="read" subject="Catalogue">
      <div className="max-w-4xl space-y-6">
        <Link
          href="/catalogue/dishes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Dishes
        </Link>
        {isNew ? (
          <DishForm />
        ) : dish.data ? (
          <>
            <DishForm key={dish.data.id + String(dish.dataUpdatedAt)} dish={dish.data} />
            <OptionGroupsEditor dish={dish.data} />
          </>
        ) : (
          <Skeleton className="h-96 w-full" />
        )}
      </div>
    </RequireAbility>
  );
}
