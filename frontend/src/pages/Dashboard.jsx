import { useEffect, useMemo, useState } from "react";
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
import { request } from "../api.js";

export default function Dashboard({
  tab,
  data,
  loading,
  error,
  reload,
  updatedAt,
  onUpload,
  readOnly,
  onEdit,
  onDelete,
  onDownload,
  selected,
  onSelection,
}) {
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("");
  const [status, setStatus] = useState("");
  const [savedColumnFilters, setSavedColumnFilters] = useState([]);
  const [savedColumnVisibility, setSavedColumnVisibility] = useState({});
  const [savedFilters, setSavedFilters] = useState([]);
  const [selectedSavedId, setSelectedSavedId] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [savedBy, setSavedBy] = useState("");
  const [filterError, setFilterError] = useState("");
  const [filterBusy, setFilterBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    request("/saved-filters", { signal: controller.signal })
      .then((result) => setSavedFilters(result.saved_filters.filter((item) => item.tab === tab)))
      .catch((error) => {
        if (error.name !== "AbortError") setFilterError(error.message);
      });
    return () => controller.abort();
  }, [tab]);
  const currentFilters = { search, project: tab === "scenarios" ? project : "",
    status: tab === "scenarios" ? status : "", columns: savedColumnFilters,
    column_visibility: savedColumnVisibility };
  const selectedSaved = savedFilters.find((item) => item.id === selectedSavedId);
  const isModified = selectedSaved &&
    JSON.stringify(currentFilters) !== JSON.stringify(selectedSaved.filters);
  function applySavedFilter(id) {
    setSelectedSavedId(id);
    setConfirmDelete(false);
    setFilterError("");
    const view = savedFilters.find((item) => item.id === id);
    if (!view) return;
    setSearch(view.filters.search);
    setProject(view.filters.project);
    setStatus(view.filters.status);
    setSavedColumnFilters(view.filters.columns);
    setSavedColumnVisibility(view.filters.column_visibility);
  }
  function resetFilters() {
    setSearch("");
    setProject("");
    setStatus("");
    setSavedColumnFilters([]);
    setSelectedSavedId("");
  }
  async function saveFilter(event) {
    event.preventDefault();
    setFilterError("");
    setFilterBusy(true);
    try {
      const view = await request("/saved-filters", {
        method: "POST",
        body: JSON.stringify({ tab, name: filterName, saved_by: savedBy, filters: currentFilters }),
      });
      setSavedFilters((previous) => [...previous, view]);
      setSelectedSavedId(view.id);
      setFilterName("");
      setShowSaveForm(false);
    } catch (error) {
      setFilterError(error.message);
    } finally {
      setFilterBusy(false);
    }
  }
  async function updateFilter() {
    if (!selectedSaved) return;
    setFilterError("");
    setFilterBusy(true);
    try {
      const view = await request(`/saved-filters/${encodeURIComponent(selectedSavedId)}`, {
        method: "PATCH", body: JSON.stringify({ filters: currentFilters }),
      });
      setSavedFilters((previous) => previous.map((item) => item.id === view.id ? view : item));
    } catch (error) {
      setFilterError(error.message);
    } finally {
      setFilterBusy(false);
    }
  }
  async function deleteFilter() {
    if (!selectedSaved) return;
    setFilterError("");
    setFilterBusy(true);
    try {
      await request(`/saved-filters/${encodeURIComponent(selectedSavedId)}`, { method: "DELETE" });
      setSavedFilters((previous) => previous.filter((item) => item.id !== selectedSavedId));
      setSelectedSavedId("");
      setConfirmDelete(false);
    } catch (error) {
      setFilterError(error.message);
    } finally {
      setFilterBusy(false);
    }
  }
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
          {onUpload && (
            <button className="button primary small" onClick={onUpload}>
              <Upload size={15} />
              Upload XML
            </button>
          )}
        </div>
      </header>
      <section className="summary-strip" aria-label="Workspace summary">
        {stats.map(([label, value]) => (
          <div key={label}>
            {label} <strong>{data ? value.toLocaleString() : "—"}</strong>
          </div>
        ))}
      </section>
      {readOnly && (
        <p className="demo-notice">Demo preview · Sample data only. The three Demo Baseline 2050 runs are stored separately; open the Updated row to view their history.</p>
      )}
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
          {(search || project || status || savedColumnFilters.length > 0) && (
            <button className="button quiet small" onClick={resetFilters}>
              Reset filters
            </button>
          )}
        </div>
        {!readOnly && <div className="saved-filter-bar">
          <label>
            Saved filters
            <select
              aria-label="Saved filters"
              value={selectedSavedId}
              onChange={(event) => applySavedFilter(event.target.value)}
            >
              <option value="">Choose a saved filter</option>
              {savedFilters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.saved_by ? ` · ${item.saved_by}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="button secondary small" onClick={() => {
            setShowSaveForm((value) => !value);
            setFilterError("");
          }}>
            Save current filters
          </button>
          {selectedSaved && isModified && (
            <button className="button quiet small" disabled={filterBusy} onClick={updateFilter}>
              Update saved filter
            </button>
          )}
          {selectedSaved && (
            confirmDelete ? (
              <span className="inline-actions">
                <button className="button danger small" disabled={filterBusy} onClick={deleteFilter}>
                  Confirm delete
                </button>
                <button className="button quiet small" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </span>
            ) : (
              <button className="button quiet small danger-text" onClick={() => setConfirmDelete(true)}>
                Delete saved filter
              </button>
            )
          )}
          {selectedSaved && isModified && <span className="field-hint">Unsaved changes</span>}
        </div>}
        {!readOnly && showSaveForm && (
          <form className="saved-filter-form" onSubmit={saveFilter}>
            <label>
              Filter name
              <input value={filterName} onChange={(event) => setFilterName(event.target.value)}
                maxLength={80} required placeholder="e.g. Needs review" />
            </label>
            <label>
              Saved by (optional)
              <input value={savedBy} onChange={(event) => setSavedBy(event.target.value)}
                maxLength={80} placeholder="Your name" />
            </label>
            <button className="button primary small" disabled={filterBusy}>Save filter</button>
          </form>
        )}
        {filterError && <p className="saved-filter-error" role="alert">{filterError}</p>}
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
              savedColumnFilters={savedColumnFilters}
              onSavedColumnFiltersChange={setSavedColumnFilters}
              savedColumnVisibility={savedColumnVisibility}
              onSavedColumnVisibilityChange={setSavedColumnVisibility}
            />
          ) : (
            <InputTable rows={rows} onEdit={onEdit}
              savedColumnFilters={savedColumnFilters}
              onSavedColumnFiltersChange={setSavedColumnFilters}
              savedColumnVisibility={savedColumnVisibility}
              onSavedColumnVisibilityChange={setSavedColumnVisibility} />
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
