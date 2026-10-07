import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  CheckCircle,
  CirclePause,
  Cpu,
  Play,
  ShieldAlert,
  Wifi,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './App.css';

const WS_URL = 'ws://127.0.0.1:8000/ws/traffic';
const API_URL = 'http://127.0.0.1:8000/api/metrics';

const emptyProtocols = { TCP: 0, UDP: 0, ICMP: 0, OTHER: 0 };

function App() {
  const [packets, setPackets] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [protocolCounts, setProtocolCounts] = useState(emptyProtocols);
  const [metrics, setMetrics] = useState({
    accuracy: 100,
    totalProcessed: 0,
    anomaliesDetected: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(true);
  const socketRef = useRef(null);

  const connectStream = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState <= 1) return;

    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setIsStreaming(true);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      setPackets((prev) => [data, ...prev.slice(0, 19)]);

      setChartData((prev) => [
        ...prev.slice(-14),
        {
          time: data.timestamp,
          sload: Math.round(data.sload),
          is_anomaly: data.is_anomaly,
        },
      ]);

      setProtocolCounts((prev) => ({
        ...prev,
        [data.protocol]: (prev[data.protocol] || 0) + 1,
      }));

      setMetrics((prev) => ({
        ...prev,
        totalProcessed: prev.totalProcessed + 1,
        anomaliesDetected:
          data.is_anomaly === 1
            ? prev.anomaliesDetected + 1
            : prev.anomaliesDetected,
      }));
    };
  }, []);

  useEffect(() => {
    fetch(API_URL)
      .then((res) => res.json())
      .then((data) => setMetrics((prev) => ({ ...prev, accuracy: data.accuracy })))
      .catch((err) => console.error('Metrics API error:', err));

    connectStream();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connectStream]);

  const pauseStream = () => {
    setIsStreaming(false);
    setIsConnected(false);
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  };

  const startStream = () => {
    setIsStreaming(true);
    connectStream();
  };

  const normalTraffic = Math.max(
    metrics.totalProcessed - metrics.anomaliesDetected,
    0
  );
  const threatRate = metrics.totalProcessed
    ? ((metrics.anomaliesDetected / metrics.totalProcessed) * 100).toFixed(1)
    : '0.0';

  const protocolData = Object.entries(protocolCounts).map(([protocol, count]) => ({
    protocol,
    packets: count,
  }));

  return (
    <div className="dashboard-container">
      <header className="header">
        <div className="header-copy">
          <h1>Real-Time Network Traffic Anomaly Monitor</h1>
          <p>
            Machine Learning Powered Security Engine (Random Forest)
          </p>
        </div>
        <div className={`status-badge ${isConnected ? 'live' : 'paused'}`}>
          {isConnected ? '● STREAM LIVE' : isStreaming ? '○ CONNECTING' : 'Ⅱ STREAM PAUSED'}
        </div>
      </header>

      <div className="stream-controls">
        <div className="stream-info">
          <Wifi size={17} />
          <span>{isConnected ? 'Receiving simulated network traffic' : 'Traffic stream is paused'}</span>
        </div>
        <div className="control-buttons">
          <button className="control-button" onClick={startStream} disabled={isConnected}>
            <Play size={15} /> Start
          </button>
          <button className="control-button pause-button" onClick={pauseStream} disabled={!isConnected}>
            <CirclePause size={15} /> Pause
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title"><Activity size={16} /> Total Packets Evaluated</div>
          <div className="metric-value">{metrics.totalProcessed}</div>
        </div>
        <div className="metric-card">
          <div className="metric-title"><ShieldAlert size={16} /> Threats Flagged</div>
          <div className="metric-value threat-value">{metrics.anomaliesDetected}</div>
        </div>
        <div className="metric-card">
          <div className="metric-title"><CheckCircle size={16} /> Normal Traffic</div>
          <div className="metric-value normal-value">{normalTraffic}</div>
        </div>
        <div className="metric-card">
          <div className="metric-title"><ShieldAlert size={16} /> Threat Rate</div>
          <div className="metric-value warning-value">{threatRate}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-title"><CheckCircle size={16} /> Model Accuracy</div>
          <div className="metric-value accuracy-value">{metrics.accuracy}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-title"><Cpu size={16} /> Classifier Engine</div>
          <div className="metric-value classifier-value">Random Forest</div>
        </div>
      </div>

      <div className="content-grid">
        <div className="chart-card">
          <div className="card-heading">
            <div>
              <h3>Source Traffic Load (Sload) Over Time</h3>
              <p>Real-time stream visualization</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={270}>
            <LineChart data={chartData}>
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
              />
              <Line
                type="monotone"
                dataKey="sload"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card protocol-card">
          <div className="card-heading">
            <div>
              <h3>Protocol Distribution</h3>
              <p>Packets received by protocol</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={protocolData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="protocol" stroke="#64748b" />
              <YAxis allowDecimals={false} stroke="#64748b" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
              />
              <Bar dataKey="packets" fill="#818cf8" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="table-card full-width-card">
        <div className="card-heading">
          <div>
            <h3>Live Packet Inspection</h3>
            <p>Latest traffic classifications and basic anomaly explanations</p>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Proto</th>
                <th>TTL</th>
                <th>Sload</th>
                <th>Status</th>
                <th>Severity</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {packets.map((pkt) => (
                <tr key={`${pkt.packet_id}-${pkt.timestamp}`}>
                  <td>{pkt.timestamp}</td>
                  <td>{pkt.protocol}</td>
                  <td>{pkt.sttl}</td>
                  <td>{Math.round(pkt.sload).toLocaleString()}</td>
                  <td>
                    {pkt.is_anomaly === 1 ? (
                      <span className="badge-anomaly">ANOMALY</span>
                    ) : (
                      <span className="badge-normal">NORMAL</span>
                    )}
                  </td>
                  <td>
                    <span className={`severity-badge severity-${pkt.severity.toLowerCase()}`}>
                      {pkt.severity}
                    </span>
                  </td>
                  <td className="reason-cell">{pkt.reason}</td>
                </tr>
              ))}
              {packets.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty-state">Waiting for traffic data...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
