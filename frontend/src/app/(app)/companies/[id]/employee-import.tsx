'use client';

import {
  type CompanyDetail,
  EMPLOYEE_CSV_COLUMNS,
  EMPLOYEE_CSV_TEMPLATE,
  type EmployeeImportResult,
} from '@fernleaf/shared';
import { CheckCircle2, Download, FileUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError, api } from '@/lib/api-client';

/**
 * FR-EMP-03: import employees from a CSV file. Valid rows are created; every problem is listed by
 * row and column, and a bad row never stops the others.
 */
export function EmployeeImport({
  company,
  onImported,
  onClose,
}: {
  company: CompanyDetail;
  onImported: () => void;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<EmployeeImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function downloadTemplate() {
    // The example rows use this company's own domain, so the template imports as-is once edited.
    const domain = company.domains[0]?.domain ?? 'yourcompany.example';
    const blob = new Blob([EMPLOYEE_CSV_TEMPLATE.replaceAll('yourcompany.example', domain)], {
      type: 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employees-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function upload(file: File) {
    setFileName(file.name);
    setResult(null);
    setError(null);
    if (file.size > 1_000_000) {
      setError('The file is larger than 1 MB.');
      return;
    }
    setBusy(true);
    try {
      const res = await api<EmployeeImportResult>(`/companies/${company.id}/employees/import`, {
        method: 'POST',
        body: JSON.stringify({ csv: await file.text() }),
      });
      setResult(res);
      if (res.created > 0) onImported();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The import failed. Try again.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="animate-rise space-y-4 rounded-xl border border-dashed border-primary/40 bg-primary/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-heading text-base font-semibold">Import employees from CSV</h3>
          <p className="text-sm text-muted-foreground">
            One employee per row. Columns: {EMPLOYEE_CSV_COLUMNS.join(', ')}. Lists use “;”, flags
            use yes or no. Valid rows are added even if others have problems.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="size-4" aria-hidden /> Template
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          id="employee-csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button disabled={busy} onClick={() => input.current?.click()}>
          <FileUp className="size-4" aria-hidden /> {busy ? 'Importing…' : 'Choose a CSV file'}
        </Button>
        {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
        <Button variant="ghost" className="ml-auto" onClick={onClose}>
          Close
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="size-4 text-primary" aria-hidden />
            {result.created} employee{result.created === 1 ? '' : 's'} added
            {result.failed.length > 0 &&
              ` · ${result.failed.length} problem${result.failed.length === 1 ? '' : 's'} to fix`}
          </p>
          {result.failed.length > 0 && (
            <div className="max-h-72 overflow-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead className="w-44">Column</TableHead>
                    <TableHead>Problem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.failed.map((f, i) => (
                    <TableRow key={`${f.row}-${f.column}-${i}`}>
                      <TableCell className="tabular-nums">{f.row}</TableCell>
                      <TableCell className="font-mono text-xs">{f.column}</TableCell>
                      <TableCell>{f.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
