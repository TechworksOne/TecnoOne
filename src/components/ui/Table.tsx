export default function Table({ columns, data }: { columns: string[]; data: any[] }) {
  return (
    <div className="overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      <table className="min-w-full">
        <thead className="sticky top-0 bg-[var(--color-surface-soft)]">
          <tr>
            {columns.map((c) => (
              <th key={c} className="border-b border-[var(--color-border)] p-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-sec)]">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-row-hover)]">
              {columns.map((c, i) => (
                <td key={i} className="p-3 text-sm text-[var(--color-text)]">
                  {row[c] ?? JSON.stringify(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
