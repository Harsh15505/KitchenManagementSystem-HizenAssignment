import { z } from 'zod';
import type { Timeliness } from '../domain/cutoff';
import { calendarDateString } from './settings';

export const DROP_STAGES = [
  'COOKING',
  'KITCHEN_READY',
  'DISPATCH_READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const;
export type DropStage = (typeof DROP_STAGES)[number];

export const dispatchBoardQuerySchema = z.object({
  date: calendarDateString.optional(),
  stage: z.enum(DROP_STAGES).optional(),
  driverId: z.union([z.uuid(), z.literal('unassigned')]).optional(),
});
export type DispatchBoardQuery = z.infer<typeof dispatchBoardQuerySchema>;

export const assignDriverSchema = z.object({ driverId: z.uuid().nullable() });

/** Photos travel as base64 JSON; the client compresses them first (FR-DSP-04, T-706). */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const deliverDropSchema = z.object({
  note: z.string().trim().max(500).optional(),
  photo: z
    .object({
      mimeType: z.enum(PHOTO_TYPES),
      dataBase64: z
        .string()
        .max(Math.ceil((PHOTO_MAX_BYTES * 4) / 3) + 4, 'The photo is larger than 5 MB'),
    })
    .optional(),
});
export type DeliverDropInput = z.infer<typeof deliverDropSchema>;

export interface DropOrderDto {
  id: string;
  number: number;
  employeeName: string;
  itemCount: number;
  kitchenReady: boolean;
  packaging: string;
}

/** FR-DSP-02: one drop = the confirmed orders for one company, address and exact time. */
export interface DropDto {
  id: string;
  company: { id: string; name: string };
  address: {
    label: string;
    line1: string;
    line2: string;
    city: string;
    postalCode: string;
    accessNotes: string;
  };
  driverInstructions: string;
  deliveryDate: string;
  deliveryTimeMinutes: number;
  deliveryAt: string;
  plannedDispatchReadyAt: string;
  driver: { id: string; name: string } | null;
  stage: DropStage;
  readiness: { ready: number; total: number };
  boxes: number;
  orders: DropOrderDto[];
  dispatchReadyAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  deliveredOnTime: boolean | null;
  deliveryNote: string | null;
  hasPhoto: boolean;
  /** Against planned dispatch-ready; done once the drop has left (BR-PLN-04). */
  timeliness: Timeliness;
}

export interface DispatchBoardDto {
  date: string;
  now: string;
  summary: Record<DropStage, number> & {
    drops: number;
    late: number;
    atRisk: number;
    unassigned: number;
  };
  drops: DropDto[];
  drivers: Array<{ id: string; name: string }>;
}

export interface DriverDropsDto {
  date: string;
  drops: DropDto[];
}
