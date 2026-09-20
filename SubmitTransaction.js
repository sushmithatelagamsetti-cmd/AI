import { useState } from 'react';
import { submitTransaction } from '../services/api';
import { useNavigate } from 'react-router-dom';

const TX_TYPES = ['PAYMENT', 'TRANSFER', 'CASH_OUT', 'CASH_IN', 'DEBIT'];

const RISK_CONFIG = {
  APPROVED: { color: '#10b981', bg: '#ecfdf5', icon: '✅', label: 'APPROVED' },
  FLAGGED:  { color: '#f59e0b', bg: '#fffbeb', icon: '⚠️', label: 'FLAGGED FOR REVIEW' },
  BLOCKED:  { color: '#ef4444', bg: '#fef2f2', icon: '🚫', label: 'BLOCKED' },
};

export default function SubmitTransaction() {
  const [form, setForm] = useState({
    step: 1, type: 'PAYMENT', amount: '',
    name_orig: 'C100000001', old_balance_orig: '', new_balance_orig: '',
    name_dest: 'M200000001', old_balance_dest: '0', new_balance_dest: '0',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nav = useNavigate();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      const payload = {
        ...form,
        step: parseInt(form.step),
        amount: parseFloat(form.amount),
        old_balance_orig: parseFloat(form.old_balance_orig || 0),
        new_balance_orig: parseFloat(form.new_balance_orig || 0),
        old_balance_dest: parseFloat(form.old_balance_dest || 0),
        new_balance_dest: parseFloat(form.new_balance_dest || 0),
      };
      const res = await submitTransaction(payload);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Submission failed');
    } finally { setLoading(false); }
  };

  const cfg = result ? RISK_CONFIG[result.status] || RISK_CONFIG.APPROVED : null;

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <button style={s.back} onClick={() => nav('/dashboard')}>← Dashboard</button>
        <span style={s.navTitle}>🛡️ Submit Transaction</span>
      </nav>

      <div style={s.container}>
        <div style={s.grid}>
          {/* Form */}
          <div style={s.formCard}>
            <h2 style={s.title}>New Transaction</h2>
            <p style={s.sub}>Submit a transaction for real-time CNN+LSTM fraud analysis</p>
            {error && <div style={s.errBox}>{error}</div>}
            <form onSubmit={submit}>
              <div style={s.row2}>
                <Field label="Transaction Step (Hour)" type="number"
                  value={form.step} onChange={v => set('step', v)} />
                <div>
                  <label style={s.label}>Transaction Type</label>
                  <select style={s.input} value={form.type} onChange={e => set('type', e.target.value)}>
                    {TX_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <Field label="Amount ($)" type="number" step="0.01"
                value={form.amount} onChange={v => set('amount', v)} required />
              <div style={s.row2}>
                <Field label="Origin Account (nameOrig)"
                  value={form.name_orig} onChange={v => set('name_orig', v)} />
                <Field label="Destination Account (nameDest)"
                  value={form.name_dest} onChange={v => set('name_dest', v)} />
              </div>
              <div style={s.row2}>
                <Field label="Origin Old Balance" type="number" step="0.01"
                  value={form.old_balance_orig} onChange={v => set('old_balance_orig', v)} />
                <Field label="Origin New Balance" type="number" step="0.01"
                  value={form.new_balance_orig} onChange={v => set('new_balance_orig', v)} />
              </div>
              <div style={s.row2}>
                <Field label="Dest Old Balance" type="number" step="0.01"
                  value={form.old_balance_dest} onChange={v => set('old_balance_dest', v)} />
                <Field label="Dest New Balance" type="number" step="0.01"
                  value={form.new_balance_dest} onChange={v => set('new_balance_dest', v)} />
              </div>
              <button type="submit" style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
                {loading ? '🔍 Analyzing…' : '🚀 Analyze Transaction'}
              </button>
            </form>
          </div>

          {/* Result */}
          <div>
            {!result && (
              <div style={s.emptyCard}>
                <div style={{ fontSize: 64 }}>🔍</div>
                <p style={{ color: '#888', marginTop: 12 }}>
                  Submit a transaction to see the fraud prediction result
                </p>
              </div>
            )}
            {result && cfg && (
              <div style={{ ...s.resultCard, background: cfg.bg, border: `2px solid ${cfg.color}` }}>
                <div style={s.verdict}>
                  <span style={{ fontSize: 48 }}>{cfg.icon}</span>
                  <div>
                    <div style={{ ...s.verdictLabel, color: cfg.color }}>{cfg.label}</div>
                    <div style={s.verdictSub}>Transaction #{result.id}</div>
                  </div>
                </div>

                <div style={s.scoreRow}>
                  <Score label="Risk Score" value={`${result.risk_score?.toFixed(1)}/100`} color={cfg.color} big />
                  <Score label="Confidence" value={`${result.confidence?.toFixed(1)}%`} color="#6366f1" />
                </div>

                <div style={s.scoresGrid}>
                  <ScoreBar label="CNN+LSTM" value={result.cnn_score} max={100} color="#6366f1" />
                  <ScoreBar label="Behavioral" value={result.behavioral_score} max={100} color="#8b5cf6" />
                </div>

                <div style={s.section}><strong>Explanation Flags:</strong></div>
                <div style={s.flags}>
                  {Object.entries(result.explanation || {}).map(([k, v]) => (
                    <div key={k} style={{ ...s.flag, background: v ? '#fee2e2' : '#f0fdf4',
                      color: v ? '#991b1b' : '#166534' }}>
                      {v ? '🔴' : '🟢'} {k.replace(/_/g, ' ')}
                    </div>
                  ))}
                </div>

                <div style={s.txDetails}>
                  <Detail k="Amount" v={`$${result.amount?.toLocaleString()}`} />
                  <Detail k="Type" v={result.type} />
                  <Detail k="Balance Diff (Orig)" v={`$${result.balance_diff_orig?.toFixed(2)}`} />
                  <Detail k="Balance Diff (Dest)" v={`$${result.balance_diff_dest?.toFixed(2)}`} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick-fill examples */}
        <div style={s.examples}>
          <h3 style={s.exTitle}>Quick Test Scenarios</h3>
          <div style={s.exGrid}>
            {[
              { label: '✅ Normal Payment', data: { type:'PAYMENT', amount:1500,
                  old_balance_orig:50000, new_balance_orig:48500, name_dest:'M9988776', old_balance_dest:0, new_balance_dest:0 } },
              { label: '⚠️ Suspicious Transfer', data: { type:'TRANSFER', amount:450000,
                  old_balance_orig:450000, new_balance_orig:0, name_dest:'C7766554', old_balance_dest:0, new_balance_dest:0 } },
              { label: '🚫 High-Risk Cash Out', data: { type:'CASH_OUT', amount:850000,
                  old_balance_orig:850000, new_balance_orig:0, name_dest:'C1234567', old_balance_dest:1000, new_balance_dest:851000 } },
            ].map(ex => (
              <button key={ex.label} style={s.exBtn}
                onClick={() => setForm(f => ({ ...f, ...ex.data, step: 1, name_orig: 'C100000001' }))}>
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange, step, required }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>{label}</label>
      <input style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e0e0e0',
        borderRadius: 7, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
        type={type} step={step} value={value} required={required}
        onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Score({ label, value, color, big }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: big ? 32 : 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#666' }}>{label}</div>
    </div>
  );
}

function ScoreBar({ label, value, max, color }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span>{label}</span><span style={{ color, fontWeight: 600 }}>{value?.toFixed(1)}</span>
      </div>
      <div style={{ height: 8, background: '#e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

function Detail({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0',
      borderBottom: '1px solid #e5e7eb', fontSize: 13 }}>
      <span style={{ color: '#666' }}>{k}</span>
      <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{v}</span>
    </div>
  );
}

const s = {
  page:      { minHeight: '100vh', background: '#f8faff', fontFamily: 'Inter,sans-serif' },
  nav:       { background: '#1a1a2e', padding: '0 24px', height: 56, display: 'flex',
               alignItems: 'center', gap: 20 },
  back:      { background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: 14 },
  navTitle:  { color: '#fff', fontWeight: 600, fontSize: 16 },
  container: { maxWidth: 1100, margin: '0 auto', padding: '28px 20px' },
  grid:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 },
  formCard:  { background: '#fff', borderRadius: 14, padding: 28, boxShadow: '0 2px 16px rgba(0,0,0,0.07)' },
  title:     { margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1a1a2e' },
  sub:       { margin: '0 0 24px', color: '#888', fontSize: 13 },
  errBox:    { background: '#fef2f2', color: '#991b1b', padding: '10px 14px',
               borderRadius: 8, marginBottom: 16, fontSize: 13 },
  row2:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  label:     { fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 },
  input:     { width: '100%', padding: '10px 12px', border: '1.5px solid #e0e0e0',
               borderRadius: 7, fontSize: 13, boxSizing: 'border-box', outline: 'none' },
  btn:       { width: '100%', padding: 14, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
               color: '#fff', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 600,
               cursor: 'pointer', marginTop: 8 },
  emptyCard: { background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center',
               boxShadow: '0 2px 16px rgba(0,0,0,0.07)', minHeight: 300,
               display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  resultCard:{ borderRadius: 14, padding: 24, boxShadow: '0 2px 16px rgba(0,0,0,0.07)' },
  verdict:   { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 },
  verdictLabel:{ fontSize: 22, fontWeight: 700 },
  verdictSub:{ fontSize: 13, color: '#666' },
  scoreRow:  { display: 'flex', justifyContent: 'space-around', marginBottom: 20,
               padding: '16px', background: 'rgba(255,255,255,0.6)', borderRadius: 10 },
  scoresGrid:{ marginBottom: 16 },
  section:   { fontSize: 13, marginBottom: 8, color: '#444' },
  flags:     { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  flag:      { padding: '4px 10px', borderRadius: 20, fontSize: 12 },
  txDetails: { borderTop: '1px solid #e5e7eb', paddingTop: 12 },
  examples:  { background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 16px rgba(0,0,0,0.07)' },
  exTitle:   { margin: '0 0 16px', fontSize: 16, fontWeight: 600 },
  exGrid:    { display: 'flex', gap: 12 },
  exBtn:     { flex: 1, padding: '12px', border: '1.5px solid #e0e0e0', borderRadius: 9,
               background: '#fafafa', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
};
