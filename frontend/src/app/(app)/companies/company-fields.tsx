'use client';

import {
  type CompanyDetail,
  type DriverOption,
  hhmmToMinutes,
  minutesToHHmm,
  type PriceTierDto,
} from '@fernleaf/shared';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { WeekdayPicker } from '@/components/weekday-picker';
import { api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { useReferenceList } from '@/lib/reference';

/** The editable company settings, as form text (FR-CMP-01/02/03/04). */
export interface CompanyFieldsState {
  name: string;
  priceTierId: string;
  billingContactName: string;
  billingEmail: string;
  billingPhone: string;
  billingAddress: string;
  workingDays: number[];
  defaultDeliveryTime: string;
  dispatchLeadMinutes: string;
  defaultPackagingTypeId: string;
  driverInstructions: string;
  defaultDriverId: string;
}

export function companyFieldsFrom(c?: CompanyDetail): CompanyFieldsState {
  return {
    name: c?.name ?? '',
    priceTierId: c?.priceTier?.id ?? '',
    billingContactName: c?.billingContactName ?? '',
    billingEmail: c?.billingEmail ?? '',
    billingPhone: c?.billingPhone ?? '',
    billingAddress: c?.billingAddress ?? '',
    workingDays: c?.workingDays ?? [1, 2, 3, 4, 5],
    defaultDeliveryTime: minutesToHHmm(c?.defaultDeliveryTimeMinutes ?? 750),
    dispatchLeadMinutes: String(c?.dispatchLeadMinutes ?? 60),
    defaultPackagingTypeId: c?.defaultPackagingType.id ?? '',
    driverInstructions: c?.driverInstructions ?? '',
    defaultDriverId: c?.defaultDriver?.id ?? '',
  };
}

/** Form text → API body (the server validates again). */
export function companyFieldsBody(f: CompanyFieldsState) {
  return {
    name: f.name,
    priceTierId: f.priceTierId || null,
    billingContactName: f.billingContactName,
    billingEmail: f.billingEmail,
    billingPhone: f.billingPhone.trim() || null,
    billingAddress: f.billingAddress,
    workingDays: f.workingDays,
    defaultDeliveryTimeMinutes: hhmmToMinutes(f.defaultDeliveryTime),
    dispatchLeadMinutes: Number(f.dispatchLeadMinutes),
    defaultPackagingTypeId: f.defaultPackagingTypeId,
    driverInstructions: f.driverInstructions,
    defaultDriverId: f.defaultDriverId || null,
  };
}

function Field({
  id,
  label,
  error,
  children,
  wide,
}: {
  id?: string;
  label: string;
  error?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'space-y-1 md:col-span-2' : 'space-y-1'}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function CompanyFields({
  value,
  onChange,
  errors,
}: {
  value: CompanyFieldsState;
  onChange: (next: CompanyFieldsState) => void;
  errors: Record<string, string[] | undefined>;
}) {
  const canReadPricing = useAbility().can('read', 'Pricing');
  const tiers = useQuery({
    queryKey: ['price-tiers'],
    queryFn: () => api<PriceTierDto[]>('/price-tiers'),
    enabled: canReadPricing,
  });
  const drivers = useQuery({
    queryKey: ['driver-options'],
    queryFn: () => api<DriverOption[]>('/companies/driver-options'),
  });
  const packaging = useReferenceList('packaging-types');
  const set = <K extends keyof CompanyFieldsState>(key: K, v: CompanyFieldsState[K]) =>
    onChange({ ...value, [key]: v });
  const err = (key: string) => errors[key]?.[0];
  const defaultTier = tiers.data?.find((t) => t.isDefault);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="co-name" label="Company name" error={err('name')}>
          <Input id="co-name" value={value.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field id="co-tier" label="Price tier" error={err('priceTierId')}>
          <NativeSelect
            id="co-tier"
            className="w-full"
            value={value.priceTierId}
            onChange={(e) => set('priceTierId', e.target.value)}
          >
            <NativeSelectOption value="">
              Default tier{defaultTier ? ` (${defaultTier.name})` : ''}
            </NativeSelectOption>
            {tiers.data?.map((t) => (
              <NativeSelectOption key={t.id} value={t.id}>
                {t.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Billing contact</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="co-bname" label="Name" error={err('billingContactName')}>
            <Input
              id="co-bname"
              value={value.billingContactName}
              onChange={(e) => set('billingContactName', e.target.value)}
            />
          </Field>
          <Field id="co-bemail" label="Email" error={err('billingEmail')}>
            <Input
              id="co-bemail"
              type="email"
              value={value.billingEmail}
              onChange={(e) => set('billingEmail', e.target.value)}
            />
          </Field>
          <Field id="co-bphone" label="Phone (optional)" error={err('billingPhone')}>
            <Input
              id="co-bphone"
              value={value.billingPhone}
              onChange={(e) => set('billingPhone', e.target.value)}
            />
          </Field>
          <Field id="co-baddr" label="Billing address" error={err('billingAddress')}>
            <Input
              id="co-baddr"
              value={value.billingAddress}
              onChange={(e) => set('billingAddress', e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Calendar and delivery defaults</h3>
        <div className="space-y-4">
          <Field label="Working days (deliveries only on these days)" error={err('workingDays')}>
            <WeekdayPicker
              label="Working days"
              value={value.workingDays}
              onChange={(days) => set('workingDays', days)}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="co-time" label="Default delivery time (IST)">
              <Input
                id="co-time"
                type="time"
                step={900}
                value={value.defaultDeliveryTime}
                onChange={(e) => set('defaultDeliveryTime', e.target.value)}
              />
            </Field>
            <Field
              id="co-lead"
              label="Dispatch lead (minutes before delivery it leaves the kitchen)"
              error={err('dispatchLeadMinutes')}
            >
              <Input
                id="co-lead"
                type="number"
                min={0}
                value={value.dispatchLeadMinutes}
                onChange={(e) => set('dispatchLeadMinutes', e.target.value)}
              />
            </Field>
            <Field id="co-pack" label="Default packaging" error={err('defaultPackagingTypeId')}>
              <NativeSelect
                id="co-pack"
                className="w-full"
                value={value.defaultPackagingTypeId}
                onChange={(e) => set('defaultPackagingTypeId', e.target.value)}
              >
                <NativeSelectOption value="">Choose…</NativeSelectOption>
                {packaging.data
                  ?.filter((p) => p.isActive || p.id === value.defaultPackagingTypeId)
                  .map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                      {p.name}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </Field>
            <Field id="co-driver" label="Default driver" error={err('defaultDriverId')}>
              <NativeSelect
                id="co-driver"
                className="w-full"
                value={value.defaultDriverId}
                onChange={(e) => set('defaultDriverId', e.target.value)}
              >
                <NativeSelectOption value="">None (dispatch assigns)</NativeSelectOption>
                {drivers.data?.map((d) => (
                  <NativeSelectOption key={d.id} value={d.id}>
                    {d.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field id="co-instr" label="Standing driver instructions" wide>
              <Input
                id="co-instr"
                placeholder="Reception on 3F, ask for the pantry lead"
                value={value.driverInstructions}
                onChange={(e) => set('driverInstructions', e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}
