import { useState, useEffect } from 'react';
import { getTransactions } from '../services/api';
import { useNavigate } from 'react-router-dom';

const STATUS_STYLE = {
  APPROVED: { bg: '#ecfdf5', color: '#065f46' },
  FLAGGED:  { bg: '#fffbeb', color: '#92400e' },
  BLOCKED:  { bg: '#fef2f2', color: '#991b1b' },
};

export default function Transactions() {
  const [txs, setTxs] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const nav = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTransactions({ skip: page * 50, limit: 50, status: filter || undefined });
      setTxs(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter, page]);

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <button style={s.back} onClick={() => nav('/dashboard')}>← Dashboard</button>
        <span style={s.title}>All Transactions</span>
        <button style={s.newBtn} onClick={() => nav('/submit')}>+ New</button>
      </nav>

      <div style={s.container}>
        <div style={s.toolbar}>
          <div style={s.filters}>
            {['', 'APPROVED', 'FLAGGED', 'BLOCKED'].map(f => (
              <button key={f} style={{ ...s.fBtn, ...(filter === f ? s.fBtnActive : {}) }}
                onClick={() => { setFilter(f); setPage(0); }}>
                {f || 'All'}
              </button>
            ))}
          </div>
          <button style={s.refreshBtn} onClick={load}>↻ Refresh</button>
        </div>

        {loading ? <div style={s.loading}>Loading…</div> : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  {['ID', 'Type', 'Amount', 'Origin', 'Destination',
                    'Risk Score', 'CNN', 'Behavioral', 'Status', 'Time'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txs.map((tx, i) => {
                  const st = STATUS_STYLE[tx.status] || STATUS_STYLE.APPROVED;
                  const riskColor = tx.risk_score >= 75 ? '#ef4444' : tx.risk_score >= 50 ? '#f59e0b' : '#10b981';
                  return (
                    <tr key={tx.id} style={{ ...s.tr, background: i % 2 ? '#f9fafb' : '#fff' }}>
                      <td style={s.td}><strong>#{tx.id}</strong></td>
                      <td style={s.td}><span style={s.typeBadge}>{tx.type}</span></td>
                      <td style={s.td}>${tx.amount?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td style={{ ...s.td, ...s.mono }}>{tx.name_orig}</td>
                      <td style={{ ...s.td, ...s.mono }}>{tx.name_dest}</td>
                      <td style={{ ...s.td, color: riskColor, fontWeight: 700 }}>
                        {tx.risk_score?.toFixed(1)}
                      </td>
                      <td style={s.td}>{tx.cnn_score?.toFixed(1)}</td>
                      <td style={s.td}>{tx.behavioral_score?.toFixed(1)}</td>
                      <td style={s.td}>
                        <span style={{ ...s.badge, background: st.bg, color: st.color }}>
                          {tx.status}
                        </span>
                      </td>
                      <td style={{ ...s.td, ...s.timeCell }}>
                        {tx.created_at ? new Date(tx.created_at).toLocaleTimeString() : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {txs.length === 0 && <div style={s.empty}>No transactions found</div>}
          </div>
        )}

        <div style={s.pager}>
          <button style={s.pBtn} onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}>← Prev</button>
          <span style={{ color: '#666', fontSize: 13 }}>Page {page + 1}</span>
          <button style={s.pBtn} onClick={() => setPage(p => p+1)} disabled={txs.length < 50}>Next →</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  page:      { minHeight:'100vh', background:'#f8faff', fontFamily:'Inter,sans-serif' },
  nav:       { background:'#1a1a2e', padding:'0 24px', height:56, display:'flex',
               alignItems:'center', justifyContent:'space-between' },
  back:      { background:'transparent', color:'#aaa', border:'none', cursor:'pointer', fontSize:14 },
  title:     { color:'#fff', fontWeight:600, fontSize:16 },
  newBtn:    { background:'#6366f1', color:'#fff', border:'none', padding:'7px 16px',
               borderRadius:6, cursor:'pointer', fontSize:13 },
  container: { maxWidth:1400, margin:'0 auto', padding:'24px 20px' },
  toolbar:   { display:'flex', justifyContent:'space-between', marginBottom:16 },
  filters:   { display:'flex', gap:8 },
  fBtn:      { padding:'7px 16px', border:'1.5px solid #e0e0e0', borderRadius:6,
               background:'#fff', cursor:'pointer', fontSize:13 },
  fBtnActive:{ background:'#6366f1', color:'#fff', border:'1.5px solid #6366f1' },
  refreshBtn:{ background:'transparent', border:'1.5px solid #e0e0e0', padding:'7px 14px',
               borderRadius:6, cursor:'pointer', fontSize:13 },
  tableWrap: { background:'#fff', borderRadius:12, overflow:'auto',
               boxShadow:'0 2px 12px rgba(0,0,0,0.06)' },
  table:     { width:'100%', borderCollapse:'collapse' },
  thead:     { background:'#f1f5ff' },
  th:        { padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:600,
               color:'#555', borderBottom:'1px solid #e5e7eb' },
  tr:        { transition:'background 0.15s' },
  td:        { padding:'11px 16px', fontSize:13, borderBottom:'1px solid #f0f0f0', color:'#333' },
  mono:      { fontFamily:'monospace', fontSize:12 },
  badge:     { padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600 },
  typeBadge: { background:'#e0e7ff', color:'#3730a3', padding:'2px 8px',
               borderRadius:20, fontSize:11, fontWeight:600 },
  timeCell:  { color:'#999', fontSize:12 },
  empty:     { textAlign:'center', padding:40, color:'#999' },
  loading:   { textAlign:'center', padding:40, color:'#666' },
  pager:     { display:'flex', justifyContent:'center', alignItems:'center', gap:16, marginTop:20 },
  pBtn:      { padding:'8px 16px', border:'1.5px solid #e0e0e0', borderRadius:7,
               background:'#fff', cursor:'pointer', fontSize:13 },
};
