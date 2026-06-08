import Papa from 'papaparse';
import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';

export type StructuredLanguage = 'json' | 'yaml' | 'toml';
export type TabularLanguage = 'csv' | 'tsv';

export interface ParseFailure {
  ok: false;
  error: string;
}

export interface StructuredSuccess {
  ok: true;
  data: unknown;
  isOpenApi: boolean;
}

export interface TabularSuccess {
  ok: true;
  delimiter: ',' | '\t';
  fields: string[];
  rows: string[][];
  rowCount: number;
  truncated: boolean;
  errors: string[];
}

export type StructuredParseResult = StructuredSuccess | ParseFailure;
export type TabularParseResult = TabularSuccess | ParseFailure;

const MAX_TABLE_ROWS = 1000;

export function parseStructuredData(source: string, language: string): StructuredParseResult {
  try {
    const data = parseStructuredSource(source, normalizeStructuredLanguage(language));
    return {
      ok: true,
      data,
      isOpenApi: isOpenApiDocument(data),
    };
  } catch (error) {
    return {
      ok: false,
      error: formatParseError(error),
    };
  }
}

export function parseTabularData(source: string, language: string): TabularParseResult {
  const delimiter = normalizeTabularLanguage(language) === 'tsv' ? '\t' : ',';
  const parsed = Papa.parse<string[]>(source, {
    delimiter,
    skipEmptyLines: false,
  });

  if (parsed.errors.some((error) => error.type === 'Quotes')) {
    return {
      ok: false,
      error: parsed.errors.map((error) => error.message).join('\n'),
    };
  }

  const rows = parsed.data.filter((row, index, allRows) => {
    const isLastEmptyRow = index === allRows.length - 1 && row.length === 1 && row[0] === '';
    return !isLastEmptyRow;
  });

  const fields = normalizeRow(rows[0] ?? []);
  const bodyRows = rows.slice(1).map(normalizeRow);
  const visibleRows = bodyRows.slice(0, MAX_TABLE_ROWS);

  return {
    ok: true,
    delimiter,
    fields,
    rows: visibleRows,
    rowCount: bodyRows.length,
    truncated: bodyRows.length > visibleRows.length,
    errors: parsed.errors.map((error) => error.message),
  };
}

export function isOpenApiDocument(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.openapi === 'string' && value.openapi.startsWith('3.') && isRecord(value.paths);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStructuredSource(source: string, language: StructuredLanguage): unknown {
  if (language === 'json') return JSON.parse(source);
  if (language === 'yaml') return parseYaml(source);
  return parseToml(source);
}

function normalizeStructuredLanguage(language: string): StructuredLanguage {
  if (language === 'yaml' || language === 'yml') return 'yaml';
  if (language === 'toml') return 'toml';
  return 'json';
}

function normalizeTabularLanguage(language: string): TabularLanguage {
  return language === 'tsv' ? 'tsv' : 'csv';
}

function normalizeRow(row: unknown[]): string[] {
  return row.map((cell) => (cell === null || cell === undefined ? '' : String(cell)));
}

function formatParseError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
