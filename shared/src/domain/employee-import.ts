import { createEmployeeSchema, type CreateEmployeeInput } from '../contracts/employees';

/**
 * FR-EMP-03: employee CSV import. Pure: parses the file, validates every row with the same schema
 * as the "Add employee" form, and reports `{ row, column, message }` for each problem. A bad row
 * never rejects the file; the API creates the valid rows and re-checks domain and uniqueness.
 */

export const EMPLOYEE_CSV_COLUMNS = [
  'name',
  'email',
  'phone',
  'allergies',
  'dietary_preferences',
  'can_choose_address',
  'can_change_delivery_time',
  'can_change_packaging',
] as const;
type Column = (typeof EMPLOYEE_CSV_COLUMNS)[number];

export const EMPLOYEE_CSV_MAX_ROWS = 1000;

/** The downloadable template: the header, then two example rows (lists use ";"). */
export const EMPLOYEE_CSV_TEMPLATE = [
  EMPLOYEE_CSV_COLUMNS.join(','),
  'Priya Sharma,priya.sharma@yourcompany.example,+91 98765 43210,Peanuts;Gluten,Vegetarian,no,no,no',
  '"Rao, Arjun",arjun.rao@yourcompany.example,,,,yes,yes,no',
  '',
].join('\n');

export interface ImportRowError {
  /** Line number in the file; the header is row 1. */
  row: number;
  column: string;
  message: string;
}

export interface ParsedEmployeeRow {
  row: number;
  input: Omit<CreateEmployeeInput, 'companyId'>;
}

/** RFC 4180 subset: commas, quoted fields with "" escapes and line breaks, LF or CRLF. */
export function parseCsv(text: string): Array<{ row: number; cells: string[] }> {
  const records: Array<{ row: number; cells: string[] }> = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let startLine = 1;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else {
        if (ch === '\n') line++;
        cell += ch;
      }
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      cells.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      cells.push(cell);
      records.push({ row: startLine, cells });
      cells = [];
      cell = '';
      line++;
      startLine = line;
    } else cell += ch;
  }
  if (cell !== '' || cells.length > 0) {
    cells.push(cell);
    records.push({ row: startLine, cells });
  }
  return records.filter((r) => r.cells.some((c) => c.trim() !== ''));
}

const FIELD_COLUMN: Record<string, Column> = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  allergenIds: 'allergies',
  dietaryTagIds: 'dietary_preferences',
  canChooseAddress: 'can_choose_address',
  canChangeDeliveryTime: 'can_change_delivery_time',
  canChangePackaging: 'can_change_packaging',
};

function flag(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (v === '' || v === 'no' || v === 'n' || v === 'false' || v === '0') return false;
  if (v === 'yes' || v === 'y' || v === 'true' || v === '1') return true;
  return null;
}

/**
 * @param lookups reference names, lower-cased, to ids (active allergens and dietary tags)
 */
export function parseEmployeeCsv(
  text: string,
  lookups: { allergens: ReadonlyMap<string, string>; dietaryTags: ReadonlyMap<string, string> },
): { rows: ParsedEmployeeRow[]; failed: ImportRowError[] } {
  const records = parseCsv(text);
  const failed: ImportRowError[] = [];
  const header = records[0];
  if (!header)
    return { rows: [], failed: [{ row: 1, column: 'file', message: 'The file is empty' }] };

  const names = header.cells.map((c) =>
    c
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_'),
  );
  const index = new Map<Column, number>();
  names.forEach((name, i) => {
    if ((EMPLOYEE_CSV_COLUMNS as readonly string[]).includes(name)) index.set(name as Column, i);
    else if (name)
      failed.push({ row: header.row, column: name, message: 'Unknown column (ignored)' });
  });
  if (!index.has('name') || !index.has('email')) {
    return {
      rows: [],
      failed: [
        {
          row: header.row,
          column: 'header',
          message: `The first row must name the columns; "name" and "email" are required. Expected: ${EMPLOYEE_CSV_COLUMNS.join(', ')}`,
        },
      ],
    };
  }
  const body = records.slice(1);
  if (body.length > EMPLOYEE_CSV_MAX_ROWS) {
    return {
      rows: [],
      failed: [
        {
          row: 1,
          column: 'file',
          message: `At most ${EMPLOYEE_CSV_MAX_ROWS} employees per file (found ${body.length})`,
        },
      ],
    };
  }

  const rows: ParsedEmployeeRow[] = [];
  const seen = new Map<string, number>();
  for (const record of body) {
    const errors: ImportRowError[] = [];
    const get = (c: Column) => (index.has(c) ? (record.cells[index.get(c)!] ?? '').trim() : '');
    const add = (column: string, message: string) =>
      errors.push({ row: record.row, column, message });

    const list = (column: Column, lookup: ReadonlyMap<string, string>, what: string) =>
      get(column)
        .split(/[;|]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .flatMap((name) => {
          const id = lookup.get(name.toLowerCase());
          if (!id)
            add(column, `Unknown ${what} "${name}" (use the names in Settings → Reference data)`);
          return id ? [id] : [];
        });
    const flagOf = (column: Column) => {
      const v = flag(get(column));
      if (v === null) add(column, 'Use yes or no');
      return v ?? false;
    };

    const candidate = {
      name: get('name'),
      email: get('email'),
      phone: get('phone') || null,
      canChooseAddress: flagOf('can_choose_address'),
      canChangeDeliveryTime: flagOf('can_change_delivery_time'),
      canChangePackaging: flagOf('can_change_packaging'),
      allergenIds: [...new Set(list('allergies', lookups.allergens, 'allergen'))],
      dietaryTagIds: [
        ...new Set(list('dietary_preferences', lookups.dietaryTags, 'dietary preference')),
      ],
      isActive: true,
    };
    const parsed = createEmployeeSchema.omit({ companyId: true }).safeParse(candidate);
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        add(FIELD_COLUMN[String(issue.path[0])] ?? String(issue.path[0]), issue.message);

    if (parsed.success) {
      const first = seen.get(parsed.data.email);
      if (first) add('email', `Appears twice in this file (also row ${first})`);
      else seen.set(parsed.data.email, record.row);
    }
    if (errors.length > 0 || !parsed.success) failed.push(...errors);
    else rows.push({ row: record.row, input: parsed.data });
  }
  return { rows, failed };
}
