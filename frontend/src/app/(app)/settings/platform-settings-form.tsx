'use client';

import {
  hhmmToMinutes,
  minutesToHHmm,
  type PlatformSettingsDto,
  type UpdateSettingsInput,
} from '@fernleaf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, api } from '@/lib/api-client';
import { useAbility } from '@/lib/auth';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Form state keeps times as "HH:mm" strings; the API stores minutes after midnight. */
interface FormState {
  kitchenWorkingDays: number[];
  cutoffTime: string;
  cutoffWorkingDays: number;
  kitchenBufferMinutes: number;
  atRiskWindowMinutes: number;
  onTimeGraceMinutes: number;
  windowStart: string;
  windowEnd: string;
  deliverySlotMinutes: number;
  defaultDispatchLeadMin: number;
  autoCutoffEnabled: boolean;
  demoAutopilotEnabled: boolean;
}

const toForm = (s: PlatformSettingsDto): FormState => ({
  kitchenWorkingDays: s.kitchenWorkingDays,
  cutoffTime: minutesToHHmm(s.cutoffTimeMinutes),
  cutoffWorkingDays: s.cutoffWorkingDays,
  kitchenBufferMinutes: s.kitchenBufferMinutes,
  atRiskWindowMinutes: s.atRiskWindowMinutes,
  onTimeGraceMinutes: s.onTimeGraceMinutes,
  windowStart: minutesToHHmm(s.deliveryWindowStartMin),
  windowEnd: minutesToHHmm(s.deliveryWindowEndMin),
  deliverySlotMinutes: s.deliverySlotMinutes,
  defaultDispatchLeadMin: s.defaultDispatchLeadMin,
  autoCutoffEnabled: s.autoCutoffEnabled,
  demoAutopilotEnabled: s.demoAutopilotEnabled,
});

const toInput = (f: FormState): UpdateSettingsInput => ({
  kitchenWorkingDays: f.kitchenWorkingDays,
  cutoffTimeMinutes: hhmmToMinutes(f.cutoffTime),
  cutoffWorkingDays: f.cutoffWorkingDays,
  kitchenBufferMinutes: f.kitchenBufferMinutes,
  atRiskWindowMinutes: f.atRiskWindowMinutes,
  onTimeGraceMinutes: f.onTimeGraceMinutes,
  deliveryWindowStartMin: hhmmToMinutes(f.windowStart),
  deliveryWindowEndMin: hhmmToMinutes(f.windowEnd),
  deliverySlotMinutes: f.deliverySlotMinutes,
  defaultDispatchLeadMin: f.defaultDispatchLeadMin,
  autoCutoffEnabled: f.autoCutoffEnabled,
  demoAutopilotEnabled: f.demoAutopilotEnabled,
});

export function PlatformSettingsForm() {
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<PlatformSettingsDto>('/settings'),
  });
  if (!settings.data) return <Skeleton className="h-72 w-full" />;
  // Keyed by updatedAt: after a save the editor re-initialises from the server's values.
  return <SettingsEditor key={settings.data.updatedAt} initial={settings.data} />;
}

function SettingsEditor({ initial }: { initial: PlatformSettingsDto }) {
  const canEdit = useAbility().can('update', 'Settings');
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => toForm(initial));

  const save = useMutation({
    mutationFn: (input: UpdateSettingsInput) =>
      api<PlatformSettingsDto>('/settings', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['settings'], saved);
      toast.success('Settings saved');
    },
    onError: (error) => {
      const first =
        error instanceof ApiError ? Object.values(error.fieldErrors ?? {})[0]?.[0] : undefined;
      toast.error(first ?? (error instanceof ApiError ? error.message : 'Could not save settings'));
    },
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm({ ...form, [key]: value });
  const num = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(key, Number(e.target.value) as never);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kitchen calendar &amp; cut-off</CardTitle>
        <CardDescription>
          Time zone: {initial.kitchenTimezone} (fixed). Orders for a delivery date lock at the
          cut-off time on the Nth kitchen working day before it; kitchen holidays and non-working
          days are skipped when counting back.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(toInput(form));
          }}
        >
          <fieldset disabled={!canEdit || save.isPending} className="space-y-6">
            <div className="space-y-2">
              <Label>Kitchen working days</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((label, index) => {
                  const day = index + 1;
                  const on = form.kitchenWorkingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set(
                          'kitchenWorkingDays',
                          on
                            ? form.kitchenWorkingDays.filter((d) => d !== day)
                            : [...form.kitchenWorkingDays, day],
                        )
                      }
                      className={cn(
                        'h-9 w-12 rounded-md border text-sm',
                        on ? 'bg-primary text-primary-foreground' : 'bg-background',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Cut-off time (IST)">
                <Input
                  type="time"
                  value={form.cutoffTime}
                  onChange={(e) => set('cutoffTime', e.target.value)}
                />
              </Field>
              <Field label="Cut-off: kitchen working days before">
                <Input
                  type="number"
                  min={0}
                  max={14}
                  value={form.cutoffWorkingDays}
                  onChange={num('cutoffWorkingDays')}
                />
              </Field>
              <Field label="Delivery window opens">
                <Input
                  type="time"
                  value={form.windowStart}
                  onChange={(e) => set('windowStart', e.target.value)}
                />
              </Field>
              <Field label="Delivery window closes">
                <Input
                  type="time"
                  value={form.windowEnd}
                  onChange={(e) => set('windowEnd', e.target.value)}
                />
              </Field>
              <Field label="Delivery slot (minutes)">
                <Input
                  type="number"
                  min={5}
                  max={120}
                  value={form.deliverySlotMinutes}
                  onChange={num('deliverySlotMinutes')}
                />
              </Field>
              <Field label="Kitchen buffer before dispatch (min)">
                <Input
                  type="number"
                  min={0}
                  value={form.kitchenBufferMinutes}
                  onChange={num('kitchenBufferMinutes')}
                />
              </Field>
              <Field label="At-risk warning window (min)">
                <Input
                  type="number"
                  min={0}
                  value={form.atRiskWindowMinutes}
                  onChange={num('atRiskWindowMinutes')}
                />
              </Field>
              <Field label="On-time grace (min)">
                <Input
                  type="number"
                  min={0}
                  value={form.onTimeGraceMinutes}
                  onChange={num('onTimeGraceMinutes')}
                />
              </Field>
              <Field label="Default dispatch lead for new companies (min)">
                <Input
                  type="number"
                  min={0}
                  value={form.defaultDispatchLeadMin}
                  onChange={num('defaultDispatchLeadMin')}
                />
              </Field>
            </div>

            <div className="space-y-2">
              <Toggle
                label="Process cut-offs automatically"
                hint="When off, orders still lock at the cut-off; an admin runs processing from the Cut-off page."
                checked={form.autoCutoffEnabled}
                onChange={(v) => set('autoCutoffEnabled', v)}
              />
              <Toggle
                label="Demo autopilot"
                hint="Moves today's seeded demo orders through the kitchen and dispatch with the clock."
                checked={form.demoAutopilotEnabled}
                onChange={(v) => set('demoAutopilotEnabled', v)}
              />
            </div>
          </fieldset>
          {canEdit && (
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save settings'}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        className="mt-1 size-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}
