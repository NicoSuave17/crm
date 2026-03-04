import Papa from "papaparse";

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
  errors: Papa.ParseError[];
}

export function parseCsvFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        resolve({
          headers: results.meta.fields ?? [],
          rows: results.data as Record<string, string>[],
          rowCount: results.data.length,
          errors: results.errors,
        });
      },
      error: (error) => reject(error),
    });
  });
}
