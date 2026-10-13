import { useMemo } from "react";
import {
  Activity,
  Database,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  Upload,
  FileText,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./Analytics.css";

const COLORS = [
  "#00C2FF", // Electric cyan
  "#A855F7", // Vivid purple
  "#FF3864", // Hot pink
  "#00E5A8", // Neon mint
  "#FFD43B", // Bright yellow
  "#6366FF", // Electric indigo
];

const number = (value) => Number(value ?? 0);

const format = (value) => number(value).toLocaleString();

function MetricCard({ icon: Icon, label, value, detail, tone }) {
  return (
    <article className="glass metric-card analytics-metric">
      <div className={`metric-icon ${tone}`}>
        <Icon size={21} />
      </div>

      <div className="metric-body">
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function ChartPanel({ title, subtitle, children }) {
  return (
    <section className="glass panel analytics-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

export default function Analytics({
  analysis,
  onNavigate,
}) {
  const tooltipStyle = {
    background: "#111c2e",
    border: "1px solid #3b4b65",
    borderRadius: 10,
    color: "#f2f6ff",
  };

  const protocols = useMemo(() => {
    const summary = analysis?.protocol_summary;

    if (!Array.isArray(summary)) {
      return [];
    }

    return summary
      .map((item, index) => ({
        name:
          item.name ||
          item.protocol ||
          `Protocol ${index + 1}`,
        value: number(item.value ?? item.count),
        flagged: number(item.flagged ?? 0),
        color: COLORS[index % COLORS.length],
      }))
      .filter((item) => item.value > 0);
  }, [analysis]);

  const traffic = useMemo(() => {
    return Array.isArray(analysis?.traffic_summary)
      ? analysis.traffic_summary
      : [];
  }, [analysis]);

  const batchRates = useMemo(() => {
    return traffic.map((batch) => {
      const normal = number(batch.normal);
      const flagged = number(batch.flagged);
      const total = normal + flagged;
      const rate = total > 0 ? Number(((flagged / total) * 100).toFixed(2)) : 0;
      return {
        time: batch.time,
        rate,
        normal,
        flagged,
      };
    });
  }, [traffic]);

  if (!analysis) {
    return (
      <section className="subpage analytics-page">
        <div className="eyebrow">
          <span className="eyebrow-line" />
          NETWORK INTELLIGENCE
        </div>

        <h1>
          Data <span className="gradient-text">analytics.</span>
        </h1>

        <p className="subpage-description">
          Detailed traffic patterns, protocols, and anomaly breakdown for a selected dataset.
        </p>

        <div className="glass analytics-empty">
          <BarChart3 size={36} />

          <h2>No dataset selected</h2>

          <p>
            Please analyze a new dataset or select an existing dataset from
            Report History to view detailed dataset analytics.
          </p>

          <div className="analytics-empty-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => onNavigate?.("Analyze data")}
            >
              <Upload size={16} /> Analyze new dataset
            </button>
            <button
              type="button"
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

  const totalRecords = number(analysis.total_records);
  const anomaliesDetected = number(analysis.anomalies_detected);
  const normalRecords = number(
    analysis.normal_records != null
      ? analysis.normal_records
      : Math.max(0, totalRecords - anomaliesDetected)
  );
  const anomalyRate =
    analysis.anomaly_rate != null
      ? analysis.anomaly_rate
      : totalRecords > 0
        ? Number(((anomaliesDetected / totalRecords) * 100).toFixed(2))
        : 0;

  return (
    <section className="subpage analytics-page">
      <div className="analytics-heading-row">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            DATASET INTELLIGENCE
          </div>

          <h1>
            Data <span className="gradient-text">analytics.</span>
          </h1>

          <p className="subpage-description">
            Showing analytics exclusively for <strong>{analysis.filename}</strong>.
          </p>
        </div>

        <div className="analytics-live-tag">
          <span />
          ACTIVE DATASET
        </div>
      </div>

      {/* Summary metrics for the active dataset */}
      <div className="metrics-grid analytics-metrics-grid">
        <MetricCard
          icon={Database}
          label="Total records"
          value={format(totalRecords)}
          detail="Records in this dataset"
          tone="blue"
        />

        <MetricCard
          icon={ShieldAlert}
          label="Flagged records"
          value={format(anomaliesDetected)}
          detail="Marked for investigation"
          tone="rose"
        />

        <MetricCard
          icon={ShieldCheck}
          label="Normal-looking"
          value={format(normalRecords)}
          detail="Standard network patterns"
          tone="mint"
        />

        <MetricCard
          icon={TrendingUp}
          label="Anomaly rate"
          value={`${anomalyRate}%`}
          detail="Share flagged by model"
          tone="violet"
        />
      </div>

      {/* Analytics charts for active dataset */}
      <div className="analytics-chart-grid">
        {/* Traffic activity by batch */}
        <ChartPanel
          title="Traffic activity by batch"
          subtitle={`Normal-looking vs flagged records across row batches in ${analysis.filename}.`}
        >
          {traffic.length > 0 ? (
            <>
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={traffic}
                    margin={{
                      top: 14,
                      right: 8,
                      left: -19,
                      bottom: 0,
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="analyticsNormalGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#66a6ff"
                          stopOpacity={0.26}
                        />
                        <stop
                          offset="95%"
                          stopColor="#66a6ff"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="analyticsFlaggedGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#ff7188"
                          stopOpacity={0.23}
                        />
                        <stop
                          offset="95%"
                          stopColor="#ff7188"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      stroke="#9ab2d0"
                      strokeOpacity={0.1}
                      strokeDasharray="4 5"
                    />

                    <XAxis
                      dataKey="time"
                      tick={{ fill: "#8498b5", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      dy={8}
                      interval="preserveStartEnd"
                    />

                    <YAxis
                      tick={{ fill: "#8498b5", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip contentStyle={tooltipStyle} />

                    <Area
                      type="monotone"
                      dataKey="normal"
                      name="Normal-looking"
                      stroke="#6aa9ff"
                      strokeWidth={2.3}
                      fill="url(#analyticsNormalGradient)"
                    />

                    <Area
                      type="monotone"
                      dataKey="flagged"
                      name="Flagged"
                      stroke="#ff7188"
                      strokeWidth={2}
                      fill="url(#analyticsFlaggedGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="analytics-legend">
                <span>
                  <i className="legend-normal" />
                  Normal-looking
                </span>
                <span>
                  <i className="legend-flagged" />
                  Flagged
                </span>
              </div>
            </>
          ) : (
            <div className="analytics-no-chart">
              <Activity size={24} />
              <p>No traffic batch summary is available for this dataset.</p>
            </div>
          )}
        </ChartPanel>

        {/* Batch anomaly rate trend */}
        <ChartPanel
          title="Batch anomaly rate trend"
          subtitle="Shows percentage of flagged records across consecutive row batches."
        >
          {batchRates.length > 0 ? (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={batchRates}
                  margin={{
                    top: 12,
                    right: 8,
                    left: -15,
                    bottom: 0,
                  }}
                >
                  <defs>
                    <linearGradient
                      id="analyticsBatchRateGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#c084fc"
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor="#c084fc"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="#9ab2d0"
                    strokeOpacity={0.1}
                    strokeDasharray="4 5"
                  />

                  <XAxis
                    dataKey="time"
                    tick={{ fill: "#8498b5", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                    interval="preserveStartEnd"
                  />

                  <YAxis
                    unit="%"
                    tick={{ fill: "#8498b5", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, "auto"]}
                  />

                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [
                      `${Number(value).toFixed(2)}%`,
                      "Batch anomaly rate",
                    ]}
                  />

                  <Area
                    type="monotone"
                    dataKey="rate"
                    name="Anomaly rate"
                    stroke="#c084fc"
                    strokeWidth={2.4}
                    fill="url(#analyticsBatchRateGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="analytics-no-chart">
              <Activity size={24} />
              <p>No batch rate activity is available for this dataset.</p>
            </div>
          )}
        </ChartPanel>

        {/* Protocol distribution */}
        <ChartPanel
          title="Protocol distribution"
          subtitle={`Protocol distribution in ${analysis.filename}.`}
        >
          {protocols.length > 0 ? (
            <div className="analytics-donut-layout">
              <div className="analytics-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={protocols}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="62%"
                      outerRadius="88%"
                      paddingAngle={2}
                      stroke="none"
                      activeShape={false}
                    >
                      {protocols.map((item) => (
                        <Cell
                          key={item.name}
                          fill={item.color}
                        />
                      ))}
                    </Pie>

                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={false}
                      formatter={(value, name) => [
                        format(value),
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="analytics-protocol-list">
                {protocols.map((item) => {
                  const total = protocols.reduce(
                    (sum, protocol) => sum + protocol.value,
                    0
                  );

                  const percentage = total
                    ? ((item.value / total) * 100).toFixed(1)
                    : "0.0";

                  return (
                    <div
                      className="analytics-protocol-item"
                      key={item.name}
                    >
                      <span>
                        <i
                          style={{
                            background: item.color,
                          }}
                        />
                        {item.name}
                      </span>

                      <strong>{percentage}%</strong>
                      <small>{format(item.value)}</small>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="analytics-no-chart">
              <Activity size={24} />
              <p>
                No protocol summary is available for this dataset.
              </p>
            </div>
          )}
        </ChartPanel>

        {/* Traffic classification */}
        <ChartPanel
          title="Traffic classification"
          subtitle={`Summary of normal vs flagged records in ${analysis.filename}.`}
        >
          <div className="analytics-classification-layout">
            <div className="analytics-classification-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "Normal-looking",
                        value: normalRecords,
                      },
                      {
                        name: "Flagged",
                        value: anomaliesDetected,
                      },
                    ].filter((item) => item.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="84%"
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    <Cell fill="#00C2FF" />
                    <Cell fill="#FF3864" />
                  </Pie>

                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={false}
                    formatter={(value, name) => [
                      format(value),
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="analytics-classification-legend">
              <div className="analytics-classification-item">
                <i className="classification-normal-dot" />
                <span>Normal-looking</span>
                <strong>{format(normalRecords)}</strong>
              </div>

              <div className="analytics-classification-item">
                <i className="classification-flagged-dot" />
                <span>Flagged for review</span>
                <strong>{format(anomaliesDetected)}</strong>
              </div>

              <p className="analytics-classification-note">
                Flagged records may contain unusual patterns.
                They are not, by themselves, proof of an attack.
              </p>
            </div>
          </div>
        </ChartPanel>
      </div>

      <p className="analytics-footnote">
        <Activity size={14} />
        Anomaly scores and flagged records indicate unusual
        patterns for investigation; they are not proof of an attack.
      </p>
    </section>
  );
}
