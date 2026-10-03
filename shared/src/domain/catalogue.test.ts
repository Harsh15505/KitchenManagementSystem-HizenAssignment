import { describe, expect, it } from 'vitest';
import { portionViolations } from './catalogue';

describe('FR-CAT-05: options in a portioned group support every group size', () => {
  const jeera = { id: 'jeera', name: 'Jeera rice', supportedSizeIds: new Set(['reg', 'lrg']) };
  const brown = { id: 'brown', name: 'Brown rice', supportedSizeIds: new Set(['reg']) };

  it('accepts options that support all sizes', () => {
    expect(portionViolations(['reg', 'lrg'], [jeera])).toEqual([]);
  });

  it('names each option and the sizes it is missing', () => {
    expect(portionViolations(['reg', 'lrg'], [jeera, brown])).toEqual([
      { optionId: 'brown', optionName: 'Brown rice', missingSizeIds: ['lrg'] },
    ]);
  });

  it('a group without sizes has nothing to violate', () => {
    expect(portionViolations([], [brown])).toEqual([]);
  });
});
