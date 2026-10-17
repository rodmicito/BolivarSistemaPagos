import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

interface Status {
  connected: boolean;
  last_telemetry_at: string;
  valve_state: string;
  valve_rest_until: string;
  settings?: { valve_auto_active: boolean; telemetry_alert_min: number };
}

export default function Alertas() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch('/api/automation/status').then((res) => res.json()).then(setStatus).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  const telemetryAge = status?.last_telemetry_at ? (Date.now() - new Date(status.last_telemetry_at).getTime()) / 60000 : Infinity;
  const alerts = status ? [
    !status.connected ? 'El servidor MQTT está desconectado.' : null,
    telemetryAge >= (status.settings?.telemetry_alert_min || 30) ? 'No se reciben lecturas de telemetría recientes.' : null,
    status.settings?.valve_auto_active && status.valve_rest_until ? 'La válvula principal está en periodo de descanso.' : null,
  ].filter(Boolean) as string[] : [];

  return <div className="max-w-5xl mx-auto space-y-6">
    <div className="flex items-center justify-between">
      <div><h2 className="text-2xl font-bold text-slate-100">Alertas</h2><p className="text-sm text-slate-400 mt-1">Estado y avisos operativos de la automatización.</p></div>
      <button onClick={load} className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
    </div>
    {alerts.length === 0 ? <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-6 flex items-center gap-3 text-emerald-300"><CheckCircle2 /> No hay alertas activas.</div> : <div className="space-y-3">{alerts.map((alert) => <div key={alert} className="rounded-xl border border-amber-900/60 bg-amber-950/30 p-4 flex items-center gap-3 text-amber-300"><AlertTriangle size={20} /> {alert}</div>)}</div>}
  </div>;
}
