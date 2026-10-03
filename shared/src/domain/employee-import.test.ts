import { describe, expect, it } from 'vitest';
import { EMPLOYEE_CSV_TEMPLATE, parseCsv, parseEmployeeCsv } from './employee-import';

const lookups = {
  allergens: new Map([
    ['peanuts', '00000000-0000-4000-8000-000000000001'],
    ['gluten', '00000000-0000-4000-8000-000000000002'],
  ]),
  dietaryTags: new Map([['vegetarian', '00000000-0000-4000-8000-000000000003']]),
};
const HEADER =
  'name,email,phone,allergies,dietary_preferences,can_choose_address,can_change_delivery_time,can_change_packaging';

describe('FR-EMP-03: employee CSV import', () => {
  it('reads quoted fields with commas, escaped quotes and line breaks, keeping file row numbers', () => {
    const rows = parseCsv('a,b\r\n"Rao, Arjun","say ""hi"""\n"two\nlines",x\n\n');
    expect(rows).toEqual([
      { row: 1, cells: ['a', 'b'] },
      { row: 2, cells: ['Rao, Arjun', 'say "hi"'] },
      { row: 3, cells: ['two\nlines', 'x'] },
    ]);
  });

  it('ignores the byte-order mark Excel adds to UTF-8 files', () => {
    expect(parseCsv(String.fromCharCode(0xfeff) + 'name,email')[0]!.cells).toEqual([
      'name',
      'email',
    ]);
  });

  it('the downloadable template imports cleanly', () => {
    const { rows, failed } = parseEmployeeCsv(EMPLOYEE_CSV_TEMPLATE, lookups);
    expect(failed).toEqual([]);
    expect(rows.map((r) => r.input.name)).toEqual(['Priya Sharma', 'Rao, Arjun']);
    expect(rows[0]!.input).toMatchObject({
      email: 'priya.sharma@yourcompany.example',
      allergenIds: ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'],
      dietaryTagIds: ['00000000-0000-4000-8000-000000000003'],
      canChooseAddress: false,
    });
    expect(rows[1]!.input).toMatchObject({ phone: null, canChooseAddress: true });
  });

  it('a bad row is reported with its row, column and message; the other rows still import', () => {
    const csv = [
      HEADER,
      'Ok Person,ok@x.example,,,,no,no,no',
      'B,not-an-email,,Shellfish,,maybe,no,no',
      'Dup,ok@x.example,,,,,,',
    ].join('\n');
    const { rows, failed } = parseEmployeeCsv(csv, lookups);
    expect(rows.map((r) => r.row)).toEqual([2]);
    expect(failed).toEqual(
      expect.arrayContaining([
        { row: 3, column: 'name', message: 'Enter a name' },
        { row: 3, column: 'email', message: 'Enter a valid email' },
        expect.objectContaining({ row: 3, column: 'allergies' }),
        { row: 3, column: 'can_choose_address', message: 'Use yes or no' },
        { row: 4, column: 'email', message: 'Appears twice in this file (also row 2)' },
      ]),
    );
  });

  it('refuses a file whose header lacks name or email, and flags unknown columns', () => {
    expect(parseEmployeeCsv('full_name,mail\nA,b@x.example', lookups).failed[0]).toMatchObject({
      row: 1,
      column: 'header',
    });
    const { rows, failed } = parseEmployeeCsv(
      'Name,Email,Shoe Size\nAsha Rao,asha@x.example,9',
      lookups,
    );
    expect(rows).toHaveLength(1);
    expect(failed).toEqual([{ row: 1, column: 'shoe_size', message: 'Unknown column (ignored)' }]);
  });
});
