import { useMemo, useState } from "react";
import {
  Activity,
  ChevronRight,
  Clock3,
  Database,
  FileChartColumn,
  FileText,
  Gauge,
  Home,
  Menu,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Upload,
  X,
  Zap,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";
import AnomalyExplorer from "./components/AnomalyExplorer";
import Analytics from "./components/Analytics";
import ReportHistory from "./components/ReportHistory";

const navItems = [
  { label: "Overview", icon: Home },
  { label: "Analyze data", icon: Upload },
  { label: "Anomaly explorer", icon: ShieldAlert },
  { label: "Analytics", icon: Gauge },
  { label: "Report history", icon: FileText },
];

const protocolColors = [
  "#69a8ff",
  "#59e0b0",
  "#ffbf78",
  "#b49aff",
  "#7487a8",
  "#ff7188",
];

function App() {
  const [page, setPage] = useState("Overview");
  const [file, setFile] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  const [analysisHistory, setAnalysisHistory] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("aether-analysis-history") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [activeAnalysisId, setActiveAnalysisId] = useState(() => {
    try {
      return localStorage.getItem("aether-active-analysis-id") || null;
    } catch {
      return null;
    }
  });

  // The active analysis is the one dataset currently selected for detailed inspection
  const activeAnalysis = useMemo(() => {
    if (!activeAnalysisId || !analysisHistory.length) return null;
    return (
      analysisHistory.find((item) => item.historyId === activeAnalysisId) ||
      null
    );
  }, [activeAnalysisId, analysisHistory]);

  // Aggregate metrics derived across ALL datasets in Report History
  const overviewMetrics = useMemo(() => {
    const totalDatasets = analysisHistory.length;
    let totalRecords = 0;
    let totalAnomalies = 0;
    let totalNormal = 0;

    for (const item of analysisHistory) {
      const records = Number(item.total_records || 0);
      const flagged = Number(item.anomalies_detected || 0);
      const normal = Number(
        item.normal_records != null
          ? item.normal_records
          : Math.max(0, records - flagged)
      );

      totalRecords += records;
      totalAnomalies += flagged;
      totalNormal += normal;
    }

    const anomalyRate =
      totalRecords > 0
        ? Number(((totalAnomalies / totalRecords) * 100).toFixed(2))
        : 0;

    return {
      totalDatasets,
      totalRecords,
      totalAnomalies,
      totalNormal,
      anomalyRate,
    };
  }, [analysisHistory]);

  // Overview comparison chart: records per dataset (chronological order, up to 10)
  const overviewDatasetChart = useMemo(() => {
    return [...analysisHistory]
      .slice(0, 10)
      .reverse()
      .map((item) => {
        const records = Number(item.total_records || 0);
        const flagged = Number(item.anomalies_detected || 0);
        const normal = Number(
          item.normal_records != null
            ? item.normal_records
            : Math.max(0, records - flagged)
        );
        const rate =
          records > 0
            ? Number(((flagged / records) * 100).toFixed(2))
            : 0;

        return {
          id: item.historyId,
          rawItem: item,
          rawName: item.filename,
          name:
            item.filename && item.filename.length > 16
              ? `${item.filename.slice(0, 13)}...`
              : item.filename || "Dataset",
          records,
          flagged,
          normal,
          rate,
        };
      });
  }, [analysisHistory]);

  // Overview protocol distribution: aggregated across all datasets
  const overviewProtocols = useMemo(() => {
    const protocolMap = new Map();
    let totalCount = 0;

    for (const item of analysisHistory) {
      if (Array.isArray(item.protocol_summary)) {
        for (const p of item.protocol_summary) {
          const name = String(p.name || p.protocol || "UNKNOWN").toUpperCase();
          const count = Number(p.value || p.count || 0);
          const flagged = Number(p.flagged || 0);

          if (count > 0) {
            const current = protocolMap.get(name) || { value: 0, flagged: 0 };
            protocolMap.set(name, {
              value: current.value + count,
              flagged: current.flagged + flagged,
            });
            totalCount += count;
          }
        }
      }
    }

    const list = Array.from(protocolMap.entries()).map(([name, data]) => ({
      name,
      value: data.value,
      flagged: data.flagged,
      percentage:
        totalCount > 0
          ? Number(((data.value / totalCount) * 100).toFixed(1))
          : 0,
    }));

    list.sort((a, b) => b.value - a.value);

    return list.map((item, index) => ({
      ...item,
      color: protocolColors[index % protocolColors.length],
    }));
  }, [analysisHistory]);

  // Overview recent analyses rows
  const overviewRows = useMemo(() => {
    return analysisHistory
      .slice(0, 5)
      .map((item) => ({
        id: item.historyId,
        rawItem: item,
        file: item.filename,
        records: Number(item.total_records || 0).toLocaleString(),
        flagged: Number(item.anomalies_detected || 0).toLocaleString(),
        rate: `${item.anomaly_rate || 0}%`,
        date: item.analyzedAt
          ? new Date(item.analyzedAt).toLocaleString()
          : "—",
        status: "Analyzed",
      }));
  }, [analysisHistory]);

  function selectFile(event) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;

    if (!chosen.name.toLowerCase().endsWith(".csv")) {
      setNotice("Please choose a CSV file.");
      return;
    }
    if (chosen.size > 50 * 1024 * 1024) {
      setNotice("Your CSV must be smaller than 50 MB.");
      return;
    }

    setFile(chosen);
    setNotice("");
    setPage("Analyze data");
  }

  async function analyzeFile() {
    if (!file || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisError("");
    setNotice("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "http://127.0.0.1:8000/api/analyze-csv",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : data.detail?.message ||
              "The server could not analyze this file.";

        throw new Error(detail);
      }

      const newAnalysis = {
        ...data,
        analyzedAt: new Date().toISOString(),
        historyId: `${Date.now()}-${data.filename}`,
      };

      // 1. Add to saved history
      setAnalysisHistory((previous) => {
        const updated = [newAnalysis, ...previous];
        try {
          localStorage.setItem(
            "aether-analysis-history",
            JSON.stringify(updated)
          );
        } catch (error) {
          console.error("Could not save analysis history:", error);
        }
        return updated;
      });

      // 2. Set as active dataset in application state and persistence
      setActiveAnalysisId(newAnalysis.historyId);
      try {
        localStorage.setItem(
          "aether-active-analysis-id",
          newAnalysis.historyId
        );
      } catch (error) {
        console.error("Could not save active analysis ID:", error);
      }

      // 3. Navigate to Analytics to view the newly analyzed dataset
      setFile(null);
      navigate("Analytics");
    } catch (error) {
      setAnalysisError(
        error.message ||
          "Could not connect to Aether. Check that the backend is running."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleSelectAnalysis(item) {
    if (!item) return;
    setActiveAnalysisId(item.historyId);
    try {
      localStorage.setItem("aether-active-analysis-id", item.historyId);
    } catch (error) {
      console.error("Could not save active analysis ID:", error);
    }
    navigate("Analytics");
  }

  function navigate(label) {
    setPage(label);
    setMobileNav(false);
    setNotice("");
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <aside className={`sidebar glass ${mobileNav ? "sidebar-open" : ""}`}>
        <button className="brand" onClick={() => navigate("Overview")}>
          <span className="brand-mark"><Activity size={21} /></span>
          <span className="brand-word">aether<span>.</span><small>NETWORK INTELLIGENCE</small></span>
        </button>

        <div className="nav-caption">WORKSPACE</div>
        <nav className="nav-list">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-link ${page === label ? "selected" : ""}`}
              onClick={() => navigate(label)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom" />
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileNav(!mobileNav)}
            aria-label="Toggle navigation"
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="analyst-workspace-button"
              aria-label="Analyst workspace"
            >
              <ShieldCheck size={17} />
              <span>Analyst workspace</span>
              <span className="workspace-status-dot" />
            </button>
          </div>
        </header>

        <div className="content">
          {page === "Overview" ? (
            <>
              <section className="welcome-row">
                <div>
                  <div className="eyebrow">
                    <span className="eyebrow-line" />
                    SECURITY OBSERVABILITY / OVERVIEW
                  </div>
                  <h1>
                    See beyond the <span className="gradient-text">normal.</span>
                  </h1>
                  <p className="welcome-description">
                    Aggregated intelligence across all analyzed datasets in your workspace.
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => navigate("Analyze data")}
                >
                  <Upload size={17} /> New analysis <ChevronRight size={16} />
                </button>
              </section>

              <div className="demo-notice">
                <span className="notice-symbol">
                  <Zap size={15} />
                </span>
                <span>
                  {analysisHistory.length > 0 ? (
                    <>
                      <strong>Global workspace view:</strong>{" "}
                      {overviewMetrics.totalDatasets}{" "}
                      {overviewMetrics.totalDatasets === 1
                        ? "dataset"
                        : "datasets"}{" "}
                      evaluated —{" "}
                      {overviewMetrics.totalRecords.toLocaleString()} total
                      records across your workspace.
                    </>
                  ) : (
                    <>
                      <strong>Ready for analysis</strong> — upload a compatible
                      network traffic CSV to populate this dashboard.
                    </>
                  )}
                </span>
                <span className="demo-pill">
                  {analysisHistory.length > 0 ? "AGGREGATED" : "READY"}
                </span>
              </div>

              {/* Aggregated Overview metrics across ALL datasets */}
              <section className="metrics-grid">
                <Metric
                  icon={Database}
                  label="Records analyzed"
                  value={
                    overviewMetrics.totalDatasets > 0
                      ? overviewMetrics.totalRecords.toLocaleString()
                      : "—"
                  }
                  detail={
                    overviewMetrics.totalDatasets > 0
                      ? `Across all ${overviewMetrics.totalDatasets} ${
                          overviewMetrics.totalDatasets === 1
                            ? "dataset"
                            : "datasets"
                        }`
                      : "Run an analysis to begin"
                  }
                  tone="blue"
                />
                <Metric
                  icon={ShieldAlert}
                  label="Potential anomalies"
                  value={
                    overviewMetrics.totalDatasets > 0
                      ? overviewMetrics.totalAnomalies.toLocaleString()
                      : "—"
                  }
                  detail={
                    overviewMetrics.totalDatasets > 0
                      ? "Flagged across all datasets"
                      : "No analysis yet"
                  }
                  tone="rose"
                />
                <Metric
                  icon={Activity}
                  label="Overall anomaly rate"
                  value={
                    overviewMetrics.totalDatasets > 0
                      ? `${overviewMetrics.anomalyRate}%`
                      : "—"
                  }
                  detail={
                    overviewMetrics.totalDatasets > 0
                      ? "Total anomalies / total records"
                      : "No analysis yet"
                  }
                  tone="mint"
                />
                <Metric
                  icon={Clock3}
                  label="Normal-looking records"
                  value={
                    overviewMetrics.totalDatasets > 0
                      ? overviewMetrics.totalNormal.toLocaleString()
                      : "—"
                  }
                  detail={
                    overviewMetrics.totalDatasets > 0
                      ? "Standard records across datasets"
                      : "No analysis yet"
                  }
                  tone="violet"
                />
              </section>

              {/* Aggregated Overview visual panels */}
              <section className="visual-grid">
                {/* Panel 1: Records by dataset */}
                <article className="glass panel traffic-panel">
                  <PanelHeading
                    title="Records by dataset"
                    subtitle="Normal-looking vs flagged records across analyzed datasets"
                    badge={
                      overviewDatasetChart.length > 0
                        ? "ALL DATASETS"
                        : "AWAITING DATA"
                    }
                  />
                  <div className="chart-legend">
                    <span>
                      <i className="legend-normal" /> Normal-looking
                    </span>
                    <span>
                      <i className="legend-flagged" /> Flagged
                    </span>
                  </div>
                  <div className="traffic-chart">
                    {overviewDatasetChart.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={overviewDatasetChart}
                          margin={{
                            top: 14,
                            right: 8,
                            left: -19,
                            bottom: 25,
                          }}
                        >
                          <CartesianGrid
                            stroke="#9ab2d0"
                            strokeOpacity={0.1}
                            strokeDasharray="4 5"
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fill: "#8498b5", fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            dy={8}
                            interval={0}
                          />
                          <YAxis
                            tick={{ fill: "#8498b5", fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#111c2e",
                              border: "1px solid #3b4b65",
                              borderRadius: 12,
                              color: "#f2f6ff",
                            }}
                            formatter={(value, name) => [
                              Number(value).toLocaleString(),
                              name,
                            ]}
                            labelFormatter={(label, items) => {
                              const raw = items?.[0]?.payload?.rawName;
                              return raw || label;
                            }}
                          />
                          <Bar
                            dataKey="normal"
                            name="Normal-looking"
                            fill="#6aa9ff"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="flagged"
                            name="Flagged"
                            fill="#ff7188"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div
                        className="muted"
                        style={{
                          display: "grid",
                          placeItems: "center",
                          height: "100%",
                          textAlign: "center",
                          padding: "20px",
                        }}
                      >
                        Upload and analyze CSV datasets to view records and anomaly
                        comparisons across datasets.
                      </div>
                    )}
                  </div>
                </article>

                {/* Panel 2: Aggregated protocol distribution */}
                <article className="glass panel protocol-panel">
                  <PanelHeading
                    title="Global protocol mix"
                    subtitle="Protocol distribution aggregated across all datasets"
                    badge="BY TYPE"
                  />
                  <div className="protocol-content">
                    <div className="donut-wrap">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={overviewProtocols}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="68%"
                            outerRadius="91%"
                            paddingAngle={4}
                            stroke="none"
                          >
                            {overviewProtocols.map((p) => (
                              <Cell key={p.name} fill={p.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "#111c2e",
                              border: "1px solid #3b4b65",
                              borderRadius: 12,
                              color: "#f2f6ff",
                            }}
                            formatter={(value, name) => [
                              Number(value).toLocaleString(),
                              name,
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="donut-label">
                        <strong>
                          {overviewMetrics.totalRecords > 0
                            ? Number(
                                overviewMetrics.totalRecords
                              ).toLocaleString()
                            : "—"}
                        </strong>
                        <small>records</small>
                      </div>
                    </div>
                    <div className="protocol-list">
                      {overviewProtocols.map((p) => (
                        <div className="protocol-item" key={p.name}>
                          <span className="protocol-name">
                            <i style={{ background: p.color }} />
                            {p.name}
                          </span>
                          <strong>{p.percentage}%</strong>
                        </div>
                      ))}
                      {overviewProtocols.length === 0 && (
                        <div
                          className="muted"
                          style={{ fontSize: "11px", padding: "10px 0" }}
                        >
                          No protocol data available.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="panel-footnote">
                    <span className="status-dot blue-dot" />
                    {analysisHistory.length > 0
                      ? `Aggregated across ${overviewMetrics.totalDatasets} saved ${
                          overviewMetrics.totalDatasets === 1
                            ? "analysis"
                            : "analyses"
                        }`
                      : "Upload and analyze a CSV to display protocol distribution"}
                  </div>
                </article>
              </section>

              <section className="glass upload-panel">
                <div className="upload-visual">
                  <div className="upload-visual-inner">
                    <ShieldCheck size={27} />
                  </div>
                  <span className="upload-orbit orbit-a" />
                  <span className="upload-orbit orbit-b" />
                </div>

                <div className="upload-text">
                  <span className="eyebrow">DATASET DRILLDOWN</span>
                  <h2>
                    {activeAnalysis
                      ? `Active dataset: ${activeAnalysis.filename}`
                      : "Ready to inspect a dataset?"}
                  </h2>
                  <p className="muted">
                    {activeAnalysis
                      ? `Explore flagged records and detailed metrics for ${activeAnalysis.filename}.`
                      : "Explore flagged network records, inspect features, and investigate unusual traffic patterns."}
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() =>
                    navigate(activeAnalysis ? "Analytics" : "Analyze data")
                  }
                >
                  <ShieldAlert size={17} />
                  {activeAnalysis ? "View active dataset" : "Analyze a dataset"}
                  <ChevronRight size={16} />
                </button>
              </section>

              <section className="glass panel recent-panel">
                <div className="section-heading">
                  <PanelHeading
                    title="Recent analyses"
                    subtitle="Click any dataset to open its detailed analytics"
                  />
                  <button
                    className="text-button"
                    onClick={() => navigate("Report history")}
                  >
                    View history <ChevronRight size={15} />
                  </button>
                </div>
                <AnalysisTable
                  rows={overviewRows}
                  onSelectRow={handleSelectAnalysis}
                />
              </section>
            </>
          ) : page === "Analyze data" ? (
            <section className="subpage">
              <div className="eyebrow">
                <span className="eyebrow-line" /> DATA INGESTION
              </div>
              <h1>
                Analyze your <span className="gradient-text">network.</span>
              </h1>
              <p className="subpage-description">
                Choose a CSV file to prepare your network flow data for analysis.
              </p>
              <div className="glass file-drop">
                <div className="upload-visual">
                  <div className="upload-visual-inner">
                    <FileChartColumn size={27} />
                  </div>
                </div>

                {file ? (
                  <>
                    <div className="selected-file">
                      <FileText size={22} />
                      <div>
                        <strong>{file.name}</strong>
                        <small>
                          {(file.size / 1024).toFixed(1)} KB · Selected locally
                        </small>
                      </div>
                      <button
                        className="icon-button"
                        onClick={() => {
                          setFile(null);
                          setAnalysisError("");
                        }}
                        aria-label="Remove selected file"
                        disabled={isAnalyzing}
                      >
                        <X size={17} />
                      </button>
                    </div>

                    <button
                      className="primary-button"
                      onClick={analyzeFile}
                      disabled={isAnalyzing}
                    >
                      <Activity size={17} />
                      {isAnalyzing
                        ? "Analyzing traffic..."
                        : "Run anomaly detection"}
                    </button>

                    {isAnalyzing && (
                      <p className="muted">
                        Uploading your CSV and scoring network traffic. Please
                        wait...
                      </p>
                    )}

                    {analysisError && (
                      <p className="error-text">{analysisError}</p>
                    )}
                  </>
                ) : (
                  <>
                    <h2>Drop your data into Aether</h2>
                    <p>Choose a compatible network traffic CSV file.</p>

                    <label className="primary-button upload-button">
                      <Upload size={17} /> Browse files
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={selectFile}
                      />
                    </label>
                  </>
                )}

                {notice && <p className="error-text">{notice}</p>}
                <small className="muted">CSV only · Maximum 50 MB</small>
              </div>
            </section>
          ) : page === "Settings" ? (
            <section className="subpage">
              <div className="eyebrow">PREFERENCES</div>
              <h1>
                Workspace <span className="gradient-text">settings.</span>
              </h1>
              <div className="glass placeholder-panel">
                <Settings size={28} />
                <h2>Workspace configuration</h2>
                <p>
                  Model configuration and backend settings will be added here.
                </p>
              </div>
            </section>
          ) : page === "Report history" ? (
            <ReportHistory
              analysisHistory={analysisHistory}
              activeHistoryId={activeAnalysisId}
              onSelectAnalysis={handleSelectAnalysis}
            />
          ) : page === "Anomaly explorer" ? (
            <AnomalyExplorer
              analysis={activeAnalysis}
              onAnalyze={() => navigate("Analyze data")}
              onNavigate={navigate}
            />
          ) : page === "Analytics" ? (
            <Analytics
              analysis={activeAnalysis}
              onNavigate={navigate}
            />
          ) : (
            <section className="subpage">
              <div className="eyebrow">
                <span className="eyebrow-line" /> WORKSPACE
              </div>

              <h1>
                {page
                  .split(" ")
                  .map((w) => w[0]?.toUpperCase() + w.slice(1))
                  .join(" ")}
              </h1>

              <p className="subpage-description">
                Your next step toward clearer network intelligence.
              </p>

              <div className="glass placeholder-panel">
                <ShieldCheck size={30} />
                <h2>Workspace</h2>

                <p>
                  Upload a CSV and run an analysis to populate your workspace
                  with real network insights.
                </p>

                <button
                  className="secondary-button"
                  onClick={() =>
                    navigate(activeAnalysis ? "Analytics" : "Analyze data")
                  }
                >
                  {activeAnalysis ? "Explore active dataset" : "Analyze a dataset"}
                </button>
              </div>
            </section>
          )}

          <footer className="footer">
            <span>
              <span className="footer-brand">aether.</span> Network Anomaly
              Intelligence
            </span>
            <span>
              <i className="status-dot amber" /> Demo mode · No live detection
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, tone }) {
  return (
    <article className="glass metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={21} strokeWidth={1.8} />
      </div>
      <div className="metric-body">
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function PanelHeading({ title, subtitle, badge }) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {badge && <span className="panel-badge">{badge}</span>}
    </div>
  );
}

function AnalysisTable({ rows, onSelectRow }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>DATASET</th>
            <th>RECORDS</th>
            <th>FLAGGED</th>
            <th>RATE</th>
            <th>DATE</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              style={{ cursor: "pointer" }}
              onClick={() => onSelectRow?.(r.rawItem)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectRow?.(r.rawItem);
                }
              }}
              aria-label={`Open analytics for ${r.file}`}
            >
              <td className="dataset-name">
                <span className="file-mini">
                  <FileText size={15} />
                </span>
                {r.file}
              </td>
              <td>{r.records}</td>
              <td className="flag-number">{r.flagged}</td>
              <td>{r.rate}</td>
              <td>{r.date}</td>
              <td>
                <span className="demo-status">
                  <i />
                  {r.status || "Analyzed"}
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan="6" className="empty-table">
                No matching datasets.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default App;
