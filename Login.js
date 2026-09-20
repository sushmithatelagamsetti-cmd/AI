import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(form.username, form.password);
      nav('/dashboard');
    } catch {
      setError('Invalid credentials');
    } finally { setLoading(false); }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.icon}>🛡️</div>
          <h1 style={styles.title}>FraudGuard AI</h1>
          <p style={styles.sub}>Real-Time Fraud Detection System</p>
        </div>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handle} style={styles.form}>
          <label style={styles.label}>Username</label>
          <input style={styles.input} value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
            placeholder="Enter username" required />
          <label style={styles.label}>Password</label>
          <input style={styles.input} type="password" value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder="Enter password" required />
          <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
            type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p style={styles.hint}>Demo: admin / admin123</p>
      </div>
    </div>
  );
}

const styles = {
  page:  { minHeight:'100vh', background:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',
           display:'flex', alignItems:'center', justifyContent:'center' },
  card:  { background:'#fff', borderRadius:16, padding:'40px 36px', width:380,
           boxShadow:'0 20px 60px rgba(0,0,0,0.4)' },
  header:{ textAlign:'center', marginBottom:28 },
  icon:  { fontSize:48, marginBottom:8 },
  title: { margin:0, fontSize:26, fontWeight:700, color:'#1a1a2e' },
  sub:   { margin:'6px 0 0', color:'#666', fontSize:13 },
  error: { background:'#fee', color:'#c00', padding:'10px 14px', borderRadius:8,
           marginBottom:16, fontSize:13 },
  form:  { display:'flex', flexDirection:'column', gap:12 },
  label: { fontSize:13, fontWeight:600, color:'#333' },
  input: { padding:'11px 14px', border:'1.5px solid #e0e0e0', borderRadius:8,
           fontSize:14, outline:'none', transition:'border 0.2s' },
  btn:   { marginTop:8, padding:'13px', background:'linear-gradient(135deg,#667eea,#764ba2)',
           color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:600,
           cursor:'pointer', transition:'opacity 0.2s' },
  hint:  { textAlign:'center', marginTop:16, fontSize:12, color:'#999' },
};
