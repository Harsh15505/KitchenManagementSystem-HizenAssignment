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
