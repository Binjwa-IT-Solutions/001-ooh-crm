'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/shared/ui';
import { sitesApi } from '@/modules/sites/api';

interface CSVRow {
  siteCode: string;
  city: string;
  type: string;
  address: string;
  gps: string;
  width: string;
  height: string;
  baseCostPerDay: string;
  vendorId: string;
}

export default function ImportSitesPage() {
  const router = useRouter();
  const [csvContent, setCsvContent] = useState<string>('');
  const [validRows, setValidRows] = useState<CSVRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<{row: any, reason: string}[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{imported: number, errors: string[]} | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportResult(null);
    setValidRows([]);
    setInvalidRows([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleParse = () => {
    setIsParsing(true);
    setImportResult(null);
    try {
      const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        throw new Error('CSV must contain a header row and at least one data row.');
      }

      // Expected headers (simplified exact match for this basic parser)
      // siteCode,city,type,address,gps,width,height,baseCostPerDay,vendorId
      const headers = lines[0].split(',').map(h => h.trim());
      
      const vRows: CSVRow[] = [];
      const iRows: {row: any, reason: string}[] = [];

      for (let i = 1; i < lines.length; i++) {
        // Basic split, won't handle commas inside quotes
        const values = lines[i].split(',').map(v => v.trim());
        const rowData: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowData[h] = values[idx] || '';
        });

        // Basic validation
        if (!rowData.siteCode) {
          iRows.push({ row: rowData, reason: 'Missing siteCode' });
          continue;
        }
        if (!rowData.vendorId) {
          iRows.push({ row: rowData, reason: 'Missing vendorId' });
          continue;
        }
        if (!rowData.baseCostPerDay || isNaN(Number(rowData.baseCostPerDay))) {
          iRows.push({ row: rowData, reason: 'Invalid baseCostPerDay' });
          continue;
        }
        if (!rowData.city || !rowData.type || !rowData.address) {
          iRows.push({ row: rowData, reason: 'Missing required location details' });
          continue;
        }

        vRows.push(rowData as unknown as CSVRow);
      }

      setValidRows(vRows);
      setInvalidRows(iRows);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to parse CSV');
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setIsSubmitting(true);
    try {
      // Map back to API format
      const payload = validRows.map(r => ({
        ...r,
        width: r.width ? Number(r.width) : undefined,
        height: r.height ? Number(r.height) : undefined,
        baseCostPerDay: Number(r.baseCostPerDay)
      }));

      const result = await sitesApi.bulkImport(payload as any);
      setImportResult(result);
      if (result.errors.length === 0 && result.imported > 0) {
        // success
        setTimeout(() => router.push('/sites'), 2000);
      }
    } catch (err: unknown) {
      alert('Import failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Import Sites</h1>
        <p className="text-sm text-slate-500">Upload a CSV file to bulk import sites.</p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Import Media Plan</h1>
        <p className="text-sm text-slate-500">Upload a CSV file to bulk import media plan inventory.</p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select CSV File</label>
          <input 
            type="file" 
            accept=".csv"
            onChange={handleFileSelect}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
        </div>

        {csvContent && (
          <div>
            <Button variant="secondary" onClick={handleParse} isLoading={isParsing}>Parse CSV</Button>
          </div>
        )}
      </Card>

      {(validRows.length > 0 || invalidRows.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 border-green-200 bg-green-50/30">
            <h3 className="text-lg font-medium text-green-800">Valid Rows ({validRows.length})</h3>
            <ul className="mt-4 space-y-2 text-sm text-green-700 max-h-60 overflow-y-auto">
              {validRows.map((r, i) => (
                <li key={i}>{r.siteCode} - {r.city} (Vendor: {r.vendorId})</li>
              ))}
            </ul>
            {validRows.length > 0 && !importResult && (
              <div className="mt-6">
                <Button variant="primary" onClick={handleImport} isLoading={isSubmitting}>Confirm Import</Button>
              </div>
            )}
          </Card>

          <Card className="p-6 border-red-200 bg-red-50/30">
            <h3 className="text-lg font-medium text-red-800">Invalid Rows ({invalidRows.length})</h3>
            <ul className="mt-4 space-y-2 text-sm text-red-700 max-h-60 overflow-y-auto">
              {invalidRows.map((r, i) => (
                <li key={i}>
                  <strong>Error:</strong> {r.reason} <br/>
                  <span className="text-xs text-red-500/80">Row Data: {JSON.stringify(r.row)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {importResult && (
        <Card className="p-6 border-blue-200 bg-blue-50">
          <h3 className="text-lg font-medium text-blue-800">Import Results</h3>
          <p className="mt-2 text-blue-700">Successfully imported: <strong>{importResult.imported}</strong> sites.</p>
          {importResult.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-red-800 mb-2">Errors during import (e.g. duplicates):</p>
              <ul className="list-disc list-inside text-sm text-red-700">
                {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
