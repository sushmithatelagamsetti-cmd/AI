import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebSocket() {
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const ws = useRef(null);

  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket('ws://localhost:8000/transactions/ws/alerts');
      ws.current.onopen = () => setConnected(true);
      ws.current.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000); // auto-reconnect
      };
      ws.current.onerror = () => ws.current.close();
      ws.current.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'ALERT') {
          setAlerts(prev => [{ ...data, timestamp: new Date().toISOString() }, ...prev].slice(0, 50));
        }
      };
    } catch (err) { console.error('WS error', err); }
  }, []);

  useEffect(() => {
    connect();
    const ping = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) ws.current.send('ping');
    }, 20000);
    return () => { clearInterval(ping); ws.current?.close(); };
  }, [connect]);

  const clearAlerts = () => setAlerts([]);
  return { alerts, connected, clearAlerts };
}
