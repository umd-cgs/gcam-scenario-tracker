import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  GitCompareArrows,
  Check,
  Minus,
} from "lucide-react";
import { request, download } from "../api.js";
import { Loading, ErrorState } from "../components/Feedback.jsx";

export default function Compare({ revision, notify }) {
  const [params] = useSearchParams();
  const idsText = params.get("ids") || "";
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [onlyDifferences, setOnlyDifferences] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setRecords(null);
    setError("");
    const ids = [...new Set(idsText.split(",").filter(Boolean))];
    if (ids.length < 2) {
      setError("Select at least two scenarios from the workspace to compare.");
      return;
    }
    // One server snapshot, rather than one concurrent Google-backed request per scenario.
    request(`/comparisons?ids=${encodeURIComponent(ids.join(","))}`, {
      signal: controller.signal,
    })
      .then((data) => setRecords(data.scenarios))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, [idsText, revision, retry]);
  async function exportReport() {
    setBusy(true);
    try {
      await download(
        `/comparisons/export?ids=${encodeURIComponent(idsText)}`,
        "scenario_comparison.xlsx",
      );
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }
  const files = [
    ...new Set(
      records?.flatMap((row) =>
        row.input_files.map((file) => file.file_name),
      ) || [],
    ),
  ].sort();
  const membership =
    records?.map(
      (row) => new Set(row.input_files.map((file) => file.file_name)),
    ) || [];
  const shared = files.filter((name) =>
    membership.every((set) => set.has(name)),
  );
  const visibleFiles = onlyDifferences
    ? files.filter((name) => !shared.includes(name))
    : files;
  return (
    <>
      <Link className="back-link" to="/">
        <ArrowLeft size={16} />
        Back to scenarios
      </Link>
      <header className="page-heading">
        <div>
          <h1>Compare scenarios</h1>
        </div>
        <button
          className="button primary"
          disabled={!records || busy}
          onClick={exportReport}
        >
          <Download size={17} />
          {busy ? "Preparing…" : "Export Excel"}
        </button>
      </header>
      {error ? (
        <ErrorState message={error} onRetry={() => setRetry(retry + 1)} />
      ) : !records ? (
        <Loading label="Comparing scenarios…" />
      ) : (
        <>
          <div className="comparison-summary">
            <GitCompareArrows size={25} />
            <strong>{records.length} scenarios</strong>
            <span>{files.length} distinct input filenames</span>
            <span>{shared.length} shared by all</span>
            <span>{files.length - shared.length} differences</span>
          </div>
          <div className="compare-cards">
            {records.map(({ scenario, input_files }, index) => (
              <article className="detail-card" key={scenario.id}>
                <span className="eyebrow">SCENARIO {index + 1}</span>
                <h3>
                  <Link to={`/scenarios/${encodeURIComponent(scenario.id)}`}>
                    {scenario.scenario_name}
                  </Link>
                </h3>
                <p>
                  {scenario.project_name || "No project"} · ID {scenario.id}
                </p>
                <strong>{input_files.length} inputs</strong>
              </article>
            ))}
          </div>
          <div className="section-heading">
            <div>
              <h2>Input presence matrix</h2>
              <p>
                Files are matched by filename. This compares membership, not XML
                contents.
              </p>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={onlyDifferences}
                onChange={(event) => setOnlyDifferences(event.target.checked)}
              />
              Show differences only
            </label>
          </div>
          <div className="table-card">
            <div className="table-scroll" tabIndex={0}>
              <table>
                <caption className="sr-only">
                  Input presence across scenarios
                </caption>
                <thead>
                  <tr>
                    <th>Input file</th>
                    {records.map(({ scenario }, index) => (
                      <th
                        key={scenario.id}
                        title={`${scenario.scenario_name} (${scenario.id})`}
                      >
                        Scenario {index + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleFiles.map((name) => (
                    <tr key={name}>
                      <td className="mono-cell">{name}</td>
                      {membership.map((set, index) => (
                        <td key={records[index].scenario.id}>
                          {set.has(name) ? (
                            <span className="presence yes">
                              <Check size={16} />
                              Present
                            </span>
                          ) : (
                            <span className="presence">
                              <Minus size={16} />
                              Absent
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visibleFiles.length && (
                <div className="state-panel compact">
                  <h3>
                    {onlyDifferences
                      ? "These scenarios share the same input files."
                      : "No input files linked."}
                  </h3>
                  <p>
                    {onlyDifferences
                      ? "Turn off “Show differences only” to see the common inputs."
                      : "Upload configurations with scenario components to compare them."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
