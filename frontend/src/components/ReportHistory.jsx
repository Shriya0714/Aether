
import { useMemo, useState } from "react";
import {
  Search,
  X,
  FileText,
  Download,
  Database,
  ShieldAlert,
  ShieldCheck,
  CalendarDays,
  FileDown,
  ChevronRight,
} from "lucide-react";
import { jsPDF } from "jspdf";
import "./ReportHistory.css";

const formatNumber = (value) =>
  Number(value || 0).toLocaleString();

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
};

function downloadPdf(report) {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const addPageIfNeeded = (height = 8) => {
    if (y + height > pageHeight - 16) {
      pdf.addPage();
      y = 20;
    }
  };

  const addText = (text, options = {}) => {
    const {
      size = 10,
      bold = false,
      gap = 6,
    } = options;

    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);

    const lines = pdf.splitTextToSize(
      String(text ?? "—"),
      contentWidth
    );

    addPageIfNeeded(lines.length * (size * 0.45) + gap);

    pdf.text(lines, margin, y);
    y += lines.length * (size * 0.45) + gap;
  };

  // Report heading
  pdf.setFillColor(13, 24, 43);
  pdf.rect(0, 0, pageWidth, 43, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(21);
  pdf.text("aether.", margin, 18);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("NETWORK ANOMALY INTELLIGENCE", margin, 26);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("Dataset Analysis Report", margin, 36);

  y = 54;
  pdf.setTextColor(30, 43, 63);

  addText("Dataset details", { size: 14, bold: true, gap: 9 });
  addText(`Dataset: ${report.filename || "Unnamed dataset"}`);
  addText(`Analysis date: ${formatDate(report.analyzedAt)}`);
  addText(`Report ID: ${report.historyId || "Not available"}`);
  y += 4;

  addText("Analysis summary", { size: 14, bold: true, gap: 9 });
  addText(`Total records: ${formatNumber(report.total_records)}`);
  addText(
    `Potential anomalies flagged: ${formatNumber(report.anomalies_detected)}`
  );
  addText(
    `Normal-looking records: ${formatNumber(
      report.normal_records ??
        Number(report.total_records || 0) -
          Number(report.anomalies_detected || 0)
    )}`
  );
  addText(`Anomaly rate: ${Number(report.anomaly_rate || 0)}%`);
  y += 4;

  addText("Traffic summary", { size: 14, bold: true, gap: 9 });

  if (report.traffic_summary?.length) {
    report.traffic_summary.forEach((batch) => {
      addText(
        `${batch.time || "Batch"} — Normal-looking: ${formatNumber(
          batch.normal
        )}; Flagged: ${formatNumber(batch.flagged)}`
      );
    });
  } else {
    addText("Traffic batch details are not available.");
  }

  y += 4;
  addText("Protocol summary", { size: 14, bold: true, gap: 9 });

  if (report.protocol_summary?.length) {
    report.protocol_summary.forEach((protocol) => {
      addText(
        `${protocol.name || "Unknown"} — ${formatNumber(
          protocol.value
        )} records; ${formatNumber(protocol.flagged)} flagged`
      );
    });
  } else {
    addText("Protocol details are not available.");
  }

  y += 4;
  addText("Flagged record details", {
    size: 14,
    bold: true,
    gap: 9,
  });

  const flaggedRecords = report.flagged_records || [];

  if (flaggedRecords.length) {
    flaggedRecords.forEach((record, index) => {
      const recordNumber =
        record.record_number ?? record.id ?? index + 1;

      const details = Object.entries(record)
        .filter(([key]) => key !== "anomaly")
        .map(([key, value]) => `${key}: ${value ?? "—"}`)
        .join(" | ");

      addText(`Record ${recordNumber}`, {
        size: 10,
        bold: true,
        gap: 4,
      });
      addText(details || "No additional record details available.", {
        size: 8,
        gap: 7,
      });
    });

    if (report.flagged_records_truncated) {
      addText(
        "Note: This report includes only the first 200 flagged records returned by the API."
      );
    }
  } else {
    addText(
      "No flagged-record details were saved with this analysis."
    );
  }

  y += 5;
  addText(
    "Interpretation: Flagged records are potential anomalies that warrant investigation. They are not confirmed attacks. Anomaly scores are not attack probabilities.",
    { size: 9, gap: 8 }
  );

  // Footer on every page
  const pageCount = pdf.internal.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(110, 125, 145);

    pdf.text(
      `Aether Analysis Report · Page ${page} of ${pageCount}`,
      margin,
      pageHeight - 8
    );
  }

  const safeName = (report.filename || "dataset")
    .replace(/\.csv$/i, "")
    .replace(/[^a-z0-9_-]+/gi, "_")
    .slice(0, 70);

  pdf.save(`aether-report-${safeName || "dataset"}.pdf`);
}

export default function ReportHistory({
  analysisHistory = [],
  activeHistoryId,
  onSelectAnalysis,
}) {
  const [query, setQuery] = useState("");

  const filteredHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return analysisHistory
      .filter((item) => {
        const searchableText = [
          item.filename,
          item.historyId,
          item.analyzedAt,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedQuery);
      })
      .sort(
        (a, b) =>
          new Date(b.analyzedAt || 0).getTime() -
          new Date(a.analyzedAt || 0).getTime()
      );
  }, [analysisHistory, query]);

  const totals = useMemo(
    () =>
      analysisHistory.reduce(
        (summary, item) => ({
          records:
            summary.records + Number(item.total_records || 0),
          flagged:
            summary.flagged +
            Number(item.anomalies_detected || 0),
        }),
        { records: 0, flagged: 0 }
      ),
    [analysisHistory]
  );

  return (
    <section className="subpage report-history-page">
      <div className="eyebrow">
        <span className="eyebrow-line" />
        YOUR WORKSPACE
      </div>

      <h1>
        Report <span className="gradient-text">history.</span>
      </h1>

      <p className="subpage-description">
        Find previous dataset analyses and download a PDF report
        whenever you need it.
      </p>

      <div className="metrics-grid report-history-metrics">
        <article className="glass metric-card">
          <div className="metric-icon blue">
            <FileText size={21} />
          </div>
          <div className="metric-body">
            <p>Saved analyses</p>
            <strong>{formatNumber(analysisHistory.length)}</strong>
            <small>Successful analyses</small>
          </div>
        </article>

        <article className="glass metric-card">
          <div className="metric-icon mint">
            <Database size={21} />
          </div>
          <div className="metric-body">
            <p>Total records</p>
            <strong>{formatNumber(totals.records)}</strong>
            <small>Across saved analyses</small>
          </div>
        </article>

        <article className="glass metric-card">
          <div className="metric-icon rose">
            <ShieldAlert size={21} />
          </div>
          <div className="metric-body">
            <p>Potential anomalies</p>
            <strong>{formatNumber(totals.flagged)}</strong>
            <small>Records flagged for review</small>
          </div>
        </article>
      </div>

      <section className="glass panel report-history-panel">
        <div className="report-history-heading">
          <div>
            <h2>Previous analyses</h2>
            <p>
              {filteredHistory.length} of {analysisHistory.length}{" "}
              saved datasets
            </p>
          </div>
          <span className="panel-badge">
            <CalendarDays size={13} />
            ANALYSIS LOG
          </span>
        </div>

        <div className="history-toolbar">
          <label className="history-search-box">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by dataset name..."
              aria-label="Search saved analyses"
            />
            {query && (
              <button
                type="button"
                className="history-search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </label>

          <span className="history-result-count">
            {filteredHistory.length}{" "}
            {filteredHistory.length === 1 ? "result" : "results"}
          </span>
        </div>

        <div className="table-wrap report-history-table-wrap">
          <table className="report-history-table">
            <thead>
              <tr>
                <th>DATASET</th>
                <th>ANALYSIS DATE</th>
                <th>RECORDS</th>
                <th>FLAGGED</th>
                <th>NORMAL-LOOKING</th>
                <th>ANOMALY RATE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {filteredHistory.map((item, index) => {
                const total = Number(item.total_records || 0);
                const flagged = Number(
                  item.anomalies_detected || 0
                );
                const normal = Number.isFinite(
                  Number(item.normal_records)
                )
                  ? Number(item.normal_records)
                  : Math.max(0, total - flagged);
                const isActive = item.historyId === activeHistoryId;

                return (
                  <tr
                    key={
                      item.historyId ||
                      `${item.filename}-${item.analyzedAt}-${index}`
                    }
                    className={`history-row ${isActive ? "history-row-active" : ""}`}
                    onClick={() => onSelectAnalysis?.(item)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectAnalysis?.(item);
                      }
                    }}
                    aria-label={`Open analytics for ${item.filename || "dataset"}`}
                  >
                    <td className="history-dataset-cell">
                      <span className="history-file-icon">
                        <FileText size={17} />
                      </span>
                      <div className="history-dataset-info">
                        <span
                          className="history-dataset-name"
                          title={item.filename}
                        >
                          {item.filename || "Unnamed dataset"}
                        </span>
                        {isActive && (
                          <span className="history-active-badge">Active</span>
                        )}
                      </div>
                    </td>

                    <td className="history-date-cell">
                      {formatDate(item.analyzedAt)}
                    </td>

                    <td>{formatNumber(total)}</td>

                    <td>
                      <span className="history-flagged-value">
                        {formatNumber(flagged)}
                      </span>
                    </td>

                    <td>
                      <span className="history-normal-value">
                        <ShieldCheck size={14} />
                        {formatNumber(normal)}
                      </span>
                    </td>

                    <td>
                      <span className="history-rate">
                        {Number(item.anomaly_rate || 0)}%
                      </span>
                    </td>

                    <td className="history-actions-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="history-action-buttons">
                        <button
                          type="button"
                          className="history-view-btn"
                          onClick={() => onSelectAnalysis?.(item)}
                          title={`View analytics for ${
                            item.filename || "this dataset"
                          }`}
                        >
                          <span>Analytics</span>
                          <ChevronRight size={13} />
                        </button>
                        <button
                          type="button"
                          className="history-download-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadPdf(item);
                          }}
                          title={`Download PDF report for ${
                            item.filename || "this dataset"
                          }`}
                        >
                          <Download size={14} />
                          <span>PDF</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="history-empty-state">
                      <span className="history-empty-icon">
                        {analysisHistory.length === 0 ? (
                          <FileDown size={25} />
                        ) : (
                          <Search size={25} />
                        )}
                      </span>
                      <strong>
                        {analysisHistory.length === 0
                          ? "No saved analyses yet"
                          : "No matching datasets"}
                      </strong>
                      <p>
                        {analysisHistory.length === 0
                          ? "Upload a CSV and run anomaly detection. Your successful analyses will appear here."
                          : "Try another dataset name or clear your search."}
                      </p>
                      {query && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setQuery("")}
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="history-footnote">
          Reports include the saved analysis summary and available
          flagged-record details. Flagged records are potential
          anomalies, not confirmed attacks.
        </p>
      </section>
    </section>
  );
}
