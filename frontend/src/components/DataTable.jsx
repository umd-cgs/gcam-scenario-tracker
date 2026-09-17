import { useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Search,
} from "lucide-react";
import { asText, recency, statusOf, timestamp } from "../lib.js";
import ColumnValueFilter from "./ColumnValueFilter.jsx";

export default function DataTable({
  rows,
  columns,
  label,
  selected,
  onSelection,
  initialSort = "recency",
  initialDirection = "desc",
  emptyTitle = "No records to show",
  emptyText = "Try adjusting your search or filters.",
}) {
  const columnMenuRef = useRef(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sorting, setSorting] = useState([
    { id: initialSort, desc: initialDirection === "desc" },
  ]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState(() =>
    Object.fromEntries([
      ...columns.map((column) => [column.key, !column.hidden]),
      ["recency", false],
    ]),
  );
  const rowSelection = useMemo(
    () => Object.fromEntries([...(selected || [])].map((id) => [id, true])),
    [selected],
  );
  const definitions = useMemo(
    () => [
      { id: "recency", accessorFn: recency, enableHiding: false },
      ...columns.map((column) => ({
        id: column.key,
        header: column.label,
        accessorFn: (row) =>
          column.key === "status" ? statusOf(row) : row[column.key],
        cell: ({ row, getValue }) =>
          column.render ? (
            column.render(row.original)
          ) : (
            <span className="cell-text" title={asText(getValue())}>
              {asText(getValue()) || <span className="muted">—</span>}
            </span>
          ),
        meta: {
          className: [
            column.className,
            column.key === "scenario_name" && "pinned-name",
          ]
            .filter(Boolean)
            .join(" "),
        },
        enableSorting: column.key !== "actions",
        enableColumnFilter: column.key !== "actions",
        enableHiding: !column.required && column.key !== "actions",
        filterFn: ["project_name", "person"].includes(column.key)
          ? (row, id, values) =>
              !values?.length || values.includes(asText(row.getValue(id)))
          : "includesString",
        sortingFn: [
          "upload_date",
          "submitted",
          "finished",
          "date_run",
        ].includes(column.key)
          ? (a, b, id) => timestamp(a.original[id]) - timestamp(b.original[id])
          : "alphanumeric",
      })),
    ],
    [columns],
  );
  const table = useReactTable({
    data: rows,
    columns: definitions,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    initialState: { pagination: { pageSize: 25 } },
    getRowId: (row) => String(row.id),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(rowSelection) : updater;
      onSelection?.(new Set(Object.keys(next).filter((id) => next[id])));
    },
    enableRowSelection: Boolean(onSelection),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  useEffect(() => {
    function closeOutside(event) {
      const menu = columnMenuRef.current;
      if (menu?.open && !menu.contains(event.target)) menu.open = false;
    }
    function closeOnEscape(event) {
      const menu = columnMenuRef.current;
      if (event.key === "Escape" && menu?.open) {
        event.preventDefault();
        menu.open = false;
        menu.querySelector("summary").focus();
      }
    }
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside, true);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <section
      className={`table-card ${onSelection ? "has-selection" : ""}`}
      aria-label={label}
    >
      <div className="table-options">
        <span>
          {filteredCount.toLocaleString()} {label.toLowerCase()}
        </span>
        <div className="inline-actions">
          <button
            className={`button quiet small ${showFilters ? "active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
          >
            <Search size={15} />
            Column filters
          </button>
          {columnFilters.length > 0 && (
            <button
              className="button quiet small"
              onClick={() => table.resetColumnFilters()}
            >
              Clear column filters
            </button>
          )}
          <details className="column-menu" ref={columnMenuRef}>
            <summary className="button quiet small">
              <SlidersHorizontal size={15} />
              Columns
            </summary>
            <div className="column-options">
              {table
                .getAllLeafColumns()
                .filter((column) => !["actions", "recency"].includes(column.id))
                .map((column) => (
                  <label key={column.id}>
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      disabled={!column.getCanHide()}
                      onChange={(event) => {
                        column.toggleVisibility(event.target.checked);
                        if (!event.target.checked) column.setFilterValue("");
                      }}
                    />
                    {column.columnDef.header}
                  </label>
                ))}
            </div>
          </details>
        </div>
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        aria-label={`${label} table; scroll horizontally for more columns`}
      >
        <table>
          <caption className="sr-only">{label}</caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {onSelection && (
                  <th className="select-column">
                    <input
                      type="checkbox"
                      aria-label="Select all scenarios on this page"
                      checked={
                        table.getIsAllPageRowsSelected() &&
                        table.getRowModel().rows.length > 0
                      }
                      ref={(node) => {
                        if (node)
                          node.indeterminate =
                            table.getIsSomePageRowsSelected();
                      }}
                      disabled={!table.getRowModel().rows.length}
                      onChange={table.getToggleAllPageRowsSelectedHandler()}
                    />
                  </th>
                )}
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    className={header.column.columnDef.meta?.className || ""}
                    aria-sort={
                      header.column.getIsSorted()
                        ? header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    {header.column.getCanSort() ? (
                      <button onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getIsSorted() ? (
                          header.column.getIsSorted() === "asc" ? (
                            <ArrowUp size={13} />
                          ) : (
                            <ArrowDown size={13} />
                          )
                        ) : (
                          <ArrowUpDown size={13} />
                        )}
                      </button>
                    ) : (
                      <span className="sr-only">Actions</span>
                    )}
                  </th>
                ))}
              </tr>
            ))}
            {showFilters && (
              <tr className="column-filters">
                {onSelection && <th className="select-column" />}
                {table.getVisibleLeafColumns().map((column) => (
                  <th
                    key={column.id}
                    className={column.columnDef.meta?.className || ""}
                  >
                    {column.getCanFilter() &&
                      (["project_name", "person"].includes(column.id) ? (
                        <ColumnValueFilter column={column} />
                      ) : (
                        <input
                          aria-label={`Filter ${column.columnDef.header}`}
                          placeholder="Filter…"
                          value={column.getFilterValue() || ""}
                          onChange={(event) =>
                            column.setFilterValue(event.target.value)
                          }
                        />
                      ))}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={row.getIsSelected() ? "selected-row" : ""}
              >
                {onSelection && (
                  <td className="select-column">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.original.scenario_name}`}
                      checked={row.getIsSelected()}
                      onChange={row.getToggleSelectedHandler()}
                    />
                  </td>
                )}
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cell.column.columnDef.meta?.className || ""}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!table.getRowModel().rows.length && (
          <div className="state-panel compact">
            <Search size={25} />
            <h3>{emptyTitle}</h3>
            <p>{emptyText}</p>
          </div>
        )}
      </div>
      <div className="pagination">
        <span>
          {filteredCount
            ? `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, filteredCount)} of ${filteredCount}`
            : "0 records"}
        </span>
        <div className="inline-actions">
          <label>
            Rows{" "}
            <select
              value={pageSize}
              onChange={(event) =>
                table.setPageSize(Number(event.target.value))
              }
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
          </label>
          <button
            className="icon-button"
            aria-label="Previous page"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            {pageIndex + 1} / {Math.max(1, table.getPageCount())}
          </span>
          <button
            className="icon-button"
            aria-label="Next page"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
