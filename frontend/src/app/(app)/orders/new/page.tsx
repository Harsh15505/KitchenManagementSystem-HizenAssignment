'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { RequireAbility } from '@/components/require-ability';
import { OrderBuilder } from '../order-builder';

export default function NewOrderPage() {
  return (
    <RequireAbility action="create" subject="Order">
      <div className="space-y-4">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Orders
        </Link>
        <h1 className="page-title">New order</h1>
        <OrderBuilder />
      </div>
    </RequireAbility>
  );
}
