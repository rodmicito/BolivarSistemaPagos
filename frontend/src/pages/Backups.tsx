import { useEffect, useState } from 'react';
import { DatabaseBackup, Download, Play, RefreshCw, Save } from 'lucide-react';

interface BackupSetting {
  enabled: boolean;
  interval_minutes: number;
  retention_count: number;
  backup_dir: string;
  last_run_at?: string | null;
  last_backup_file?: string;
  last_backup_size?: number;
  last_backup_error?: string;
}

interface BackupFile {
  name: string;
  size: number;
  created_at: string;
}

interface BackupStatus {
  settings: BackupSetting;
  files: BackupFile[];
}

const defaultSettings: BackupSetting = {
  enabled: false,
  interval_minutes: 1440,
  retention_count: 7,
  backup_dir: '',
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
};

export default function Backups() {
  const [settings, setSettings] = useState<BackupSetting>(defaultSettings);
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = () => {
    setLoading(true);
    fetch('/api/backups/status')
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo cargar la configuracion de backups');
        return res.json();
      })
      .then((data: BackupStatus) => {
        setSettings(data.settings || defaultSettings);
        setFiles(data.files || []);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : 'No se pudo cargar backups');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    fetch('/api/backups/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo guardar la configuracion');
        return res.json();
      })
      .then((data: BackupSetting) => {
        setSettings(data);
        setMessage('Configuracion de backups guardada');
        loadStatus();
      })
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : 'No se pudo guardar la configuracion');
      })
      .finally(() => setSaving(false));
  };

  const runBackup = () => {
    setRunning(true);
    setMessage(null);
    setError(null);

    fetch('/api/backups/run', { method: 'POST' })
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo crear el backup');
        return res.json();
      })
      .then((file: BackupFile) => {
        setMessage(`Backup creado: ${file.name}`);
        loadStatus();
      })
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : 'No se pudo crear el backup');
      })
      .finally(() => setRunning(false));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 transition-colors">Backups de Base de Datos</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Copias automaticas y manuales del archivo SQLite del sistema.</p>
        </div>
        <button
          onClick={runBackup}
          disabled={running}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          {running ? <RefreshCw size={18} className="animate-spin" /> : <Play size={18} />}
          {running ? 'Creando...' : 'Crear Backup Ahora'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={saveSettings} className="lg:col-span-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
              <DatabaseBackup size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Programacion</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Intervalo y retencion</p>
            </div>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-3">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Backup automatico</span>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              className="h-4 w-4 accent-indigo-600"
            />
          </label>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Cada cuantos minutos</label>
            <input
              type="number"
              min="5"
              value={settings.interval_minutes}
              onChange={(e) => setSettings({ ...settings, interval_minutes: Math.max(Number(e.target.value) || 1440, 5) })}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Cantidad de backups a conservar</label>
            <input
              type="number"
              min="1"
              value={settings.retention_count}
              onChange={(e) => setSettings({ ...settings, retention_count: Math.max(Number(e.target.value) || 7, 1) })}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Carpeta de backups</label>
            <input
              type="text"
              value={settings.backup_dir}
              onChange={(e) => setSettings({ ...settings, backup_dir: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Guardando...' : 'Guardar Configuracion'}
          </button>
        </form>

        <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Backups disponibles</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Ultimo: {settings.last_backup_file || 'Sin backup registrado'}
              </p>
            </div>
            <button
              onClick={loadStatus}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Actualizar lista"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading ? (
              <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Cargando backups...</p>
            ) : files.length === 0 ? (
              <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Todavia no hay backups creados.</p>
            ) : files.map((file) => (
              <div key={file.name} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100 break-all">{file.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {new Date(file.created_at).toLocaleString()} - {formatBytes(file.size)}
                  </p>
                </div>
                <a
                  href={`/api/backups/download/${encodeURIComponent(file.name)}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium transition-colors"
                >
                  <Download size={16} />
                  Descargar
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {settings.last_backup_error && (
        <div className="rounded-xl border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 px-4 py-3 text-sm text-orange-700 dark:text-orange-300">
          Ultimo error: {settings.last_backup_error}
        </div>
      )}
    </div>
  );
}
