import { describe, expect, it } from 'vitest';
import { isOpenApiDocument, parseStructuredData, parseTabularData } from './parse';

describe('structured data parsing', () => {
  it('recognizes OpenAPI 3 documents in JSON and YAML', () => {
    const json = parseStructuredData('{"openapi":"3.1.0","paths":{}}', 'json');
    const yaml = parseStructuredData('openapi: 3.0.3\npaths: {}', 'yml');

    expect(json).toMatchObject({ ok: true, isOpenApi: true });
    expect(yaml).toMatchObject({ ok: true, isOpenApi: true });
    expect(isOpenApiDocument([])).toBe(false);
  });

  it('returns parser failures without throwing', () => {
    expect(parseStructuredData('{', 'json')).toMatchObject({ ok: false });
  });

  it('normalizes CSV cells and reports body row counts', () => {
    expect(parseTabularData('name,count\nSaekim,3\nempty,', 'csv')).toEqual({
      ok: true,
      delimiter: ',',
      fields: ['name', 'count'],
      rows: [['Saekim', '3'], ['empty', '']],
      rowCount: 2,
      truncated: false,
      errors: [],
    });
  });

  it('caps large tabular previews while preserving the total count', () => {
    const source = ['value', ...Array.from({ length: 1002 }, (_, index) => String(index))].join('\n');
    const result = parseTabularData(source, 'csv');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1000);
    expect(result.rowCount).toBe(1002);
    expect(result.truncated).toBe(true);
  });
});
