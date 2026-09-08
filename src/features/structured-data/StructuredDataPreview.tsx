import { useEffect, useMemo, useState } from 'react';
import type { FileTypeInfo } from '../../core/document/fileType';
import { isRecord, parseStructuredData, parseTabularData } from './parse';
import { useI18n } from '../../i18n/useI18n';
import { translateCurrent } from '../../i18n/current';

type StructuredMode = 'tree' | 'api' | 'raw';
type TabularMode = 'table' | 'raw';

interface StructuredDataPreviewProps {
  content: string;
  fileType: FileTypeInfo;
  fileKey?: string;
}

export function StructuredDataPreview({ content, fileType, fileKey }: StructuredDataPreviewProps) {
  const { t } = useI18n();
  const parsed = useMemo(() => parseStructuredData(content, fileType.language), [content, fileType.language]);
  const defaultMode: StructuredMode = parsed.ok && parsed.isOpenApi ? 'api' : 'tree';
  const [mode, setMode] = useState<StructuredMode>(defaultMode);
  const activeMode = parsed.ok && mode === 'api' && !parsed.isOpenApi ? 'tree' : mode;

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode, fileKey]);

  if (activeMode === 'raw') return <RawPreview content={content} />;

  return (
    <div className="structured-preview">
      <PreviewModeTabs
        options={[
          ...(parsed.ok && parsed.isOpenApi ? [{ id: 'api', label: 'API' }] : []),
          { id: 'tree', label: t('structured.tree') },
          { id: 'raw', label: t('structured.raw') },
        ]}
        value={activeMode}
        onChange={(value) => setMode(value as StructuredMode)}
      />
      {!parsed.ok ? (
        <>
          <PreviewErrorPanel title={t('structured.parseFailed', { type: fileType.label.toUpperCase() })} message={parsed.error} />
          <RawPreview content={content} compact />
        </>
      ) : activeMode === 'api' ? (
        <OpenApiPreview data={parsed.data} />
      ) : (
        <TreePreview data={parsed.data} />
      )}
    </div>
  );
}

export function TabularDataPreview({ content, fileType }: StructuredDataPreviewProps) {
  const { t } = useI18n();
  const parsed = useMemo(() => parseTabularData(content, fileType.language), [content, fileType.language]);
  const [mode, setMode] = useState<TabularMode>('table');

  if (mode === 'raw') return <RawPreview content={content} />;

  return (
    <div className="structured-preview tabular-preview">
      <PreviewModeTabs
        options={[
          { id: 'table', label: t('structured.table') },
          { id: 'raw', label: t('structured.raw') },
        ]}
        value={mode}
        onChange={(value) => setMode(value as TabularMode)}
      />
      {!parsed.ok ? (
        <>
          <PreviewErrorPanel title={t('structured.parseFailed', { type: fileType.label.toUpperCase() })} message={parsed.error} />
          <RawPreview content={content} compact />
        </>
      ) : (
        <DataTablePreview parsed={parsed} />
      )}
    </div>
  );
}

function PreviewModeTabs({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="preview-mode-tabs" aria-label={t('preview.mode')}>
      {options.map((option) => (
        <button className={option.id === value ? 'active' : ''} type="button" key={option.id} onClick={() => onChange(option.id)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TreePreview({ data }: { data: unknown }) {
  return (
    <div className="tree-preview">
      <TreeNode name="root" value={data} path="root" depth={0} defaultOpen />
    </div>
  );
}

function TreeNode({
  name,
  value,
  path,
  depth,
  defaultOpen = false,
}: {
  name: string;
  value: unknown;
  path: string;
  depth: number;
  defaultOpen?: boolean;
}) {
  const { t } = useI18n();
  const expandable = isRecord(value) || Array.isArray(value);
  const [open, setOpen] = useState(defaultOpen || depth < 2);
  const entries = getTreeEntries(value);

  return (
    <div className="tree-node">
      <div className="tree-row" style={{ paddingLeft: depth * 16 }}>
        {expandable ? (
          <button className="tree-toggle" type="button" aria-label={open ? t('structured.collapse') : t('structured.expand')} onClick={() => setOpen((state) => !state)}>
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tree-toggle-placeholder" />
        )}
        <button className="tree-key" type="button" title={path} onClick={() => void navigator.clipboard?.writeText(path)}>
          {name}
        </button>
        <span className={`tree-type ${typeOfValue(value)}`}>{typeLabel(value)}</span>
        {!expandable ? <span className="tree-value">{primitivePreview(value)}</span> : <span className="tree-summary">{summaryLabel(value)}</span>}
      </div>
      {expandable && open ? (
        <div className="tree-children">
          {entries.map(([entryName, entryValue]) => (
            <TreeNode key={`${path}.${entryName}`} name={entryName} value={entryValue} path={childPath(path, entryName)} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OpenApiPreview({ data }: { data: unknown }) {
  const { t } = useI18n();
  if (!isRecord(data)) return <PreviewErrorPanel title={t('structured.openapiFailed')} message={t('structured.rootObject')} />;

  const info = isRecord(data.info) ? data.info : {};
  const paths = isRecord(data.paths) ? data.paths : {};
  const tags = Array.isArray(data.tags) ? data.tags.filter(isRecord) : [];

  return (
    <div className="openapi-preview">
      <header className="openapi-hero">
        <span className="openapi-version">{String(data.openapi ?? 'OpenAPI 3')}</span>
        <h1>{String(info.title ?? t('structured.untitledApi'))}</h1>
        {info.version ? <p>{t('structured.version', { version: String(info.version) })}</p> : null}
        {info.description ? <p>{String(info.description)}</p> : null}
      </header>

      {tags.length > 0 ? (
        <section className="openapi-section">
          <h2>{t('structured.tags')}</h2>
          <div className="openapi-tags">
            {tags.map((tag) => (
              <span key={String(tag.name)}>{String(tag.name)}</span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="openapi-section">
        <h2>{t('structured.endpoints')}</h2>
        <div className="openapi-endpoints">
          {Object.entries(paths).map(([path, operations]) => (
            <OpenApiPath key={path} path={path} operations={operations} />
          ))}
        </div>
      </section>
    </div>
  );
}

function OpenApiPath({ path, operations }: { path: string; operations: unknown }) {
  if (!isRecord(operations)) return null;
  const entries = Object.entries(operations).filter(([method]) => ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method));

  return (
    <div className="openapi-path">
      {entries.map(([method, operation]) => {
        const op = isRecord(operation) ? operation : {};
        return (
          <details key={method} open={entries.length <= 2}>
            <summary>
              <span className={`method method-${method}`}>{method.toUpperCase()}</span>
              <code>{path}</code>
              <span>{String(op.summary ?? op.operationId ?? '')}</span>
            </summary>
            {op.description ? <p>{String(op.description)}</p> : null}
            <OpenApiParameters value={op.parameters} />
            <OpenApiResponses value={op.responses} />
          </details>
        );
      })}
    </div>
  );
}

function OpenApiParameters({ value }: { value: unknown }) {
  const { t } = useI18n();
  if (!Array.isArray(value) || value.length === 0) return null;

  return (
    <div className="openapi-subsection">
      <h3>{t('structured.parameters')}</h3>
      <table>
        <thead>
          <tr>
            <th>{t('structured.name')}</th>
            <th>{t('structured.in')}</th>
            <th>{t('structured.required')}</th>
            <th>{t('structured.description')}</th>
          </tr>
        </thead>
        <tbody>
          {value.filter(isRecord).map((parameter) => (
            <tr key={`${String(parameter.name)}-${String(parameter.in)}`}>
              <td>{String(parameter.name ?? '')}</td>
              <td>{String(parameter.in ?? '')}</td>
              <td>{parameter.required ? t('structured.yes') : t('structured.no')}</td>
              <td>{String(parameter.description ?? '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpenApiResponses({ value }: { value: unknown }) {
  const { t } = useI18n();
  if (!isRecord(value)) return null;

  return (
    <div className="openapi-subsection">
      <h3>{t('structured.responses')}</h3>
      <div className="openapi-responses">
        {Object.entries(value).map(([status, response]) => {
          const description = isRecord(response) ? response.description : '';
          return (
            <div key={status}>
              <span>{status}</span>
              <p>{String(description ?? '')}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DataTablePreview({ parsed }: { parsed: Extract<ReturnType<typeof parseTabularData>, { ok: true }> }) {
  const { t } = useI18n();
  const columns = parsed.fields.length > 0 ? parsed.fields : parsed.rows[0]?.map((_, index) => t('structured.column', { number: index + 1 })) ?? [];

  return (
    <div className="data-table-preview">
      <div className="table-meta">
        <span>{t('structured.rows', { count: parsed.rowCount })}</span>
        <span>{t('structured.columns', { count: columns.length })}</span>
        {parsed.truncated ? <span>{t('structured.showing', { count: parsed.rows.length })}</span> : null}
      </div>
      {parsed.errors.length > 0 ? <PreviewErrorPanel title={t('structured.csvWarnings')} message={parsed.errors.join('\n')} compact /> : null}
      <div className="data-table-scroll">
        <table>
          <thead>
            <tr>
              <th className="row-index">#</th>
              {columns.map((field, index) => (
                <th key={`${field}-${index}`}>{field || t('structured.column', { number: index + 1 })}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="row-index">{rowIndex + 1}</td>
                {columns.map((_, columnIndex) => (
                  <td key={columnIndex}>{row[columnIndex] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PreviewErrorPanel({ title, message, compact = false }: { title: string; message: string; compact?: boolean }) {
  return (
    <div className={`preview-error-panel ${compact ? 'compact' : ''}`}>
      <strong>{title}</strong>
      <pre>{message}</pre>
    </div>
  );
}

function RawPreview({ content, compact = false }: { content: string; compact?: boolean }) {
  return <pre className={`plain-text-preview ${compact ? 'compact' : ''}`}>{content}</pre>;
}

function getTreeEntries(value: unknown): Array<[string, unknown]> {
  if (Array.isArray(value)) return value.map((item, index) => [`[${index}]`, item]);
  if (isRecord(value)) return Object.entries(value);
  return [];
}

function typeOfValue(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function typeLabel(value: unknown): string {
  if (Array.isArray(value)) return translateCurrent('structured.type.array');
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'object') return translateCurrent('structured.type.object');
  if (type === 'string') return translateCurrent('structured.type.string');
  if (type === 'number') return translateCurrent('structured.type.number');
  if (type === 'boolean') return translateCurrent('structured.type.boolean');
  return type;
}

function summaryLabel(value: unknown): string {
  if (Array.isArray(value)) return translateCurrent('structured.items', { count: value.length });
  if (isRecord(value)) return translateCurrent('structured.keys', { count: Object.keys(value).length });
  return '';
}

function primitivePreview(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (value === null) return 'null';
  return String(value);
}

function childPath(parent: string, child: string): string {
  if (child.startsWith('[')) return `${parent}${child}`;
  return `${parent}.${child}`;
}
