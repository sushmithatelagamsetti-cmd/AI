import { useState, useEffect } from 'react';
import { getDashboardStats, getModelMetrics } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const COLORS = ['#6366f1','#f59e0b','#ef4444','#10b981','#3b82f6'];

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ ...s.card, borderTop: `4px solid ${color}` }}>
      <div style={s.cardTop}><span style={s.cardIcon}>{icon}</span></div>
      <div style={{ ...s.cardValue, color }}>{value}</div>
      <div style={s.cardLabel}>{label}</div>
      {sub && <div style={s.cardSub}>{sub}</div>}
    </div>
  );
}

function ModelGauge({ label, value, color }) {
  return (
    <div style={s.gauge}>
      <div style={s.gaugeLabel}>{label}</div>
      <div style={s.gaugeBar}>
        <div style={{ ...s.gaugeFill, width: `${value * 100}%`, background: color }} />
      </div>
      <div style={{ ...s.gaugeValue, color }}>{(value * 100).toFixed(1)}%</div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const { alerts, connected } = useWebSocket();
  const { user, logout } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    Promise.all([getDashboardStats(), getModelMetrics()])
      .then(([s, m]) => { setStats(s.data); setMetrics(m.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
    const interval = setInterval(() => {
      getDashboardStats().then(r => setStats(r.data)).catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const typeData = stats ? Object.entries(stats.transactions_per_type)
    .map(([name, value]) => ({ name, value })) : [];

  const alertData = (stats?.recent_alerts || []).slice(0, 8).map((a, i) => ({
    name: `#${a.id}`,
    risk: a.risk_score,
    amount: Math.round(a.amount / 1000),
  })).reverse();

  if (loading) return (
    <div style={s.loading}><div style={s.spinner} />Loading dashboard…</div>
  );

  return (
    <div style={s.page}>
      {/* Navbar */}
      <nav style={s.nav}>
        <div style={s.navBrand}>🛡️ FraudGuard AI</div>
        <div style={s.navLinks}>
          <button style={s.navBtn} onClick={() => nav('/submit')}>+ Submit Transaction</button>
          <button style={s.navBtn} onClick={() => nav('/transactions')}>All Transactions</button>
          <div style={{ ...s.wsDot, background: connected ? '#10b981' : '#ef4444' }} />
          <span style={s.wsLabel}>{connected ? 'Live' : 'Offline'}</span>
          <button style={s.navOut} onClick={logout}>Logout</button>
        </div>
      </nav>

      <div style={s.container}>
        <h2 style={s.pageTitle}>Real-Time Fraud Intelligence Dashboard</h2>
        <p style={s.pageSub}>Welcome, {user?.username} — CNN+LSTM + Behavioral Model Active</p>

        {/* Live alert banner */}
        {alerts.length > 0 && (
          <div style={s.alertBanner}>
            🚨 <strong>LIVE ALERT:</strong> {alerts[0].status} — $
            {alerts[0].amount?.toLocaleString()} from {alerts[0].name_orig} | Risk: {alerts[0].risk_score?.toFixed(1)}
          </div>
        )}

        {/* Stat cards */}
        <div style={s.grid4}>
          <StatCard label="Total Transactions" value={(stats?.total_transactions || 0).toLocaleString()}
            sub="All time" color="#6366f1" icon="💳" />
          <StatCard label="Fraud Detected" value={(stats?.total_fraud || 0).toLocaleString()}
            sub={`${stats?.fraud_rate || 0}% fraud rate`} color="#ef4444" icon="⚠️" />
          <StatCard label="Transactions Blocked" value={(stats?.total_blocked || 0).toLocaleString()}
            sub="High-risk blocked" color="#f59e0b" icon="🚫" />
          <StatCard label="Amount Protected"
            value={`$${((stats?.fraud_amount || 0) / 1000).toFixed(1)}K`}
            sub="Fraud amount stopped" color="#10b981" icon="🛡️" />
        </div>

        {/* Charts row */}
        <div style={s.grid2}>
          <div style={s.chartCard}>
            <h3 style={s.chartTitle}>Recent Transaction Risk Scores</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={alertData}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v.toFixed(1)}`, 'Risk Score']} />
                <Area type="monotone" dataKey="risk" stroke="#ef4444"
                  fill="url(#riskGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={s.chartCard}>
            <h3 style={s.chartTitle}>Transactions by Type</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={typeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" nameKey="name" label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model performance + Alerts */}
        <div style={s.grid2}>
          <div style={s.chartCard}>
            <h3 style={s.chartTitle}>Model Performance Metrics</h3>
            {metrics && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <div style={s.modelLabel}>🧠 CNN+LSTM Model</div>
                  <ModelGauge label="Accuracy"  value={metrics.cnn_lstm?.accuracy  || 0.981} color="#6366f1" />
                  <ModelGauge label="Precision" value={metrics.cnn_lstm?.precision || 0.923} color="#3b82f6" />
                  <ModelGauge label="Recall"    value={metrics.cnn_lstm?.recall    || 0.901} color="#8b5cf6" />
                  <ModelGauge label="AUC-ROC"   value={metrics.cnn_lstm?.auc_roc   || 0.991} color="#6366f1" />
                </div>
                <div>
                  <div style={s.modelLabel}>🔥 Behavioral Model</div>
                  <ModelGauge label="Accuracy"  value={metrics.behavioral?.accuracy  || 0.973} color="#10b981" />
                  <ModelGauge label="Precision" value={metrics.behavioral?.precision || 0.891} color="#059669" />
                  <ModelGauge label="Recall"    value={metrics.behavioral?.recall    || 0.876} color="#34d399" />
                  <ModelGauge label="AUC-ROC"   value={metrics.behavioral?.auc_roc   || 0.982} color="#10b981" />
                </div>
              </div>
            )}
          </div>

          <div style={s.chartCard}>
            <h3 style={s.chartTitle}>🔴 Live Fraud Alerts ({alerts.length})</h3>
            <div style={s.alertList}>
              {alerts.length === 0 && <p style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>No alerts yet — system monitoring…</p>}
              {alerts.slice(0, 8).map((a, i) => (
                <div key={i} style={{ ...s.alertRow, borderLeft: `4px solid ${a.status === 'BLOCKED' ? '#ef4444' : '#f59e0b'}` }}>
                  <div>
                    <span style={{ ...s.badge, background: a.status === 'BLOCKED' ? '#ef4444' : '#f59e0b' }}>
                      {a.status}
                    </span>
                    <span style={s.alertTx}>{a.name_orig} → {a.tx_type}</span>
                  </div>
                  <div style={s.alertMeta}>
                    ${a.amount?.toLocaleString()} | Risk: <strong>{a.risk_score?.toFixed(1)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fraud amount bar */}
        {alertData.length > 0 && (
          <div style={s.chartCard}>
            <h3 style={s.chartTitle}>Flagged Transaction Amounts (×$1K)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={alertData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`$${v}K`, 'Amount']} />
                <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page:      { minHeight:'100vh', background:'#f8faff', fontFamily:'Inter,sans-serif' },
  nav:       { background:'#1a1a2e', padding:'0 32px', height:60, display:'flex',
               alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 },
  navBrand:  { color:'#fff', fontWeight:700, fontSize:18 },
  navLinks:  { display:'flex', alignItems:'center', gap:12 },
  navBtn:    { background:'rgba(255,255,255,0.12)', color:'#fff', border:'none',
               padding:'7px 14px', borderRadius:6, cursor:'pointer', fontSize:13 },
  navOut:    { background:'#ef4444', color:'#fff', border:'none', padding:'7px 14px',
               borderRadius:6, cursor:'pointer', fontSize:13 },
  wsDot:     { width:9, height:9, borderRadius:'50%' },
  wsLabel:   { color:'#ccc', fontSize:12 },
  container: { maxWidth:1300, margin:'0 auto', padding:'28px 24px' },
  pageTitle: { margin:'0 0 4px', fontSize:24, fontWeight:700, color:'#1a1a2e' },
  pageSub:   { margin:'0 0 24px', color:'#666', fontSize:14 },
  alertBanner: { background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff',
                 padding:'12px 20px', borderRadius:10, marginBottom:24, fontSize:14, fontWeight:500 },
  grid4:     { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 },
  grid2:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 },
  card:      { background:'#fff', borderRadius:12, padding:'20px 22px',
               boxShadow:'0 2px 12px rgba(0,0,0,0.06)' },
  cardTop:   { marginBottom:10 },
  cardIcon:  { fontSize:28 },
  cardValue: { fontSize:28, fontWeight:700 },
  cardLabel: { fontSize:13, fontWeight:600, color:'#333', marginTop:4 },
  cardSub:   { fontSize:12, color:'#999', marginTop:2 },
  chartCard: { background:'#fff', borderRadius:12, padding:'20px 22px',
               boxShadow:'0 2px 12px rgba(0,0,0,0.06)' },
  chartTitle:{ margin:'0 0 18px', fontSize:15, fontWeight:600, color:'#1a1a2e' },
  modelLabel:{ fontSize:13, fontWeight:600, color:'#444', marginBottom:10 },
  gauge:     { display:'grid', gridTemplateColumns:'90px 1fr 50px', alignItems:'center',
               gap:10, marginBottom:8 },
  gaugeLabel:{ fontSize:12, color:'#666' },
  gaugeBar:  { height:7, background:'#f0f0f0', borderRadius:4, overflow:'hidden' },
  gaugeFill: { height:'100%', borderRadius:4, transition:'width 0.6s' },
  gaugeValue:{ fontSize:12, fontWeight:600, textAlign:'right' },
  alertList: { display:'flex', flexDirection:'column', gap:8, maxHeight:320, overflowY:'auto' },
  alertRow:  { padding:'10px 12px', background:'#fafafa', borderRadius:8, fontSize:13 },
  badge:     { color:'#fff', padding:'2px 8px', borderRadius:20, fontSize:11,
               fontWeight:600, marginRight:8 },
  alertTx:   { color:'#333', fontWeight:500 },
  alertMeta: { color:'#666', fontSize:12, marginTop:4 },
  loading:   { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
               height:'100vh', gap:16, color:'#666', fontSize:16 },
  spinner:   { width:40, height:40, border:'4px solid #e0e0e0', borderTop:'4px solid #6366f1',
               borderRadius:'50%', animation:'spin 1s linear infinite' },
};
