export default function Table({ columns, data }: { columns: string[]; data: any[] }) {
  return (
    <div className="overflow-auto rounded-xl border bg-white dark:bg-slate-900">
      <table className="min-w-full">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {columns.map((c) => (
              <th key={c} className="text-left p-3 text-sm text-gray-600">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="border-t">
              {columns.map((c, i) => (
                <td key={i} className="p-3 text-sm">
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
