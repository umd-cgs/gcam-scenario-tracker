import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Layers3,
  Files,
  ArrowUpRight,
  Leaf,
  Menu,
  X,
  Moon,
  Sun,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { request, download } from "./api.js";
import {
  DeleteDialog,
  EditDialog,
  UploadDialog,
} from "./components/RecordDialogs.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Detail from "./pages/Detail.jsx";
import Compare from "./pages/Compare.jsx";
import { useTheme } from "./theme.js";

function ThemeToggle({ theme, onToggle }) {
  const label = theme === "light" ? "Dark mode" : "Light mode";
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      aria-label={`Switch to ${label.toLowerCase()}`}
      title={`Switch to ${label.toLowerCase()}`}
    >
      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
      <span>{label}</span>
    </button>
  );
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [dialog, setDialog] = useState(null);
  const [revision, setRevision] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const activeRequest = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useCallback((message, kind = "success") => {
    if (kind === "error") toast.error(message, { duration: Infinity });
    else toast.success(message);
  }, []);
  const reload = useCallback(async (fresh = false) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError("");
    try {
      const result = await request(`/data${fresh ? "?refresh=1" : ""}`, {
        signal: controller.signal,
      });
      setData(result);
      setUpdatedAt(new Date());
      setSelected(
        (current) =>
          new Set(
            [...current].filter((id) =>
              result.scenarios.some((row) => String(row.id) === id),
            ),
          ),
      );
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
    return () => activeRequest.current?.abort();
  }, [reload]);
  useEffect(() => {
    setMobileNav(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const onEdit = (record, kind) => setDialog({ type: "edit", record, kind });
  const onDelete = (record) => setDialog({ type: "delete", record });
  async function onDownload(record) {
    try {
      await download(
        `/scenarios/${encodeURIComponent(record.id)}/configuration`,
        `${record.scenario_name || record.id}.xml`,
      );
    } catch (err) {
      notify(err.message, "error");
    }
  }
  function onSaved(message) {
    if (
      dialog?.type === "delete" &&
      /^\/(scenario|scenarios)\//.test(location.pathname)
    )
      navigate("/");
    setDialog(null);
    setRevision((value) => value + 1);
    notify(message);
    reload(true);
  }
  const shared = {
    data,
    loading,
    error,
    reload,
    updatedAt,
    selected,
    onSelection: setSelected,
    onUpload: () => setDialog({ type: "upload" }),
    onEdit,
    onDelete,
    onDownload,
    revision,
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="mobile-header">
        <Link to="/" className="brand">
          <span className="brand-icon">
            <Leaf size={20} />
          </span>
          GCAM Tracker
        </Link>
        <div className="inline-actions">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button
            className="icon-button"
            aria-label={mobileNav ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileNav}
            onClick={() => setMobileNav(!mobileNav)}
          >
            {mobileNav ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <Link to="/" className="brand">
          GCAM Tracker
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            <Layers3 size={19} />
            Scenarios<span>{data?.scenarios.length ?? "—"}</span>
          </NavLink>
          <NavLink to="/inputs">
            <Files size={19} />
            Input files<span>{data?.input_files.length ?? "—"}</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <a
            href="https://jgcri.github.io/gcam-doc/"
            target="_blank"
            rel="noreferrer"
          >
            GCAM documentation
            <ArrowUpRight size={16} />
          </a>
        </div>
      </aside>
      <div className="main-shell">
        <main id="main">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard key="scenarios" tab="scenarios" {...shared} />
              }
            />
            <Route
              path="/inputs"
              element={<Dashboard key="inputs" tab="inputs" {...shared} />}
            />
            <Route
              path="/scenarios/:id"
              element={<Detail kind="scenario" {...shared} />}
            />
            <Route
              path="/scenario/:id"
              element={<Detail kind="scenario" {...shared} />}
            />
            <Route
              path="/inputs/:id"
              element={<Detail kind="input" {...shared} />}
            />
            <Route
              path="/input/:id"
              element={<Detail kind="input" {...shared} />}
            />
            <Route
              path="/compare"
              element={<Compare revision={revision} notify={notify} />}
            />
            <Route
              path="*"
              element={
                <div className="state-panel">
                  <h1>Page not found</h1>
                  <p>This page may have moved.</p>
                  <Link className="button primary" to="/">
                    Back to workspace
                  </Link>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
      {dialog?.type === "upload" && (
        <UploadDialog onClose={() => setDialog(null)} onSaved={onSaved} />
      )}
      {dialog?.type === "edit" && (
        <EditDialog
          record={dialog.record}
          kind={dialog.kind}
          projects={data?.projects || []}
          scenarios={data?.scenarios || []}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
        />
      )}
      {dialog?.type === "delete" && (
        <DeleteDialog
          record={dialog.record}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
        />
      )}
      <Toaster
        theme={theme}
        position="bottom-right"
        richColors
        closeButton
        duration={6500}
      />
    </div>
  );
}
