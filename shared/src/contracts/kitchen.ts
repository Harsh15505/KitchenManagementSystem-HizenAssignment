import { z } from 'zod';
import type { Timeliness } from '../domain/cutoff';
import { calendarDateString } from './settings';

export const kitchenBoardQuerySchema = z.object({
  date: calendarDateString.optional(),
  /** A station id, or "unassigned" for dishes without a station. */
  stationId: z.union([z.uuid(), z.literal('unassigned')]).optional(),
});
export type KitchenBoardQuery = z.infer<typeof kitchenBoardQuerySchema>;

/** FR-KIT-01: one distinct combination on one line of a confirmed order. */
export interface KitchenUnitDto {
  id: string;
  order: {
    id: string;
    number: number;
    status: string;
    notes: string;
    employeeName: string;
    companyName: string;
  };
  dish: { id: string; name: string; temperature: 'HOT' | 'COLD' };
  stationId: string | null;
  quantity: number;
  /** "Paneer", "Brown Rice (Large)"… in menu order. */
  choices: string[];
  plannedKitchenReadyAt: string;
  plannedDispatchReadyAt: string;
  prepStartedAt: string | null;
  prepDoneAt: string | null;
  timeliness: Timeliness;
  /** Allergens in the dish or its options that the employee is allergic to (FR-ORD-10). */
  allergenIds: string[];
  /** Every allergen in the dish and its chosen options (dashboard allergen watch). */
  containsAllergenIds: string[];
  /** FR-KIT-08: the order was cancelled or rejected after work started. */
  doNotCook: boolean;
}

export interface KitchenBoardDto {
  date: string;
  now: string;
  stations: Array<{ id: string | null; name: string; total: number; remaining: number }>;
  summary: {
    units: number;
    done: number;
    inProgress: number;
    queued: number;
    late: number;
    atRisk: number;
    orders: number;
  };
  /** Orders still open (Placed) for the date while its cut-off hasn't passed: meals that may change. */
  pending: {
    cutoffAt: string;
    cutoffPassed: boolean;
    placedMealsByStation: Array<{ stationName: string; meals: number }>;
  };
  /** Units grouped by planned kitchen-ready time, earliest first. */
  slots: Array<{ plannedKitchenReadyAt: string; units: KitchenUnitDto[] }>;
  /** FR-KIT-06: station → dish → combination totals for the day. */
  prep: Array<{
    stationId: string | null;
    stationName: string;
    dishes: Array<{
      dishName: string;
      quantity: number;
      combinations: Array<{ label: string; quantity: number }>;
    }>;
  }>;
}
