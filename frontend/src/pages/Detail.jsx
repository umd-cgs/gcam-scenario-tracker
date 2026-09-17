import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, ExternalLink, Pencil } from "lucide-react";
import { request } from "../api.js";
import { formatDate, safeUrl } from "../lib.js";
import { Loading, ErrorState } from "../components/Feedback.jsx";
import {
  InputTable,
  ScenarioTable,
  StatusBadge,
} from "../components/RecordTables.jsx";

const scenarioFields = [
  ["personal_scenario_name", "Other name"],
  ["project_name", "Project"],
  ["based_on", "Based on"],
  ["person", "Run by"],
  ["date_run", "Run date"],
  ["submitted", "Submitted"],
  ["finished", "Finished"],
  ["duration", "Duration"],
  ["job_id", "Job ID"],
  ["description", "Description"],
  ["additional_notes", "Error notes"],
  ["uploaded_by", "Uploaded through"],
  ["upload_date", "Upload date"],
];
const inputFields = [
  ["regions_modified", "Regions"],
  ["years_modified", "Years"],
  ["sectors_modified", "Sectors"],
  ["policy_name", "Policy"],
  ["folder_location", "Folder"],
  ["description", "Description"],
  ["additional_notes", "Notes"],
  ["uploaded_by", "Uploaded by"],
  ["upload_date", "Upload date"],
];

export default function Detail({
  kind,
  revision,
  onEdit,
  onDownload,
  onDelete,
}) {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError("");
    request(
      `/${kind === "scenario" ? "scenarios" : "inputs"}/${encodeURIComponent(id)}`,
      { signal: controller.signal },
    )
      .then((data) => setResult({ key: `${kind}/${id}`, data }))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, [kind, id, revision, retry]);
  if (error)
    return (
      <>
        <Link className="back-link" to="/">
          <ArrowLeft size={16} />
          Workspace
        </Link>
        <ErrorState message={error} onRetry={() => setRetry(retry + 1)} />
      </>
    );
  if (!result || result.key !== `${kind}/${id}`)
    return <Loading label="Loading record…" />;
  const details = result.data;
  const record = details.scenario || details.input_file;
  const fields = kind === "scenario" ? scenarioFields : inputFields;
  return (
    <>
      <Link className="back-link" to={kind === "scenario" ? "/" : "/inputs"}>
        <ArrowLeft size={16} />
        Back to {kind === "scenario" ? "scenarios" : "input files"}
      </Link>
      <header className="page-heading detail-heading">
        <div>
          <div className="eyebrow">
            {kind === "scenario" ? "SCENARIO DETAILS" : "INPUT FILE DETAILS"} ·{" "}
            {record.id}
          </div>
          <h1>{record.scenario_name || record.file_name}</h1>
          {kind === "scenario" && <StatusBadge scenario={record} />}
        </div>
        <div className="inline-actions">
          <button
            className="button secondary"
            onClick={() => onEdit(record, kind)}
          >
            <Pencil size={16} />
            Edit metadata
          </button>
          {kind === "scenario" && record.config_file_id && (
            <button
              className="button primary"
              onClick={() => onDownload(record)}
            >
              <Download size={16} />
              Configuration
            </button>
          )}
        </div>
      </header>
      <section className="detail-card">
        <h2>Overview</h2>
        <dl className="detail-grid">
          {fields.map(([key, label]) => (
            <div
              key={key}
              className={
                ["description", "additional_notes"].includes(key)
                  ? "full-width"
                  : ""
              }
            >
              <dt>{label}</dt>
              <dd>
                {["date_run", "upload_date", "submitted", "finished"].includes(
                  key,
                )
                  ? formatDate(
                      record[key],
                      ["submitted", "finished"].includes(key),
                    )
                  : record[key] || "—"}
              </dd>
            </div>
          ))}
          {safeUrl(record.zaratan_link) && (
            <div>
              <dt>Zaratan</dt>
              <dd>
                <a
                  href={safeUrl(record.zaratan_link)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open run link <ExternalLink size={14} />
                </a>
              </dd>
            </div>
          )}
        </dl>
      </section>
      <div className="section-heading">
        <div>
          <h2>
            {kind === "scenario" ? "Linked input files" : "Used in scenarios"}
          </h2>
          <p>
            {kind === "scenario"
              ? "Model components referenced by this configuration."
              : "Input contents are not stored; the tracker records metadata and scenario relationships."}
          </p>
        </div>
      </div>
      {kind === "scenario" ? (
        <InputTable rows={details.input_files} onEdit={onEdit} compact />
      ) : (
        <ScenarioTable
          rows={details.scenarios}
          onEdit={onEdit}
          onDownload={onDownload}
          compact
        />
      )}
      {kind === "scenario" && (
        <div className="danger-zone">
          <span>Remove this scenario and its unshared input metadata.</span>
          <button
            className="button quiet danger-text"
            onClick={() => onDelete(record)}
          >
            Delete scenario
          </button>
        </div>
      )}
    </>
  );
}
