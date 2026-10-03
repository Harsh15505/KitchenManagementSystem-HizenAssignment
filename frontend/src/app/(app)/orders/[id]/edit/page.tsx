'use client';

import { formatOrderNumber, type OrderDetail } from '@fernleaf/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RequireAbility } from '@/components/require-ability';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { OrderBuilder } from '../../order-builder';

export default function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const order = useQuery({
    queryKey: ['order', id],
    queryFn: () => api<OrderDetail>(`/orders/${id}`),
  });
  return (
    <RequireAbility action="update" subject="Order">
      <div className="space-y-4">
        <Link
          href={`/orders/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to the order
        </Link>
        {order.data ? (
          order.data.actions.edit ? (
            <>
              <h1 className="page-title">Edit {formatOrderNumber(order.data.number)}</h1>
              <OrderBuilder order={order.data} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This order can no longer be edited (its status or the cut-off doesn’t allow it).
            </p>
          )
        ) : (
          <Skeleton className="h-96" />
        )}
      </div>
    </RequireAbility>
  );
}
