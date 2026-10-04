import { describe, expect, it } from 'vitest';
import { nextSku, portionViolations } from './catalogue';

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

describe('FR-CAT-01: automatic SKU for a new dish', () => {
  it('uses the first three letters of the name and starts at 001', () => {
    expect(nextSku('Paneer Wrap', [])).toBe('FL-PAN-001');
  });

  it('continues after the highest number for that prefix and ignores other prefixes', () => {
    expect(nextSku('Paneer Kathi Roll', ['FL-PAN-001', 'FL-PAN-007', 'FL-BWL-009'])).toBe(
      'FL-PAN-008',
    );
  });

  it('never reuses a number, even when a lower one is free', () => {
    expect(nextSku('Poha', ['FL-POH-003'])).toBe('FL-POH-004');
  });

  it('copes with accents, digits, short names and non-numeric tails', () => {
    expect(nextSku('Crème Brûlée', [])).toBe('FL-CRE-001');
    expect(nextSku('7 Up', [])).toBe('FL-UPX-001');
    expect(nextSku('Ab', [])).toBe('FL-ABX-001');
    expect(nextSku('', ['FL-XXX-ODD'])).toBe('FL-XXX-001');
  });
});
