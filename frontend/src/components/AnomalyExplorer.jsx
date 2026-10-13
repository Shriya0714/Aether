
import { useMemo, useState } from "react";
import {
  Database,
  ShieldAlert,
  Gauge,
  Download,
  Search,
  FileSearch,
  Upload,
  FileText,
} from "lucide-react";
import "./AnomalyExplorer.css";

export default function AnomalyExplorer({ analysis, onAnalyze, onNavigate }) {
  const [query, setQuery] = useState("");
  const [protocol, setProtocol] = useState("All");
  const [sortBy, setSortBy] = useState("score");

  const records = useMemo(
    () => analysis?.flagged_records ?? [],
    [analysis]
  );

  const protocolOptions = useMemo(
    () => [
      "All",
      ...new Set(
        records.map((record) =>
          String(record.proto ?? record.protocol ?? "Unknown")
        )
      ),
    ],
    [records]
  );

  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => {
        const recordProtocol = String(
          record.proto ?? record.protocol ?? "Unknown"
        );

        const searchableText = [
          record.record_number,
          record.id,
          recordProtocol,
          record.service,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          searchableText.includes(query.toLowerCase()) &&
          (protocol === "All" || recordProtocol === protocol)
        );
      })
      .sort((a, b) => {
        if (sortBy === "score") {
          return (
            Number(b.anomaly_score ?? 0) -
            Number(a.anomaly_score ?? 0)
          );
        }

        return (
          Number(a.record_number ?? a.id ?? 0) -
          Number(b.record_number ?? b.id ?? 0)
        );
      });
  }, [records, query, protocol, sortBy]);

  function exportCsv() {
    if (filteredRecords.length === 0) return;

    const columns = [
      ...new Set(filteredRecords.flatMap((record) => Object.keys(record))),
    ];

    const escapeCsv = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [
      columns.map(escapeCsv).join(","),
      ...filteredRecords.map((record) =>
        columns.map((column) => escapeCsv(record[column])).join(",")
      ),
    ].join("\r\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = `aether-flagged-${analysis?.filename || "records"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (!analysis) {
    return (
      <section className="subpage">
        <div className="eyebrow">
          <span className="eyebrow-line" /> INVESTIGATION
        </div>

        <h1>
          Anomaly <span className="gradient-text">explorer.</span>
        </h1>

        <p className="subpage-description">
          Search and investigate unusual network records identified by Aether.
        </p>

        <div className="glass placeholder-panel">
          <ShieldAlert size={30} />
          <h2>No dataset selected</h2>
          <p>
            Please analyze a new dataset or select an existing dataset from
            Report History to inspect flagged anomaly records.
          </p>
          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <button className="primary-button" onClick={onAnalyze}>
              <Upload size={16} /> Analyze a dataset
            </button>
            <button
              className="secondary-button"
              onClick={() => onNavigate?.("Report history")}
            >
              <FileText size={16} /> Choose from history
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="subpage anomaly-page">
      <div className="eyebrow">
        <span className="eyebrow-line" /> INVESTIGATION
      </div>

      <h1>
        Anomaly <span className="gradient-text">explorer.</span>
      </h1>

      <p className="subpage-description">
        Showing flagged records for dataset:{" "}
        <strong>{analysis.filename || "Selected dataset"}</strong>.
      </p>

      <div className="anomaly-metrics">
        <article className="glass anomaly-metric">
          <Database size={20} />
          <span>Records analyzed</span>
          <strong>
            {Number(analysis.total_records ?? 0).toLocaleString()}
          </strong>
        </article>

        <article className="glass anomaly-metric">
          <ShieldAlert size={20} />
          <span>Flagged records</span>
          <strong>
            {Number(analysis.anomalies_detected ?? 0).toLocaleString()}
          </strong>
        </article>

        <article className="glass anomaly-metric">
          <Gauge size={20} />
          <span>Anomaly rate</span>
          <strong>{Number(analysis.anomaly_rate ?? 0)}%</strong>
        </article>
      </div>

      <div className="glass anomaly-toolbar">
        <label className="anomaly-search">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search record or protocol..."
            aria-label="Search flagged records"
          />
        </label>

        <select
          value={protocol}
          onChange={(event) => setProtocol(event.target.value)}
          aria-label="Filter by protocol"
        >
          {protocolOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          aria-label="Sort flagged records"
        >
          <option value="score">Highest anomaly score</option>
          <option value="record">Record number</option>
        </select>

        <button
          className="secondary-button"
          onClick={exportCsv}
          disabled={filteredRecords.length === 0}
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="glass anomaly-table-panel">
        <div className="panel-heading">
          <div>
            <h2>Flagged records</h2>
            <p>
              Showing {filteredRecords.length.toLocaleString()} of{" "}
              {records.length.toLocaleString()} returned records
            </p>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="anomaly-empty">
            <FileSearch size={26} />
            <h3>No flagged records in this dataset</h3>
            <p>
              The model screened all{" "}
              {Number(analysis.total_records ?? 0).toLocaleString()} records in{" "}
              <strong>{analysis.filename || "this dataset"}</strong> and flagged zero
              anomalies. All records appeared normal.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>RECORD</th>
                  <th>PROTOCOL</th>
                  <th>SERVICE</th>
                  <th>DEST. BYTES</th>
                  <th>ANOMALY SCORE</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((record, index) => (
                  <tr key={record.record_number ?? record.id ?? index}>
                    <td>{record.record_number ?? record.id ?? "—"}</td>
                    <td>{record.proto ?? record.protocol ?? "—"}</td>
                    <td>{record.service ?? "—"}</td>
                    <td>
                      {record.dbytes == null
                        ? "—"
                        : Number(record.dbytes).toLocaleString()}
                    </td>
                    <td>
                      {Number(record.anomaly_score ?? 0).toFixed(4)}
                    </td>
                  </tr>
                ))}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-table">
                      No records match your search or filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {analysis.flagged_records_truncated && (
        <p className="subpage-description">
          Only a limited sample of flagged records was returned. Export includes
          only the records currently available here.
        </p>
      )}

      <p className="subpage-description">
        A flagged record is a potential anomaly, not a confirmed attack.
        Anomaly scores are not attack probabilities.
      </p>
    </section>
  );
}
