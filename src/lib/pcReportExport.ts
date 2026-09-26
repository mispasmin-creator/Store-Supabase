export type ExportRow = Record<string, string | number>;

const escapeHtml = (v: unknown) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const columnsOf = (rows: ExportRow[]) => (rows.length ? Object.keys(rows[0]).filter(k => !k.startsWith('__')) : []);

const stamp = () => new Date().toISOString().slice(0, 10);

export const downloadRowsAsCsv = (title: string, rows: ExportRow[]) => {
    const cols = columnsOf(rows);
    const csv = [
        cols.map(c => `"${c.replace(/"/g, '""')}"`).join(','),
        ...rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // BOM so Excel reads UTF-8 correctly
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-pending-${stamp()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/** Opens a print-ready table in a new window; choose "Save as PDF" in the print dialog. */
export const printRowsAsPdf = (title: string, rows: ExportRow[], subtitle = ''): boolean => {
    const cols = columnsOf(rows);
    const win = window.open('', '_blank');
    if (!win) return false;

    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)} - Pending</title>
<style>
  body { font-family: Arial, sans-serif; margin: 16px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p { font-size: 11px; color: #555; margin: 0 0 12px; }
  table { border-collapse: collapse; width: 100%; font-size: ${cols.length > 16 ? 6 : cols.length > 11 ? 7.5 : 10}px; word-break: break-word; }
  th, td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  @page { size: A4 landscape; margin: 10mm; }
</style></head><body>
<h1>${escapeHtml(title)} - Pending</h1>
<p>${escapeHtml(subtitle)} Total: ${rows.length} | Generated: ${new Date().toLocaleString()}</p>
<table><thead><tr><th>#</th>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td>${cols.map(c => `<td>${escapeHtml(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table>
<script>window.onload = function () { window.print(); };</script>
</body></html>`);
    win.document.close();
    return true;
};
