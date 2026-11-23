import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { request, download } from "../api.js";
import { Loading, ErrorState } from "../components/Feedback.jsx";

export default function Compare({ revision, notify }) {
  const [params] = useSearchParams();
  const idsText = params.get("ids") || "";
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setComparison(null);
    setError("");
    const ids = [...new Set(idsText.split(",").filter(Boolean))];
    if (ids.length < 2) {
      setError("Select at least two scenarios from the workspace to compare.");
      return () => controller.abort();
    }
    request(`/comparisons?ids=${encodeURIComponent(ids.join(","))}`, { signal: controller.signal })
      .then(setComparison)
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); });
    return () => controller.abort();
  }, [idsText, revision, retry]);
  async function exportReport() {
    setBusy(true);
    try {
      await download(`/comparisons/export?ids=${encodeURIComponent(idsText)}`, "scenario_comparison.xlsx");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to="/"><ArrowLeft size={16} /> Back to scenarios</Link>
      <header className="page-heading">
        <div><h1>Compare configurations</h1></div>
        <button className="button primary" disabled={!comparison || busy} onClick={exportReport}>
          <Download size={17} /> {busy ? "Preparing…" : "Export Excel"}
        </button>
      </header>
      {error ? <ErrorState message={error} onRetry={() => setRetry(retry + 1)} /> : !comparison ? (
        <Loading label="Comparing configurations…" />
      ) : (
        <>
          <div className="section-heading"><div>
            <h2>Configuration input files</h2>
            <p>File paths retain their order in each configuration. Yellow indicates a path missing from at least one configuration.</p>
            <p>Matching paths may appear on different rows when their order differs.</p>
          </div></div>
          <div className="table-card"><div className="table-scroll" tabIndex={0}>
            <table className="configuration-comparison">
              <caption className="sr-only">Ordered input file paths by configuration</caption>
              <thead><tr>{comparison.scenarios.map((scenario) => (
                <th key={scenario.id}><Link to={`/scenarios/${encodeURIComponent(scenario.id)}`}>{scenario.scenario_name}</Link> (ID {scenario.id})</th>
              ))}</tr></thead>
              <tbody>{comparison.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>{row.map((entry, index) => (
                  <td key={comparison.scenarios[index].id} className={entry?.missing ? "comparison-missing" : ""}>
                    {entry && <><span className="mono-cell">{entry.path}</span>{entry.missing && <span className="sr-only"> (missing from another configuration)</span>}</>}
                  </td>
                ))}</tr>
              ))}</tbody>
            </table>
            {!comparison.rows.length && <div className="state-panel compact"><h3>No input files in these configurations.</h3></div>}
          </div></div>
        </>
      )}
    </>
  );
}
