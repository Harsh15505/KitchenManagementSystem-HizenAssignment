/**
 * FR-CAT-05: a group that sells options in sizes only accepts options that support every one of
 * its sizes. Used when a group is created or edited, and when an option drops a size.
 */
export interface PortionCandidate {
  id: string;
  name: string;
  supportedSizeIds: ReadonlySet<string>;
}

export interface PortionViolation {
  optionId: string;
  optionName: string;
  missingSizeIds: string[];
}

export function portionViolations(
  groupSizeIds: readonly string[],
  options: readonly PortionCandidate[],
): PortionViolation[] {
  return options
    .map((option) => ({
      optionId: option.id,
      optionName: option.name,
      missingSizeIds: groupSizeIds.filter((sizeId) => !option.supportedSizeIds.has(sizeId)),
    }))
    .filter((v) => v.missingSizeIds.length > 0);
}

/**
 * FR-CAT-01: the SKU a new dish gets when the admin leaves the field blank: `FL-` + the first three
 * letters of the name + a running number, e.g. "Paneer Wrap" → FL-PAN-001, the next dish starting
 * with "Pan" → FL-PAN-002. Numbers are never reused, because the highest existing number is the
 * starting point, so an SKU captured on an old order can't later mean another dish.
 */
export function nextSku(name: string, existingSkus: readonly string[]): string {
  const letters = name
    .normalize('NFD')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  const prefix = `FL-${(letters + 'XXX').slice(0, 3)}-`;
  const highest = existingSkus.reduce((max, sku) => {
    if (!sku.startsWith(prefix)) return max;
    const n = Number(sku.slice(prefix.length));
    return Number.isInteger(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}
