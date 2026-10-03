'use client';

import { centsToInput, parseUsd } from '@fernleaf/shared';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

/**
 * Dollar input that hands integer cents to the form. Parsing is string-based (parseUsd), never
 * parseFloat × 100, so "0.29" is exactly 29 cents (NFR-01).
 */
export function MoneyInput({
  valueCents,
  onChangeCents,
  id,
  invalid,
  disabled,
}: {
  valueCents: number | null;
  onChangeCents: (cents: number | null) => void;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState(valueCents === null ? '' : centsToInput(valueCents));
  const parsed = text.trim() === '' ? null : parseUsd(text);
  const showError = invalid || (text.trim() !== '' && parsed === null);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        $
      </span>
      <Input
        id={id}
        inputMode="decimal"
        className="pl-6"
        value={text}
        disabled={disabled}
        aria-invalid={showError}
        onChange={(e) => {
          setText(e.target.value);
          onChangeCents(e.target.value.trim() === '' ? null : parseUsd(e.target.value));
        }}
        onBlur={() => {
          if (parsed !== null) setText(centsToInput(parsed));
        }}
      />
    </div>
  );
}
