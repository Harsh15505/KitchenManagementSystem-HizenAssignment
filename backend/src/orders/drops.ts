import { DomainError } from '../common/domain-error';
import type { Prisma } from '../generated/prisma/client';

type Tx = Prisma.TransactionClient;

export interface DropTarget {
  orderId: string;
  companyId: string;
  addressId: string;
  deliveryDate: Date;
  deliveryTimeMinutes: number;
  deliveryAt: Date;
  kitchenReady: boolean;
}

/**
 * BR-DSP-01/06 (TRD §8.6): orders for the same company, address and delivery instant travel
 * together. Upserts the drop (default driver on create) and moves the order into it.
 * `strict` refuses a drop that has left, or one marked ready while this order isn't cooked.
 */
export async function assignDrop(
  tx: Tx,
  target: DropTarget,
  options: { strict: boolean; actorLabel: string; actorId: string | null },
): Promise<string> {
  const company = await tx.company.findUniqueOrThrow({
    where: { id: target.companyId },
    select: { defaultDriverId: true },
  });
  const drop = await tx.drop.upsert({
    where: {
      companyId_addressId_deliveryAt: {
        companyId: target.companyId,
        addressId: target.addressId,
        deliveryAt: target.deliveryAt,
      },
    },
    update: {},
    create: {
      companyId: target.companyId,
      addressId: target.addressId,
      deliveryDate: target.deliveryDate,
      deliveryTimeMinutes: target.deliveryTimeMinutes,
      deliveryAt: target.deliveryAt,
      driverId: company.defaultDriverId,
    },
    select: { id: true, outForDeliveryAt: true, dispatchReadyAt: true },
  });
  if (options.strict && drop.outForDeliveryAt)
    throw new DomainError(
      'DROP_ALREADY_DISPATCHED',
      'The delivery for that time and address has already left. Choose another time.',
    );
  if (options.strict && drop.dispatchReadyAt && !target.kitchenReady)
    throw new DomainError(
      'DROP_NOT_READY',
      'The delivery for that time and address is already packed and waiting. Choose another time.',
    );

  const previous = await tx.order.findUniqueOrThrow({
    where: { id: target.orderId },
    select: { dropId: true },
  });
  if (previous.dropId === drop.id) return drop.id;
  await tx.order.update({ where: { id: target.orderId }, data: { dropId: drop.id } });
  await tx.orderEvent.create({
    data: {
      orderId: target.orderId,
      type: 'DROP_ASSIGNED',
      actorId: options.actorId,
      actorLabel: options.actorLabel,
      data: { dropId: drop.id, previousDropId: previous.dropId },
    },
  });
  if (previous.dropId) await removeDropIfEmpty(tx, previous.dropId);
  return drop.id;
}

/** A drop with no active orders that hasn't been dispatched is deleted (TRD §8.6). */
export async function removeDropIfEmpty(tx: Tx, dropId: string): Promise<void> {
  const drop = await tx.drop.findUnique({
    where: { id: dropId },
    select: {
      dispatchReadyAt: true,
      outForDeliveryAt: true,
      _count: { select: { orders: { where: { status: { in: ['CONFIRMED', 'DELIVERED'] } } } } },
    },
  });
  if (!drop || drop._count.orders > 0 || drop.dispatchReadyAt || drop.outForDeliveryAt) return;
  await tx.order.updateMany({ where: { dropId }, data: { dropId: null } });
  await tx.drop.delete({ where: { id: dropId } });
}
