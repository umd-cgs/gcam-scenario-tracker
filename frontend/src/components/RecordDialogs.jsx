import { useEffect, useState } from "react";
import { AlertTriangle, FileCode2, Upload, LoaderCircle } from "lucide-react";
import { request } from "../api.js";
import { asText, hasErrors } from "../lib.js";
import { Modal, ErrorState } from "./Feedback.jsx";

const scenarioFields = [
  ["personal_scenario_name", "Other name"],
  ["project_name", "Project"],
  ["based_on", "Based on"],
  ["person", "Run by"],
  ["date_run", "Run date"],
  ["job_id", "Job ID"],
  ["submitted", "Submitted timestamp"],
  ["finished", "Finished timestamp"],
  ["zaratan_link", "Zaratan link"],
  ["description", "Description", "textarea"],
  ["additional_notes", "Error notes", "textarea"],
];
const inputFields = [
  ["policy_name", "Policy name"],
  ["folder_location", "Folder location"],
  ["description", "Description", "textarea"],
  ["additional_notes", "Notes", "textarea"],
];

export function EditDialog({
  record,
  kind,
  projects,
  scenarios,
  onClose,
  onSaved,
}) {
  const fields = kind === "scenario" ? scenarioFields : inputFields;
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map(([key]) => [key, asText(record[key])])),
  );
  const [errors, setErrors] = useState(hasErrors(record.errors));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(kind === "scenario");
  const [peopleError, setPeopleError] = useState("");
  const [peopleRetry, setPeopleRetry] = useState(0);
  useEffect(() => {
    if (kind !== "scenario") return;
    const controller = new AbortController();
    setPeopleLoading(true);
    setPeopleError("");
    request("/mappings", { signal: controller.signal })
      .then((mappings) =>
        setPeople(
          mappings.people_names || Object.values(mappings.people || {}),
        ),
      )
      .catch((err) => {
        if (err.name !== "AbortError") setPeopleError("Could not load names.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setPeopleLoading(false);
      });
    return () => controller.abort();
  }, [kind, peopleRetry]);
  // Keep existing names selectable even if they have been removed from the mapping.
  const personOptions = [
    ...new Set([...people, asText(record.person)].filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const changed = Object.fromEntries(
      Object.entries(values).filter(
        ([key, value]) => value !== asText(record[key]),
      ),
    );
    if (kind === "scenario" && errors !== hasErrors(record.errors))
      changed.errors = errors ? "Yes" : "";
    if (!Object.keys(changed).length) {
      onClose();
      return;
    }
    try {
      await request(
        `/${kind === "scenario" ? "scenarios" : "inputs"}/${encodeURIComponent(record.id)}`,
        { method: "PATCH", body: JSON.stringify(changed) },
      );
      onSaved("Changes saved.");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Edit ${kind === "scenario" ? "scenario" : "input metadata"}`}
      onClose={onClose}
      busy={busy}
      wide
      dismissOnOutside
    >
      <p className="modal-intro">{record.scenario_name || record.file_name}</p>
      <form onSubmit={save}>
        {error && <ErrorState message={error} />}
        <fieldset disabled={busy} className="form-grid">
          {fields.map(([key, label, type]) => (
            <label
              key={key}
              className={type === "textarea" ? "full-width" : ""}
            >
              {label}
              {type === "textarea" ? (
                <textarea
                  rows={3}
                  value={values[key]}
                  onChange={(event) =>
                    setValues({ ...values, [key]: event.target.value })
                  }
                />
              ) : key === "person" ? (
                <select
                  value={values.person}
                  disabled={peopleLoading || Boolean(peopleError)}
                  aria-describedby={peopleError ? "people-error" : undefined}
                  onChange={(event) =>
                    setValues({ ...values, person: event.target.value })
                  }
                >
                  <option value="">
                    {peopleLoading ? "Loading names…" : "Unassigned"}
                  </option>
                  {personOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={key === "date_run" ? "date" : "text"}
                  value={values[key]}
                  list={
                    key === "project_name"
                      ? "project-options"
                      : key === "based_on"
                        ? "scenario-options"
                        : undefined
                  }
                  onChange={(event) =>
                    setValues({ ...values, [key]: event.target.value })
                  }
                  placeholder={
                    ["submitted", "finished"].includes(key)
                      ? "2026-09-16T14:30:00-04:00"
                      : ""
                  }
                />
              )}
            </label>
          ))}
          {kind === "scenario" && (
            <>
              {peopleError && (
                <div className="full-width" id="people-error" role="alert">
                  <span className="field-hint">{peopleError}</span>
                  <button
                    type="button"
                    className="button quiet small"
                    onClick={() => setPeopleRetry((value) => value + 1)}
                  >
                    Retry names
                  </button>
                </div>
              )}
              <label className="checkbox-label full-width">
                <input
                  type="checkbox"
                  checked={errors}
                  onChange={(event) => setErrors(event.target.checked)}
                />
                Flag this scenario for review (errors)
              </label>
              <p className="field-hint full-width">
                Timestamps retain their original timezone. When editing, use
                YYYY-MM-DDTHH:mm:ss with an optional timezone offset.
              </p>
            </>
          )}
        </fieldset>
        <datalist id="project-options">
          {projects.map((project) => (
            <option key={project} value={project} />
          ))}
        </datalist>
        <datalist id="scenario-options">
          {[...new Set(scenarios.map((s) => s.scenario_name))].map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <div className="modal-footer">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy && <LoaderCircle size={16} className="spin" />}
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function UploadDialog({ onClose, onSaved }) {
  const [kind, setKind] = useState("configuration");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function choose(file) {
    setError("");
    if (!file) {
      setFile(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".xml")) {
      setError("Please choose an XML file.");
      setFile(null);
      return;
    }
    if (file.size >= 50 * 1024 * 1024) {
      setError("Choose a file smaller than 50 MB.");
      setFile(null);
      return;
    }
    setFile(file);
  }
  async function upload(event) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    const body = new FormData();
    body.append(kind === "configuration" ? "config_file" : "input_file", file);
    try {
      const result = await request(`/uploads/${kind}`, {
        method: "POST",
        body,
      });
      onSaved(result.message);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <Modal title="Add to your workspace" onClose={onClose} busy={busy}>
      <form onSubmit={upload}>
        <p className="modal-intro">
          Upload a GCAM configuration or analyze an input file.
        </p>
        {error && <ErrorState message={error} />}
        <fieldset disabled={busy}>
          <label>
            File type
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="configuration">Scenario configuration</option>
              <option value="input">Input file metadata</option>
            </select>
          </label>
          <label
            className="upload-zone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!busy) choose(event.dataTransfer.files[0]);
            }}
          >
            <FileCode2 size={32} />
            <strong>
              {file ? file.name : "Choose an XML file or drop it here"}
            </strong>
            <span>
              {file
                ? `${(file.size / 1024).toFixed(1)} KB`
                : "UTF-8 XML · smaller than 50 MB"}
            </span>
            <input
              type="file"
              accept=".xml,application/xml,text/xml"
              aria-label="XML file"
              onChange={(event) => choose(event.target.files[0])}
            />
          </label>
          <p className="info-note">
            {kind === "configuration"
              ? "Creates a scenario, detects its input files, and stores the configuration in Google Drive. Each upload creates a new scenario."
              : "Extracts regions, years, and sectors. Existing metadata with the same filename is updated. The input file itself is not stored."}
          </p>
        </fieldset>
        <div className="modal-footer">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="button primary" disabled={!file || busy}>
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Upload size={16} />
            )}
            {busy ? "Uploading…" : "Upload file"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DeleteDialog({ record, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await request(`/scenarios/${encodeURIComponent(record.id)}`, {
        method: "DELETE",
      });
      onSaved("Scenario deleted.");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <Modal title="Delete this scenario?" onClose={onClose} busy={busy}>
      <div className="delete-warning">
        <AlertTriangle size={30} />
        <strong>{record.scenario_name}</strong>
      </div>
      <p>
        This removes the scenario, its input links, and input metadata used only
        by this scenario. Inputs shared with other scenarios are kept. Archived
        Drive files are retained.
      </p>
      <p className="field-hint">This cannot be undone in the tracker.</p>
      {error && <ErrorState message={error} />}
      <div className="modal-footer">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          Keep scenario
        </button>
        <button className="button danger" disabled={busy} onClick={remove}>
          {busy ? "Deleting…" : "Delete scenario"}
        </button>
      </div>
    </Modal>
  );
}
