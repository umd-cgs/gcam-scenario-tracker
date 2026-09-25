import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Search,
  RefreshCw,
  Upload,
  GitCompareArrows,
  X,
} from "lucide-react";
import { ScenarioTable, InputTable } from "../components/RecordTables.jsx";
import { ErrorState, Loading } from "../components/Feedback.jsx";
import { matchesSearch, statusOf } from "../lib.js";

export default function Dashboard({
  tab,
  data,
  loading,
  error,
  reload,
  updatedAt,
  onUpload,
  onEdit,
  onDelete,
  onDownload,
  selected,
  onSelection,
}) {
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("");
  const [status, setStatus] = useState("");
  const scenarios = useMemo(
    () =>
      data?.scenarios.map((row) => ({ ...row, status: statusOf(row) })) || [],
    [data],
  );
  const rows = useMemo(
    () =>
      (tab === "scenarios" ? scenarios : data?.input_files || []).filter(
        (row) =>
          matchesSearch(row, search) &&
          (tab !== "scenarios" ||
            ((!project || row.project_name === project) &&
              (!status || row.status === status))),
      ),
    [data, scenarios, tab, search, project, status],
  );
  const projects = data?.projects || [];
  const stats = [
    ["Scenarios", scenarios.length],
    ["Input files", data?.input_files.length || 0],
    ["Projects", projects.length],
    [
      "Needs review",
      scenarios.filter((s) => s.status === "Needs review").length,
    ],
  ];
  return (
    <>
      <header className="dashboard-heading">
        <h1>{tab === "scenarios" ? "Scenarios" : "Input files"}</h1>
        <div className="inline-actions">
          <span className="sync-label">
            {updatedAt
              ? `Loaded ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
              : "Waiting for data"}
          </span>
          <button
            className="button quiet small"
            onClick={() => reload(true)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Refresh
          </button>
          <button className="button primary small" onClick={onUpload}>
            <Upload size={15} />
            Upload XML
          </button>
        </div>
      </header>
      <section className="summary-strip" aria-label="Workspace summary">
        {stats.map(([label, value]) => (
          <div key={label}>
            {label} <strong>{data ? value.toLocaleString() : "—"}</strong>
          </div>
        ))}
      </section>
      <section className="workspace-section">
        <div className="filter-bar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label={`Search ${tab === "scenarios" ? "scenarios" : "input files"}`}
              placeholder={
                tab === "scenarios"
                  ? "Search names, people, job IDs…"
                  : "Search files, regions, folders…"
              }
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                className="icon-button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <X size={15} />
              </button>
            )}
          </label>
          {tab === "scenarios" && (
            <>
              <select
                aria-label="Filter by project"
                value={project}
                onChange={(event) => setProject(event.target.value)}
              >
                <option value="">All projects</option>
                {projects.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <select
                aria-label="Filter by status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">All statuses</option>
                {["Tracked", "In progress", "Finished", "Needs review"].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
            </>
          )}
          {(search || project || status) && (
            <button
              className="button quiet small"
              onClick={() => {
                setSearch("");
                setProject("");
                setStatus("");
              }}
            >
              Reset filters
            </button>
          )}
        </div>
        {error && <ErrorState message={error} onRetry={() => reload(true)} />}
        {loading && !data ? (
          <Loading />
        ) : (
          data &&
          (tab === "scenarios" ? (
            <ScenarioTable
              rows={rows}
              onEdit={onEdit}
              onDelete={onDelete}
              onDownload={onDownload}
              selected={selected}
              onSelection={onSelection}
            />
          ) : (
            <InputTable rows={rows} onEdit={onEdit} />
          ))
        )}
        {selected.size > 0 && tab === "scenarios" && (
          <div className="selection-bar">
            <div>
              <GitCompareArrows size={20} />
              <strong>{selected.size} selected</strong>
              <span>
                Selection includes rows on other pages or hidden by filters.
              </span>
            </div>
            <div className="inline-actions">
              <button
                className="button quiet"
                onClick={() => onSelection(new Set())}
              >
                Clear
              </button>
              {selected.size >= 2 ? (
                <Link
                  className="button primary"
                  to={`/compare?ids=${encodeURIComponent([...selected].join(","))}`}
                >
                  Compare scenarios
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <span className="field-hint">Select at least 2 to compare</span>
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
