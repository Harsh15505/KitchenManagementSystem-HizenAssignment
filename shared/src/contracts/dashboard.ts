/** PRD §8.2: the admin dashboard figures, each recomputable from its definition. */
export interface AdminDashboardDto {
  date: string;
  now: string;
  today: {
    orders: number;
    meals: number;
    drops: number;
    dropsDelivered: number;
    /** Kitchen units late + drops late right now (BR-PLN-04). */
    lateUnits: number;
    lateDrops: number;
  };
  /** On-time ÷ delivered drops per delivery date, oldest first; null = nothing delivered ("—"). */
  onTime: Array<{ date: string; delivered: number; onTime: number; rate: number | null }>;
  nextCutoff: { deliveryDate: string; cutoffAt: string; drafts: number; placed: number } | null;
  pendingProcessing: Array<{
    deliveryDate: string;
    cutoffAt: string;
    drafts: number;
    placed: number;
  }>;
  pipeline: Array<{
    date: string;
    kitchenHoliday: boolean;
    confirmed: number;
    placed: number;
    draft: number;
    meals: number;
  }>;
  revenue: {
    /** Σ active order totals per delivery date: last 14 days + today + next 7 (Confirmed only for the future). */
    days: Array<{ date: string; cents: number; future: boolean }>;
    thisWeekCents: number;
    lastWeekCents: number;
  };
  uninvoiced: {
    cents: number;
    top: Array<{ companyId: string; companyName: string; cents: number }>;
  };
  openInvoices: { count: number; cents: number; oldestIssuedAt: string | null };
  paidLast30DaysCents: number;
  setupGaps: {
    unpricedDishes: Array<{ dishId: string; dishName: string; tierName: string }>;
    companiesWithoutDriver: Array<{ id: string; name: string }>;
    dishesWithoutStation: Array<{ id: string; name: string }>;
  };
}
