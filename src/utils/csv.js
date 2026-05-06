export function downloadTextFile(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPlotCsv(rows, curveKeys, curveNames = {}) {
  const headers = ['time_iso', 'time_ms', 'time_s', ...curveKeys.map((k) => curveNames[k] || k)];
  const body = rows.map((row) => [
    row.iso || '',
    row.tms ?? '',
    typeof row.t === 'number' ? row.t.toFixed(3) : '',
    ...curveKeys.map((k) => row[k] ?? ''),
  ]);
  const csv = [headers, ...body]
    .map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadTextFile(`plot_${stamp}.csv`, csv, 'text/csv;charset=utf-8');
}
