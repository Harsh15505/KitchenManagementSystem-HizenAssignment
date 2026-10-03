'use client';

import { RequireAbility } from '@/components/require-ability';
import { StaffManager } from './staff-manager';

export default function StaffPage() {
  return (
    <RequireAbility action="read" subject="Staff">
      <StaffManager />
    </RequireAbility>
  );
}
