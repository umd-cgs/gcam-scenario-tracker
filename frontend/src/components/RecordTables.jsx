import { Link } from "react-router-dom";
import { Download, Pencil, Trash2, ExternalLink } from "lucide-react";
import DataTable from "./DataTable.jsx";
import { formatDate, safeUrl, statusOf } from "../lib.js";

export function StatusBadge({ scenario }) {
  const status = statusOf(scenario);
  return (
    <span
      className={`status-badge ${status.toLowerCase().replaceAll(" ", "-")}`}
    >
      <span />
      {status}
    </span>
  );
}
const dateColumn = (key, label, hidden = false) => ({
  key,
  label,
  hidden,
  render: (row) => (
    <span className="date-cell" title={row[key]}>
      {formatDate(row[key], ["submitted", "finished"].includes(key))}
    </span>
  ),
});

export function ScenarioTable({
  rows,
  onEdit,
  onDelete,
  onDownload,
  selected,
  onSelection,
  compact = false,
}) {
  const columns = [
    {
      key: "scenario_name",
      label: "Scenario",
      required: true,
      className: "name-column",
      render: (row) => (
        <div>
          <Link
            className="record-link"
            to={`/scenarios/${encodeURIComponent(row.id)}`}
          >
            {row.scenario_name}
          </Link>
          <span className="record-subtitle">
            {row.personal_scenario_name || `ID ${row.id}`}
          </span>
        </div>
      ),
    },
    {
      key: "project_name",
      label: "Project",
      render: (row) =>
        row.project_name ? (
          <span className="project-badge">{row.project_name}</span>
        ) : (
          <span className="muted">Unassigned</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge scenario={row} />,
    },
    { key: "person", label: "Run by", hidden: compact },
    dateColumn("submitted", "Submitted", compact),
    {
      key: "input_count",
      label: "Inputs",
      render: (row) => (
        <span className="number-badge">{row.input_count ?? "—"}</span>
      ),
    },
    ...[
      "personal_scenario_name",
      "based_on",
      "description",
      "errors",
      "additional_notes",
      "uploaded_by",
      "job_id",
      "duration",
      "component_key",
    ].map((key) => ({
      key,
      label:
        {
          personal_scenario_name: "Other name",
          based_on: "Based on",
          additional_notes: "Error notes",
          uploaded_by: "Uploaded through",
          job_id: "Job ID",
          component_key: "Component",
        }[key] || key[0].toUpperCase() + key.slice(1),
      hidden: true,
    })),
    dateColumn("finished", "Finished", true),
    dateColumn("date_run", "Run date", true),
    dateColumn("upload_date", "Uploaded", true),
    {
      key: "zaratan_link",
      label: "Zaratan link",
      hidden: true,
      render: (row) =>
        safeUrl(row.zaratan_link) ? (
          <a href={safeUrl(row.zaratan_link)} target="_blank" rel="noreferrer">
            Open <ExternalLink size={12} />
          </a>
        ) : (
          "—"
        ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="row-actions">
          {onEdit && (
            <button
              className="icon-button"
              aria-label={`Edit ${row.scenario_name}`}
              title="Edit scenario"
              onClick={() => onEdit(row, "scenario")}
            >
              <Pencil size={16} />
            </button>
          )}
          {onDownload && (
            <button
              className="icon-button"
              aria-label={`Download ${row.scenario_name}`}
              title={
                row.config_file_id
                  ? "Download configuration"
                  : "No configuration archived"
              }
              disabled={!row.config_file_id}
              onClick={() => onDownload(row)}
            >
              <Download size={16} />
            </button>
          )}
          {onDelete && (
            <button
              className="icon-button danger-text"
              aria-label={`Delete ${row.scenario_name}`}
              title="Delete scenario"
              onClick={() => onDelete(row)}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      label="Scenarios"
      selected={selected}
      onSelection={onSelection}
      emptyTitle="No scenarios found"
      emptyText="Adjust your filters, or upload a configuration to start tracking a scenario."
    />
  );
}

export function InputTable({ rows, onEdit, compact = false }) {
  const columns = [
    {
      key: "file_name",
      label: "Input file",
      required: true,
      className: "name-column",
      render: (row) => (
        <div>
          <Link
            className="record-link"
            to={`/inputs/${encodeURIComponent(row.id)}`}
          >
            {row.file_name}
          </Link>
          {row.component_key && (
            <span className="record-subtitle">{row.component_key}</span>
          )}
        </div>
      ),
    },
    { key: "folder_location", label: "Folder", className: "mono-cell" },
    { key: "regions_modified", label: "Regions" },
    { key: "years_modified", label: "Years" },
    { key: "sectors_modified", label: "Sectors", hidden: compact },
    {
      key: "scenario_count",
      label: "Scenarios",
      hidden: compact,
      render: (row) => (
        <span className="number-badge">{row.scenario_count ?? "—"}</span>
      ),
    },
    ...[
      ["policy_name", "Policy"],
      ["description", "Description"],
      ["additional_notes", "Notes"],
      ["uploaded_by", "Uploaded by"],
      ["component_key", "Component"],
    ].map(([key, label]) => ({ key, label, hidden: true })),
    dateColumn("upload_date", "Uploaded", true),
    {
      key: "actions",
      label: "Actions",
      render: (row) =>
        onEdit && (
          <button
            className="icon-button"
            aria-label={`Edit ${row.file_name}`}
            title="Edit input metadata"
            onClick={() => onEdit(row, "input")}
          >
            <Pencil size={16} />
          </button>
        ),
    },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      label="Input files"
      initialSort="file_name"
      initialDirection="asc"
      emptyTitle="No input files found"
      emptyText="Inputs appear when configurations or input metadata are uploaded."
    />
  );
}
