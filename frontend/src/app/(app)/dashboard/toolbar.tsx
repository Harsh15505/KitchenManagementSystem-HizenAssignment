'use client';

import { createContext, type ReactNode, useContext } from 'react';
import { createPortal } from 'react-dom';

/**
 * The dashboard's title row has a slot on the right. A section renders its controls (e.g. the
 * kitchen's Today/Tomorrow switch) into it, so they don't cost a row of their own and the important
 * figures stay above the fold.
 */
export const ToolbarSlotContext = createContext<HTMLElement | null>(null);

export function DashboardToolbar({ children }: { children: ReactNode }) {
  const slot = useContext(ToolbarSlotContext);
  return slot ? createPortal(children, slot) : null;
}
