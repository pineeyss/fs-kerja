import { cn } from "@/lib/utils";
import { EmptyState } from "./states";

/**
 * columns: [{ key, header, cell?: (row) => node, className?, align? }]
 * Header kuning sesuai mockup. Tabel bisa digulir horizontal di layar sempit.
 */
export default function DataTable({ columns, rows, rowKey = "id", emptyTitle = "Belum ada data", emptyDescription, caption, dense = false, rowClassName, onRowClick }) {
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "bg-accent py-3.5 font-semibold text-ink",
                  dense ? "px-2.5" : "px-4",
                  i === 0 && "rounded-l-lg",
                  i === columns.length - 1 && "rounded-r-lg",
                  c.align === "center" && "text-center",
                  c.align === "right" && "text-right",
                  c.className
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[rowKey]} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn("[&>td]:border-b [&>td]:border-line last:[&>td]:border-b-0", onRowClick && "cursor-pointer hover:bg-canvas/70", rowClassName?.(row))}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "py-4 align-middle",
                    dense ? "px-2.5" : "px-4",
                    c.align === "center" && "text-center",
                    c.align === "right" && "text-right",
                    c.className
                  )}
                >
                  {c.cell ? c.cell(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
