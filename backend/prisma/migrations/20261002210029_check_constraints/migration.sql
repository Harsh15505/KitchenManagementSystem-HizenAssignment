-- Hand-written CHECK constraints (docs/DATABASE_MODELS.md §5). Prisma does not model CHECKs,
-- and Prisma Migrate ignores them when diffing, so they persist across later migrations.

-- Singleton & settings ranges
ALTER TABLE "PlatformSettings" ADD CONSTRAINT settings_singleton        CHECK (id = 1);
ALTER TABLE "PlatformSettings" ADD CONSTRAINT settings_cutoff_time      CHECK ("cutoffTimeMinutes" BETWEEN 0 AND 1439);
ALTER TABLE "PlatformSettings" ADD CONSTRAINT settings_cutoff_days      CHECK ("cutoffWorkingDays" BETWEEN 0 AND 14);
ALTER TABLE "PlatformSettings" ADD CONSTRAINT settings_buffers          CHECK ("kitchenBufferMinutes" >= 0 AND "atRiskWindowMinutes" >= 0 AND "onTimeGraceMinutes" >= 0);
ALTER TABLE "PlatformSettings" ADD CONSTRAINT settings_window           CHECK ("deliveryWindowStartMin" < "deliveryWindowEndMin" AND "deliverySlotMinutes" > 0);
ALTER TABLE "PlatformSettings" ADD CONSTRAINT settings_working_days     CHECK (cardinality("kitchenWorkingDays") > 0);

-- Catalogue & pricing
ALTER TABLE "Dish"              ADD CONSTRAINT dish_cost_nonneg        CHECK ("costPriceCents" >= 0);
ALTER TABLE "Dish"              ADD CONSTRAINT dish_min_qty            CHECK ("minOrderQty" IS NULL OR "minOrderQty" >= 1);
ALTER TABLE "Option"            ADD CONSTRAINT option_cost_nonneg      CHECK ("costPriceCents" >= 0);
ALTER TABLE "OptionGroup"       ADD CONSTRAINT group_max_selections    CHECK ("maxSelections" >= 1);
ALTER TABLE "OptionPortionPrice" ADD CONSTRAINT portion_extra_nonneg   CHECK ("extraChargeCents" >= 0);
ALTER TABLE "DishTierPrice"     ADD CONSTRAINT dish_price_positive     CHECK ("priceCents" IS NULL OR "priceCents" > 0);
ALTER TABLE "OptionTierPrice"   ADD CONSTRAINT option_price_nonneg     CHECK ("priceCents" IS NULL OR "priceCents" >= 0);
ALTER TABLE "PriceTier"         ADD CONSTRAINT tier_derivation_shape   CHECK (
     ("derivation" = 'MANUAL'    AND "factorBps" IS NULL AND "baseTierId" IS NULL)
  OR ("derivation" = 'FROM_COST' AND "factorBps" > 0     AND "baseTierId" IS NULL)
  OR ("derivation" = 'FROM_TIER' AND "factorBps" > 0     AND "baseTierId" IS NOT NULL AND "baseTierId" <> id));

-- Companies
ALTER TABLE "Company" ADD CONSTRAINT company_lead_nonneg   CHECK ("dispatchLeadMinutes" >= 0);
ALTER TABLE "Company" ADD CONSTRAINT company_time_range    CHECK ("defaultDeliveryTimeMinutes" BETWEEN 0 AND 1439);
ALTER TABLE "Company" ADD CONSTRAINT company_working_days  CHECK (cardinality("workingDays") > 0);
ALTER TABLE "CompanyDomain" ADD CONSTRAINT domain_lowercase CHECK (domain = lower(domain));
ALTER TABLE "Employee"      ADD CONSTRAINT employee_email_lowercase CHECK (email = lower(email));
ALTER TABLE "User"          ADD CONSTRAINT user_email_lowercase     CHECK (email = lower(email));

-- Orders
ALTER TABLE "Order"            ADD CONSTRAINT order_total_nonneg      CHECK ("totalCents" >= 0);
ALTER TABLE "Order"            ADD CONSTRAINT order_time_range        CHECK ("deliveryTimeMinutes" BETWEEN 0 AND 1439);
ALTER TABLE "Order"            ADD CONSTRAINT order_kitchen_sequence  CHECK ("kitchenReadyAt" IS NULL OR "kitchenStartedAt" IS NOT NULL);
ALTER TABLE "OrderLine"        ADD CONSTRAINT line_qty_positive       CHECK (quantity >= 1);
ALTER TABLE "OrderCombination" ADD CONSTRAINT combo_qty_positive      CHECK (quantity >= 1);
ALTER TABLE "OrderCombination" ADD CONSTRAINT combo_total_consistent  CHECK ("totalCents" = "unitPriceCents" * quantity);
ALTER TABLE "OrderCombination" ADD CONSTRAINT combo_prep_sequence     CHECK ("prepDoneAt" IS NULL OR "prepStartedAt" IS NOT NULL);

-- Fulfilment (stage ordering as defence in depth for BR-DSP-02..04)
ALTER TABLE "Drop" ADD CONSTRAINT drop_stage_sequence CHECK (
      ("outForDeliveryAt" IS NULL OR ("dispatchReadyAt" IS NOT NULL AND "driverId" IS NOT NULL))
  AND ("deliveredAt"      IS NULL OR "outForDeliveryAt" IS NOT NULL));

-- Billing
ALTER TABLE "InvoiceLine"     ADD CONSTRAINT invoice_line_reference CHECK (
     ("kind" = 'ORDER'      AND "orderId" IS NOT NULL AND "adjustmentId" IS NULL)
  OR ("kind" = 'ADJUSTMENT' AND "adjustmentId" IS NOT NULL AND "orderId" IS NULL));
ALTER TABLE "OrderAdjustment" ADD CONSTRAINT adjustment_nonzero CHECK ("amountCents" <> 0);
