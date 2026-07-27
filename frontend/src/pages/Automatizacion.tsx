import { useEffect, useState, useRef } from 'react';
import { Cpu, Power, Droplet, RefreshCw, Radio, HardDrive, Info, Settings, ChevronDown, ChevronUp, Clock, Database } from 'lucide-react';

interface ESP32Data {
  lm: string;
  lm2: string;
  caudal_entrada: string;
  caudal_salida: string;
  balance: string;
  distancia: string;
  nivel: string;
  porcentaje: string;
}

interface AutomationSetting {
  id?: number;
  broker: string;
  relay_cmd_topic: string;
  relay_state_topic: string;
  telemetry_topic: string;
  key_porcentaje: string;
  key_nivel: string;
  key_distancia: string;
  key_caudal_entrada: string;
  key_caudal_salida: string;
  key_balance: string;
  key_lm: string;
  key_lm2: string;
  scheduler_active: boolean;
  time_on: number;
  time_off: number;
  db_log_active: boolean;
  db_log_interval: number;
  auto_off_duration: number;
  db_log_retention_days: number;
}

interface AutomationStatus {
  connected: boolean;
  relay_state: string;
  relay_state_time: string;
  last_data: ESP32Data | null;
  last_updated: string;
  settings: AutomationSetting | null;
  raw_json: string;
  raw_cmd: string;
  raw_state: string;
  auto_off_active: boolean;
  auto_off_target: string;
}

export default function Automatizacion() {
  const [broker, setBroker] = useState('77.42.17.7:11884');
  const [status, setStatus] = useState<AutomationStatus>({
    connected: false,
    relay_state: 'Desconocido',
    relay_state_time: '',
    last_data: null,
    last_updated: '',
    settings: null,
    raw_json: '',
    raw_cmd: '',
    raw_state: '',
    auto_off_active: false,
    auto_off_target: '',
  });
  
  // Local edit state for settings
  const [settings, setSettings] = useState<AutomationSetting>({
    broker: '77.42.17.7:11884',
    relay_cmd_topic: 'rele/cmd',
    relay_state_topic: 'rele/state',
    telemetry_topic: 'rele',
    key_porcentaje: 'porcentaje',
    key_nivel: 'nivel',
    key_distancia: 'distancia',
    key_caudal_entrada: 'caudal_entrada',
    key_caudal_salida: 'caudal_salida',
    key_balance: 'balance',
    key_lm: 'lm',
    key_lm2: 'lm2',
    scheduler_active: false,
    time_on: 15,
    time_off: 45,
    db_log_active: false,
    db_log_interval: 5,
    auto_off_duration: 10,
    db_log_retention_days: 7,
  });

  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [autoOffTimeLeft, setAutoOffTimeLeft] = useState<string>('');
  const [dbLogs, setDbLogs] = useState<any[]>([]);
  const [showDbLogs, setShowDbLogs] = useState(false);
  const pollInterval = useRef<any>(null);
  const settingsSectionRef = useRef<HTMLDivElement | null>(null);

  // Time Series Chart state
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartVar, setChartVar] = useState<string>('porcentaje');
  const [chartLimit, setChartLimit] = useState<number>(50);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  const fetchChartData = () => {
    fetch(`/api/automation/logs?limit=${chartLimit}`)
      .then((res) => {
        if (!res.ok) throw new Error('Error al obtener datos de gráfica');
        return res.json();
      })
      .then((data) => {
        // Reverse to get chronological order (oldest to newest)
        setChartData([...data].reverse());
      })
      .catch((err) => {
        console.error('Error fetching chart data:', err);
      });
  };

  useEffect(() => {
    fetchChartData();
    // Poll every 10 seconds if db logs are active to keep the chart live
    const interval = setInterval(fetchChartData, 10000);
    return () => clearInterval(interval);
  }, [chartLimit, status.settings?.db_log_active]);

  const fetchStatus = () => {
    fetch('/api/automation/status')
      .then((res) => {
        if (!res.ok) throw new Error('Error al obtener estado');
        return res.json();
      })
      .then((data: AutomationStatus) => {
        setStatus(data);
        if (data.settings) {
          setBroker(data.settings.broker);
          if (!settingsLoaded) {
            setSettings(data.settings);
            setSettingsLoaded(true);
          }
        }
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError('No se pudo conectar con el servidor backend');
      });
  };

  const fetchDbLogs = () => {
    fetch('/api/automation/logs')
      .then((res) => {
        if (!res.ok) throw new Error('Error al obtener bitácora');
        return res.json();
      })
      .then((data) => {
        setDbLogs(data);
      })
      .catch((err) => {
        console.error('Error fetching DB logs:', err);
      });
  };

  useEffect(() => {
    fetchStatus();
    pollInterval.current = setInterval(fetchStatus, 1000);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [settingsLoaded]);

  useEffect(() => {
    if (showDbLogs) {
      fetchDbLogs();
      const interval = setInterval(fetchDbLogs, 10000);
      return () => clearInterval(interval);
    }
  }, [showDbLogs]);

  // Live countdown timer calculation for scheduler and auto-off timer
  useEffect(() => {
    const timer = setInterval(() => {
      // 1. Scheduler countdown
      if (!status.settings?.scheduler_active || !status.relay_state_time || status.relay_state === 'Desconocido') {
        setTimeLeft('');
      } else {
        const stateTime = new Date(status.relay_state_time).getTime();
        const now = new Date().getTime();
        const elapsedMs = now - stateTime;

        const limitMin = status.relay_state === 'ON' ? status.settings.time_on : status.settings.time_off;
        const limitMs = limitMin * 60 * 1000;
        const remainingMs = limitMs - elapsedMs;

        if (remainingMs <= 0) {
          setTimeLeft('00:00 (Alternando...)');
        } else {
          const minutes = Math.floor(remainingMs / 1000 / 60);
          const seconds = Math.floor((remainingMs / 1000) % 60);
          setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      }

      // 2. Auto-OFF timer countdown
      if (!status.auto_off_active || !status.auto_off_target) {
        setAutoOffTimeLeft('');
      } else {
        const targetTime = new Date(status.auto_off_target).getTime();
        const now = new Date().getTime();
        const remainingMs = targetTime - now;

        if (remainingMs <= 0) {
          setAutoOffTimeLeft('00:00 (Apagando...)');
        } else {
          const minutes = Math.floor(remainingMs / 1000 / 60);
          const seconds = Math.floor((remainingMs / 1000) % 60);
          setAutoOffTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [status.relay_state_time, status.relay_state, status.settings, status.auto_off_active, status.auto_off_target]);

  const handleConnectToggle = () => {
    setLoading(true);
    fetch('/api/automation/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        broker,
        connect: !status.connected,
      }),
    })
      .then((res) => res.json())
      .then((data: AutomationStatus) => {
        setStatus(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Error al cambiar conexión');
        setLoading(false);
      });
  };

  const handleCommand = (cmd: string) => {
    fetch('/api/automation/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error al enviar comando');
        setTimeout(fetchStatus, 300);
      })
      .catch((err) => {
        console.error(err);
        setError(`No se pudo enviar el comando "${cmd}"`);
      });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    fetch('/api/automation/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error al guardar configuración');
        return res.json();
      })
      .then((data: AutomationStatus) => {
        setStatus(data);
        if (data.settings) {
          setSettings(data.settings);
        }
        setLoading(false);
        setSuccessMsg('Configuración guardada y aplicada con éxito');
        setTimeout(() => setSuccessMsg(null), 4000);
      })
      .catch((err) => {
        console.error(err);
        setError('No se pudo guardar la configuración de los tópicos');
        setLoading(false);
      });
  };

  const handleToggleScheduler = (active: boolean) => {
    if (!status.settings) return;
    setLoading(true);
    const updatedSettings = {
      ...status.settings,
      scheduler_active: active,
    };

    fetch('/api/automation/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error al alternar temporizador');
        return res.json();
      })
      .then((data: AutomationStatus) => {
        setStatus(data);
        if (data.settings) {
          setSettings(data.settings);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('No se pudo cambiar el estado del programador');
        setLoading(false);
      });
  };

  const handleSaveTimesOnly = (timeOn: number, timeOff: number) => {
    if (!status.settings) return;
    setLoading(true);
    const updatedSettings = {
      ...status.settings,
      time_on: timeOn,
      time_off: timeOff,
    };

    fetch('/api/automation/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error al guardar intervalos');
        return res.json();
      })
      .then((data: AutomationStatus) => {
        setStatus(data);
        if (data.settings) {
          setSettings(data.settings);
        }
        setLoading(false);
        setSuccessMsg('Intervalos de tiempo guardados');
        setTimeout(() => setSuccessMsg(null), 3000);
      })
      .catch((err) => {
        console.error(err);
        setError('No se pudieron guardar los intervalos');
        setLoading(false);
      });
  };

  const handleToggleDbLogging = (active: boolean) => {
    if (!status.settings) return;
    setLoading(true);
    const updatedSettings = {
      ...status.settings,
      db_log_active: active,
    };

    fetch('/api/automation/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error al alternar guardado en BD');
        return res.json();
      })
      .then((data: AutomationStatus) => {
        setStatus(data);
        if (data.settings) {
          setSettings(data.settings);
        }
        setLoading(false);
        setSuccessMsg(active ? 'Guardado en BD activado' : 'Guardado en BD desactivado');
        setTimeout(() => setSuccessMsg(null), 3000);
      })
      .catch((err) => {
        console.error(err);
        setError('No se pudo cambiar el estado del guardado en BD');
        setLoading(false);
      });
  };

  const handleSaveDbConfig = (interval: number, retentionDays: number) => {
    if (!status.settings) return;
    setLoading(true);
    const updatedSettings = {
      ...status.settings,
      db_log_interval: interval,
      db_log_retention_days: retentionDays,
    };

    fetch('/api/automation/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error al guardar configuración de BD');
        return res.json();
      })
      .then((data: AutomationStatus) => {
        setStatus(data);
        if (data.settings) {
          setSettings(data.settings);
        }
        setLoading(false);
        setSuccessMsg('Configuración de base de datos guardada con éxito');
        setTimeout(() => setSuccessMsg(null), 3000);
      })
      .catch((err) => {
        console.error(err);
        setError('No se pudo guardar la configuración de base de datos');
        setLoading(false);
      });
  };

  const handleStartAutoOffTimer = (minutes: number) => {
    setLoading(true);
    fetch('/api/automation/timer/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error al iniciar temporizador de apagado');
        return res.json();
      })
      .then((data: AutomationStatus) => {
        setStatus(data);
        if (data.settings) {
          setSettings(data.settings);
        }
        setLoading(false);
        setSuccessMsg(`Temporizador iniciado: apagado en ${minutes} minutos`);
        setTimeout(() => setSuccessMsg(null), 3000);
      })
      .catch((err) => {
        console.error(err);
        setError('No se pudo iniciar el temporizador de apagado');
        setLoading(false);
      });
  };

  const handleStopAutoOffTimer = () => {
    setLoading(true);
    fetch('/api/automation/timer/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error al detener temporizador de apagado');
        return res.json();
      })
      .then((data: AutomationStatus) => {
        setStatus(data);
        if (data.settings) {
          setSettings(data.settings);
        }
        setLoading(false);
        setSuccessMsg('Temporizador detenido y relé apagado');
        setTimeout(() => setSuccessMsg(null), 3000);
      })
      .catch((err) => {
        console.error(err);
        setError('No se pudo detener el temporizador de apagado');
        setLoading(false);
      });
  };

  const scrollToSettings = () => {
    setShowSettings(true);
    setTimeout(() => {
      settingsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Safe parsing values
  const rawPorcentaje = status.last_data?.porcentaje ? parseFloat(status.last_data.porcentaje) : 0;
  const porcentaje = isNaN(rawPorcentaje) ? 0 : Math.min(Math.max(rawPorcentaje, 0), 100);
  const nivel = status.last_data?.nivel || '0.00';
  const distancia = status.last_data?.distancia || '0.00';
  const caudalEntrada = status.last_data?.caudal_entrada || '0.000';
  const caudalSalida = status.last_data?.caudal_salida || '0.000';
  const balance = status.last_data?.balance || '0.000';
  const lm = status.last_data?.lm || '0';
  const lm2 = status.last_data?.lm2 || '0';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 transition-colors">
            Automatización y Control IoT
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitoreo en tiempo real de caudalímetros, nivel del tanque y actuadores a través de Thingsees Server.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={scrollToSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <Settings size={14} />
            Editar Tópicos
          </button>
          {status.connected ? (
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
              <Radio size={14} className="animate-pulse" />
              Conectado
            </span>
          ) : (
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              <Radio size={14} />
              Desconectado
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 p-4 rounded-xl text-sm font-medium flex items-center gap-3">
          <Info size={18} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl text-sm font-medium flex items-center gap-3">
          <Info size={18} className="flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Connection, Relay Control & Scheduler */}
        <div className="space-y-6 lg:col-span-1">
          {/* Connection Settings Card */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
              <Radio size={20} className="text-indigo-500" />
              Servidor Thingsees
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Dirección del Broker MQTT
                </label>
                <input
                  type="text"
                  value={broker}
                  onChange={(e) => setBroker(e.target.value)}
                  disabled={status.connected}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <button
                onClick={handleConnectToggle}
                disabled={loading}
                className={`w-full py-3 rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center justify-center gap-2 ${
                  status.connected
                    ? 'bg-rose-500 hover:bg-rose-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {loading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : status.connected ? (
                  'Desconectar Servidor'
                ) : (
                  'Conectar Servidor'
                )}
              </button>
            </div>
          </div>

          {/* Actuator Relay Card */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200 relative overflow-hidden flex flex-col justify-between h-[360px]">
            <div>
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Cpu size={20} className="text-indigo-500" />
                  Controlador de Relé
                </h3>
                <button 
                  onClick={scrollToSettings}
                  className="text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline text-[10px] font-bold"
                  title="Configurar tópicos de relé"
                >
                  Configurar
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Control manual de relé (GPIO 26) en el módulo ESP32.
              </p>
            </div>

            <div className="flex flex-col items-center space-y-4 my-2">
              {/* Giant Relay Status Display */}
              <div className="flex flex-col items-center space-y-1">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                  status.relay_state === 'ON'
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-4 border-emerald-500'
                    : status.relay_state === 'OFF'
                    ? 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-4 border-slate-300 dark:border-slate-700'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-500 dark:text-amber-400 border-4 border-amber-400'
                }`}>
                  <Power size={28} className={status.relay_state === 'ON' ? 'animate-pulse' : ''} />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-350">
                  Estado: {status.relay_state === 'ON' ? 'ENCENDIDO' : status.relay_state === 'OFF' ? 'APAGADO' : 'DESCONOCIDO'}
                </span>
              </div>

              {/* Direct Actions */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => handleCommand('on')}
                  disabled={status.settings?.scheduler_active}
                  className="py-2 px-4 rounded-xl font-medium text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title={status.settings?.scheduler_active ? 'Desactiva el temporizador para control manual' : ''}
                >
                  Encender
                </button>
                <button
                  onClick={() => handleCommand('off')}
                  disabled={status.settings?.scheduler_active}
                  className="py-2 px-4 rounded-xl font-medium text-xs bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title={status.settings?.scheduler_active ? 'Desactiva el temporizador para control manual' : ''}
                >
                  Apagar
                </button>
              </div>
            </div>

            {/* Topics Info Footer */}
            <div className="border-t border-slate-100 dark:border-slate-700/80 pt-2 flex flex-col gap-1 text-[9px] text-slate-400 dark:text-slate-500">
              <div className="flex justify-between">
                <span>Tópico Cmd:</span>
                <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1 rounded truncate max-w-[150px]">
                  {status.settings?.relay_cmd_topic || 'rele/cmd'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tópico State:</span>
                <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1 rounded truncate max-w-[150px]">
                  {status.settings?.relay_state_topic || 'rele/state'}
                </span>
              </div>
            </div>
          </div>

          {/* New Timed Automation Scheduler Card */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Clock size={20} className="text-indigo-500" />
                Temporizador Cíclico
              </h3>
              {status.settings?.scheduler_active ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  ACTIVO
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                  INACTIVO
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Alterna automáticamente el relé encendido/apagado en intervalos de minutos.
            </p>

            <div className="space-y-4">
              {/* Activation Toggle switch */}
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700/50">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Activar Programador</span>
                <button
                  onClick={() => handleToggleScheduler(!status.settings?.scheduler_active)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center ${
                    status.settings?.scheduler_active ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute transition-transform shadow ${
                    status.settings?.scheduler_active ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Interval times form */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Tiempo Encendido (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.time_on}
                    onChange={(e) => setSettings({ ...settings, time_on: parseInt(e.target.value) || 1 })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Tiempo Apagado (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.time_off}
                    onChange={(e) => setSettings({ ...settings, time_off: parseInt(e.target.value) || 1 })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={() => handleSaveTimesOnly(settings.time_on, settings.time_off)}
                className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-lg transition-colors"
              >
                Guardar Intervalos
              </button>

              {/* Countdown ticker display and status indicator */}
              {status.settings?.scheduler_active && (
                <div className="mt-2 p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/35 rounded-xl text-center">
                  <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-indigo-100/40 dark:border-indigo-900/40">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Fase del Ciclo:
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                      status.relay_state?.toUpperCase() === 'ON'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}>
                      {status.relay_state?.toUpperCase() === 'ON' ? 'ENCENDIDO' : 'APAGADO'}
                    </span>
                  </div>
                  {timeLeft && (
                    <>
                      <span className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Cambio de estado en
                      </span>
                      <span className="text-xl font-black text-indigo-650 dark:text-indigo-400 font-mono block mt-1">
                        {timeLeft}
                      </span>
                      <span className="block text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Siguiente: {status.relay_state?.toUpperCase() === 'ON' ? 'APAGADO' : 'ENCENDIDO'}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card 3: One-shot Auto-Off Timer */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Clock size={18} className="text-amber-500" />
                Auto-Apagado de Un Solo Uso
              </h3>
              {status.auto_off_active ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                  ACTIVO
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                  INACTIVO
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Enciende el relé inmediatamente y lo apaga automáticamente una vez transcurra el tiempo seleccionado.
            </p>

            <div className="space-y-4">
              {status.auto_off_active ? (
                <div className="p-4 bg-amber-50/40 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/35 rounded-xl text-center">
                  <span className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Apagado automático en
                  </span>
                  <span className="text-2xl font-black text-amber-650 dark:text-amber-400 font-mono block mt-1">
                    {autoOffTimeLeft || '00:00'}
                  </span>
                  <button
                    onClick={handleStopAutoOffTimer}
                    className="mt-3 w-full py-1.5 bg-red-55 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 font-bold text-xs rounded-lg transition-colors border border-red-100 dark:border-red-900/30"
                  >
                    Detener y Apagar
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Tiempo de Funcionamiento (minutos)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={settings.auto_off_duration}
                      onChange={(e) => setSettings({ ...settings, auto_off_duration: parseInt(e.target.value) || 1 })}
                      className="flex-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                      onClick={() => handleStartAutoOffTimer(settings.auto_off_duration)}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1"
                      disabled={loading || status.relay_state === 'ON'}
                      title={status.relay_state === 'ON' ? 'El relé ya está encendido' : ''}
                    >
                      <Power size={12} />
                      Encender
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Database Logging Settings */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Database size={18} className="text-indigo-500" />
                Registro en Base de Datos
              </h3>
              
              <div className="flex items-center gap-2">
                {status.settings?.db_log_active ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                    ACTIVO
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                    INACTIVO
                  </span>
                )}
                
                {/* Active/Inactive Switch Toggle */}
                <button
                  onClick={() => handleToggleDbLogging(!status.settings?.db_log_active)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center ${
                    status.settings?.db_log_active ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute transition-transform shadow ${
                    status.settings?.db_log_active ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Guarda automáticamente los parámetros de los tópicos, estado del relé y comandos enviados en la base de datos local SQLite.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Intervalo de Guardado (minutos)
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.db_log_interval}
                  onChange={(e) => setSettings({ ...settings, db_log_interval: parseInt(e.target.value) || 1 })}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  disabled={!status.settings?.db_log_active}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    Retención de Datos (días)
                  </label>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    {settings.db_log_retention_days || 7} {settings.db_log_retention_days === 1 ? 'día' : 'días'}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={settings.db_log_retention_days || 7}
                  onChange={(e) => setSettings({ ...settings, db_log_retention_days: parseInt(e.target.value) || 7 })}
                  className="w-full h-1.5 bg-slate-250 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50"
                  disabled={!status.settings?.db_log_active}
                />
                <div className="flex justify-between text-[8px] text-slate-400 dark:text-slate-500 mt-1 select-none">
                  <span>1 día</span>
                  <span>15 días</span>
                  <span>30 días</span>
                </div>
              </div>

              <button
                onClick={() => handleSaveDbConfig(settings.db_log_interval, settings.db_log_retention_days || 7)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                disabled={!status.settings?.db_log_active || loading}
              >
                Guardar Configuración
              </button>
            </div>

            {/* Collapsible Recent Logs Visualizer */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
              <button
                onClick={() => setShowDbLogs(!showDbLogs)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Database size={13} className="text-slate-400" />
                  Ver Historial Reciente ({dbLogs.length})
                </span>
                {showDbLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showDbLogs && (
                <div className="mt-3 overflow-x-auto max-h-56 scrollbar-thin rounded-lg border border-slate-100 dark:border-slate-800">
                  {dbLogs.length === 0 ? (
                    <span className="text-[10px] text-slate-500 italic block py-4 text-center">
                      No hay registros guardados aún en la base de datos.
                    </span>
                  ) : (
                    <table className="w-full text-[10px] text-left text-slate-500 dark:text-slate-400">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 text-[9px] uppercase font-bold sticky top-0 border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="px-2.5 py-1.5">Hora</th>
                          <th className="px-2.5 py-1.5 text-center">Vol %</th>
                          <th className="px-2.5 py-1.5 text-center">Nivel</th>
                          <th className="px-2.5 py-1.5 text-center">Relé</th>
                          <th className="px-2.5 py-1.5 text-center">Cmd</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/30">
                        {dbLogs.map((log: any) => {
                          const timeStr = log.timestamp 
                            ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
                            : 'N/A';
                          return (
                            <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                              <td className="px-2.5 py-1.5 font-mono whitespace-nowrap">{timeStr}</td>
                              <td className="px-2.5 py-1.5 text-center font-bold text-slate-750 dark:text-slate-200">{log.porcentaje}%</td>
                              <td className="px-2.5 py-1.5 text-center">{log.nivel} cm</td>
                              <td className="px-2.5 py-1.5 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                                  log.relay_state === 'ON' 
                                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                                    : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400'
                                }`}>
                                  {log.relay_state || 'OFF'}
                                </span>
                              </td>
                              <td className="px-2.5 py-1.5 text-center font-mono text-[9px] text-slate-400 dark:text-slate-500">{log.relay_cmd || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Water Level Visual Tank */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200 flex flex-col h-[492px] justify-between">
            <div>
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Droplet size={20} className="text-blue-500" />
                  Nivel de Agua
                </h3>
                <button 
                  onClick={scrollToSettings}
                  className="text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline text-[10px] font-bold"
                  title="Configurar telemetría y claves JSON"
                >
                  Configurar
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Visualización gráfica del volumen del tanque de reserva.
              </p>
            </div>

            {/* Visual Tank Component */}
            <div className="flex flex-col items-center justify-center my-4 flex-1">
              <div className="relative w-40 h-56 border-4 border-slate-300 dark:border-slate-600 rounded-2xl overflow-hidden shadow-inner bg-slate-100 dark:bg-slate-900/40">
                {/* Water Liquid Fill */}
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-blue-500/80 dark:bg-blue-600/70 transition-all duration-1000 ease-out flex items-center justify-center"
                  style={{ height: `${porcentaje}%` }}
                >
                  {/* Wave Animation Overlay */}
                  <div className="absolute top-0 left-0 right-0 h-3 bg-blue-400/90 dark:bg-blue-500/80 animate-wave-shift opacity-70" />
                  
                  {/* Big Percentage Inside Water */}
                  {porcentaje > 15 && (
                    <span className="text-2xl font-black text-white drop-shadow-md z-10 select-none">
                      {porcentaje}%
                    </span>
                  )}
                </div>

                {/* Percentage Display outside if too low */}
                {porcentaje <= 15 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-black text-slate-400 dark:text-slate-500 z-10 select-none">
                      {porcentaje}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Config metadata footer */}
            <div className="border-t border-slate-100 dark:border-slate-700/80 pt-3 space-y-2">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">
                    Nivel ({status.settings?.key_nivel || 'nivel'})
                  </span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {nivel} cm
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">
                    Distancia ({status.settings?.key_distancia || 'distancia'})
                  </span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {distancia} cm
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 border-t border-slate-50 dark:border-slate-800 pt-1.5">
                <span>Tópico de Telemetría:</span>
                <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1 rounded truncate max-w-[160px]">
                  {status.settings?.telemetry_topic || 'rele'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Flow Rates & Raw counters */}
        <div className="space-y-6 lg:col-span-1">
          {/* Flow Rates Card */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200 h-[264px] flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Droplet size={18} className="text-cyan-500" />
                Caudales ({status.settings?.key_caudal_entrada || 'entrada'} / {status.settings?.key_caudal_salida || 'salida'})
              </h3>
            </div>

            <div className="space-y-2 flex-1 flex flex-col justify-center">
              <div className="flex justify-between items-center text-sm py-1.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Caudal Entrada:</span>
                <span className="font-bold text-slate-800 dark:text-slate-250">{caudalEntrada} L/min</span>
              </div>
              <div className="flex justify-between items-center text-sm py-1.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Caudal Salida:</span>
                <span className="font-bold text-slate-800 dark:text-slate-250">{caudalSalida} L/min</span>
              </div>
              <div className={`flex justify-between items-center text-sm py-1.5 px-3 rounded-lg border ${
                parseFloat(balance) >= 0
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/20'
                  : 'bg-rose-50/40 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/20'
              }`}>
                <span className="text-slate-500 dark:text-slate-400 font-medium">Balance Neto:</span>
                <span className={`font-black ${parseFloat(balance) >= 0 ? 'text-emerald-600 dark:text-emerald-450' : 'text-rose-600 dark:text-rose-450'}`}>
                  {balance} L/min
                </span>
              </div>
            </div>

            <div className="text-[9px] text-slate-400 dark:text-slate-500 text-right mt-1">
              Clave Balance: <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1 rounded">{status.settings?.key_balance || 'balance'}</span>
            </div>
          </div>

          {/* Raw Pulses Counter */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200 h-[202px] flex flex-col justify-between">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <HardDrive size={18} className="text-slate-500" />
              Contadores de Pulsos
            </h3>

            <div className="grid grid-cols-2 gap-3 my-2">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-center">
                <span className="block text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                  lm ({status.settings?.key_lm || 'lm'})
                </span>
                <span className="text-lg font-black text-slate-700 dark:text-slate-300 block mt-0.5">
                  {lm}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-center">
                <span className="block text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                  lm2 ({status.settings?.key_lm2 || 'lm2'})
                </span>
                <span className="text-lg font-black text-slate-700 dark:text-slate-300 block mt-0.5">
                  {lm2}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 pt-1.5 border-t border-slate-50 dark:border-slate-800">
              <span>Última actualización:</span>
              <span className="font-semibold">
                {status.last_updated ? new Date(status.last_updated).toLocaleTimeString() : 'Nunca'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Gráfica de Serie de Tiempo de Telemetría */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Database size={18} className="text-indigo-500" />
              Historial de Telemetría (Serie de Tiempo)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Visualiza gráficamente el comportamiento histórico de los sensores.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Variable Selector */}
            <select
              value={chartVar}
              onChange={(e) => setChartVar(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold cursor-pointer"
            >
              <option value="porcentaje">Porcentaje de Agua</option>
              <option value="nivel">Nivel de Agua</option>
              <option value="distancia">Distancia al Sensor</option>
              <option value="caudal_entrada">Caudal Entrada</option>
              <option value="caudal_salida">Caudal Salida</option>
              <option value="balance">Balance de Flujo</option>
              <option value="lm">Pulsos Entrada (lm)</option>
              <option value="lm2">Pulsos Salida (lm2)</option>
            </select>

            {/* Limit Selector */}
            <select
              value={chartLimit}
              onChange={(e) => setChartLimit(parseInt(e.target.value))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold cursor-pointer"
            >
              <option value={20}>Últimos 20</option>
              <option value={50}>Últimos 50</option>
              <option value={100}>Últimos 100</option>
              <option value={200}>Últimos 200</option>
            </select>

            {/* Refresh Button */}
            <button
              onClick={fetchChartData}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg transition-colors"
              title="Actualizar datos"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* SVG Time Series Rendering */}
        <div className="relative w-full h-72 select-none bg-slate-50/50 dark:bg-slate-900/30 rounded-xl p-2 border border-slate-100 dark:border-slate-800/80">
          {chartData.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center flex-col text-slate-400 dark:text-slate-500 gap-2">
              <Database size={24} className="animate-pulse" />
              <span className="text-xs font-semibold">Cargando datos históricos...</span>
              <span className="text-[10px] text-slate-400 italic">
                Asegúrate de tener el "Registro en Base de Datos" activado.
              </span>
            </div>
          ) : (() => {
            const width = 800;
            const height = 280;
            const paddingLeft = 50;
            const paddingRight = 20;
            const paddingTop = 20;
            const paddingBottom = 40;
            const chartW = width - paddingLeft - paddingRight;
            const chartH = height - paddingTop - paddingBottom;

            const varConfigs: Record<string, { label: string; unit: string; color: string; gradient: string[] }> = {
              porcentaje: { label: 'Porcentaje de Agua', unit: '%', color: '#10b981', gradient: ['#10b981', '#059669'] },
              nivel: { label: 'Nivel de Agua', unit: ' cm', color: '#3b82f6', gradient: ['#3b82f6', '#2563eb'] },
              distancia: { label: 'Distancia al Sensor', unit: ' cm', color: '#f97316', gradient: ['#f97316', '#ea580c'] },
              caudal_entrada: { label: 'Caudal de Entrada', unit: ' L/min', color: '#6366f1', gradient: ['#6366f1', '#4f46e5'] },
              caudal_salida: { label: 'Caudal de Salida', unit: ' L/min', color: '#f43f5e', gradient: ['#f43f5e', '#e11d48'] },
              balance: { label: 'Balance de Flujo', unit: ' L/min', color: '#06b6d4', gradient: ['#06b6d4', '#0891b2'] },
              lm: { label: 'Pulsos Entrada (lm)', unit: '', color: '#8b5cf6', gradient: ['#8b5cf6', '#7c3aed'] },
              lm2: { label: 'Pulsos Salida (lm2)', unit: '', color: '#f59e0b', gradient: ['#f59e0b', '#d97706'] },
            };
            const config = varConfigs[chartVar] || varConfigs.porcentaje;

            const values = chartData.map((d) => d[chartVar] || 0);
            const rawMin = Math.min(...values, 0);
            const rawMax = Math.max(...values, 10);
            const r = rawMax - rawMin;
            const yMin = Math.max(0, rawMin - r * 0.1);
            const yMax = rawMax + r * 0.1;

            const yScale = (val: number) => {
              const denom = yMax - yMin;
              if (denom === 0) return paddingTop + chartH / 2;
              return paddingTop + chartH - ((val - yMin) / denom) * chartH;
            };

            const points = chartData.map((d, i) => {
              const x = paddingLeft + (i / (chartData.length - 1)) * chartW;
              const y = yScale(d[chartVar] || 0);
              return { x, y, data: d };
            });

            const pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
            const areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartH} L ${points[0].x} ${paddingTop + chartH} Z`;

            // Grid lines y ticks
            const gridTicks = 4;
            const gridLines = Array.from({ length: gridTicks }).map((_, i) => {
              const val = yMin + (i / (gridTicks - 1)) * (yMax - yMin);
              const y = yScale(val);
              return { y, label: val.toFixed(1) };
            });

            // X-axis timestamps (display 5 ticks max)
            const xTicksCount = Math.min(5, chartData.length);
            const xTicks = Array.from({ length: xTicksCount }).map((_, i) => {
              const dataIndex = Math.round((i / (xTicksCount - 1)) * (chartData.length - 1));
              const d = chartData[dataIndex];
              const x = paddingLeft + (dataIndex / (chartData.length - 1)) * chartW;
              const timeStr = d?.timestamp
                ? new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';
              return { x, label: timeStr };
            });

            const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clientX = e.clientX - rect.left;
              const relativeX = (clientX - paddingLeft) / chartW;
              let idx = Math.round(relativeX * (chartData.length - 1));
              idx = Math.max(0, Math.min(chartData.length - 1, idx));
              setHoveredIndex(idx);
              setHoveredPoint(chartData[idx]);
            };

            const handleMouseLeave = () => {
              setHoveredIndex(null);
              setHoveredPoint(null);
            };

            return (
              <>
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-full"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                >
                  <defs>
                    <linearGradient id={`chart-grad-${chartVar}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={config.color} stopOpacity="0.35" />
                      <stop offset="100%" stopColor={config.color} stopOpacity="0.00" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid lines */}
                  {gridLines.map((line, i) => (
                    <g key={i} className="opacity-40 dark:opacity-20">
                      <line
                        x1={paddingLeft}
                        y1={line.y}
                        x2={width - paddingRight}
                        y2={line.y}
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        strokeWidth="0.8"
                      />
                      <text
                        x={paddingLeft - 10}
                        y={line.y + 3}
                        textAnchor="end"
                        className="text-[9px] font-bold fill-slate-400 dark:fill-slate-500 font-mono"
                      >
                        {line.label}
                      </text>
                    </g>
                  ))}

                  {/* Vertical grid lines */}
                  {xTicks.map((tick, i) => (
                    <g key={i} className="opacity-30 dark:opacity-10">
                      <line
                        x1={tick.x}
                        y1={paddingTop}
                        x2={tick.x}
                        y2={paddingTop + chartH}
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        strokeWidth="0.8"
                      />
                    </g>
                  ))}

                  {/* X Axis Time Labels */}
                  {xTicks.map((tick, i) => (
                    <text
                      key={i}
                      x={tick.x}
                      y={paddingTop + chartH + 18}
                      textAnchor="middle"
                      className="text-[9px] font-bold fill-slate-400 dark:fill-slate-500 font-mono"
                    >
                      {tick.label}
                    </text>
                  ))}

                  {/* Area path */}
                  <path
                    d={areaD}
                    fill={`url(#chart-grad-${chartVar})`}
                  />

                  {/* Line path */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={config.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Hover vertical line & marker */}
                  {hoveredIndex !== null && points[hoveredIndex] && (
                    <g>
                      <line
                        x1={points[hoveredIndex].x}
                        y1={paddingTop}
                        x2={points[hoveredIndex].x}
                        y2={paddingTop + chartH}
                        stroke={config.color}
                        strokeOpacity="0.5"
                        strokeWidth="1.2"
                      />
                      <circle
                        cx={points[hoveredIndex].x}
                        cy={points[hoveredIndex].y}
                        r="6"
                        fill={config.color}
                        className="animate-ping opacity-70"
                      />
                      <circle
                        cx={points[hoveredIndex].x}
                        cy={points[hoveredIndex].y}
                        r="5"
                        fill={config.color}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                    </g>
                  )}
                </svg>

                {/* Hover Tooltip Overlay */}
                {hoveredIndex !== null && hoveredPoint && points[hoveredIndex] && (
                  <div
                    className="absolute bg-slate-900/95 dark:bg-slate-950/95 text-white p-3 rounded-xl border border-slate-800 shadow-2xl backdrop-blur-sm pointer-events-none transition-all duration-75 flex flex-col gap-1 z-[9999]"
                    style={{
                      left: `${(points[hoveredIndex].x / width) * 100}%`,
                      top: `${(points[hoveredIndex].y / height) * 100 - 30}%`,
                      transform: 'translate(-50%, -100%)',
                    }}
                  >
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">
                      {hoveredPoint.timestamp
                        ? new Date(hoveredPoint.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' })
                        : 'Hora desconocida'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                      <span className="text-xs font-black font-mono">
                        {(hoveredPoint[chartVar] || 0).toFixed(2)}{config.unit}
                      </span>
                    </div>
                    {hoveredPoint.relay_state && (
                      <span className="text-[8px] text-slate-400 mt-0.5">
                        Relé: <strong className="text-slate-200">{hoveredPoint.relay_state}</strong>
                      </span>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Raw JSON telemetry payload & Topics Monitoring */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
          <HardDrive size={18} className="text-indigo-500" />
          Monitoreo de Tópicos MQTT y Datos en Tiempo Real
        </h3>

        {/* Topics grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/85">
            <span className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Tópico Telemetría (Datos)
            </span>
            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 block mt-1 truncate" title={status.settings?.telemetry_topic || 'nP1'}>
              {status.settings?.telemetry_topic || 'nP1'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/85">
            <span className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Tópico Comandos (Relé)
            </span>
            <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 block mt-1 truncate" title={status.settings?.relay_cmd_topic || 'nivelPrueba/cmd'}>
              {status.settings?.relay_cmd_topic || 'nivelPrueba/cmd'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/85">
            <span className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Tópico Estado (Relé)
            </span>
            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 block mt-1 truncate" title={status.settings?.relay_state_topic || 'rele/state'}>
              {status.settings?.relay_state_topic || 'rele/state'}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Historial de tramas y mensajes en tiempo real para cada tópico (formato raw/JSON):
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Telemetry Console */}
          <div>
            <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Consola de Telemetría ({status.settings?.telemetry_topic || 'nP1'})
            </span>
            <pre className="bg-slate-950 text-emerald-400 p-3.5 rounded-xl text-[10px] font-mono overflow-x-auto h-40 border border-slate-900 shadow-inner">
              {status.raw_json ? (
                (() => {
                  try {
                    return JSON.stringify(JSON.parse(status.raw_json), null, 2);
                  } catch (e) {
                    return status.raw_json;
                  }
                })()
              ) : (
                <span className="text-slate-500 italic">Esperando datos del tópico...</span>
              )}
            </pre>
          </div>

          {/* Command Console */}
          <div>
            <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Consola de Comandos ({status.settings?.relay_cmd_topic || 'nivelPrueba/cmd'})
            </span>
            <pre className="bg-slate-950 text-amber-400 p-3.5 rounded-xl text-[10px] font-mono overflow-x-auto h-40 border border-slate-900 shadow-inner">
              {status.raw_cmd ? (
                (() => {
                  try {
                    return JSON.stringify(JSON.parse(status.raw_cmd), null, 2);
                  } catch (e) {
                    return status.raw_cmd;
                  }
                })()
              ) : (
                <span className="text-slate-500 italic">Ningún comando enviado aún...</span>
              )}
            </pre>
          </div>

          {/* State Console */}
          <div>
            <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Consola de Estado ({status.settings?.relay_state_topic || 'rele/state'})
            </span>
            <pre className="bg-slate-950 text-emerald-300 p-3.5 rounded-xl text-[10px] font-mono overflow-x-auto h-40 border border-slate-900 shadow-inner">
              {status.raw_state ? (
                (() => {
                  try {
                    return JSON.stringify(JSON.parse(status.raw_state), null, 2);
                  } catch (e) {
                    return status.raw_state;
                  }
                })()
              ) : (
                <span className="text-slate-500 italic">Esperando actualización de estado...</span>
              )}
            </pre>
          </div>
        </div>
      </div>

      {/* Collapsible Config Section */}
      <div ref={settingsSectionRef} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-all duration-200">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full p-6 flex justify-between items-center text-slate-800 dark:text-slate-100 hover:bg-slate-55 dark:hover:bg-slate-700 transition-colors"
        >
          <div className="flex items-center gap-2.5 text-left">
            <Settings size={22} className="text-indigo-500" />
            <div>
              <h3 className="text-lg font-bold">Configuración de Tópicos y Mapeo JSON</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Personaliza los nombres de los tópicos MQTT y las claves de los campos del JSON enviado por el ESP32.
              </p>
            </div>
          </div>
          {showSettings ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </button>

        {showSettings && (
          <form onSubmit={handleSaveSettings} className="p-6 border-t border-slate-150 dark:border-slate-700/80 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tópicos MQTT */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700/50 pb-2">
                  Tópicos MQTT
                </h4>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-350 mb-1.5">
                    Broker IP y Puerto
                  </label>
                  <input
                    type="text"
                    value={settings.broker}
                    onChange={(e) => setSettings({ ...settings, broker: e.target.value })}
                    required
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-355 mb-1.5">
                    Tópico de Telemetría (Subscribirse para datos)
                  </label>
                  <input
                    type="text"
                    value={settings.telemetry_topic}
                    onChange={(e) => setSettings({ ...settings, telemetry_topic: e.target.value })}
                    required
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-355 mb-1.5">
                      Tópico Comandos (Cmd)
                    </label>
                    <input
                      type="text"
                      value={settings.relay_cmd_topic}
                      onChange={(e) => setSettings({ ...settings, relay_cmd_topic: e.target.value })}
                      required
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-355 mb-1.5">
                      Tópico Estado Rele
                    </label>
                    <input
                      type="text"
                      value={settings.relay_state_topic}
                      onChange={(e) => setSettings({ ...settings, relay_state_topic: e.target.value })}
                      required
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Mapeo JSON de Variables */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700/50 pb-2">
                  Claves JSON (Mapeo de Variables)
                </h4>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Porcentaje (%)
                    </label>
                    <input
                      type="text"
                      value={settings.key_porcentaje}
                      onChange={(e) => setSettings({ ...settings, key_porcentaje: e.target.value })}
                      required
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Nivel Tanque (cm)
                    </label>
                    <input
                      type="text"
                      value={settings.key_nivel}
                      onChange={(e) => setSettings({ ...settings, key_nivel: e.target.value })}
                      required
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Distancia (cm)
                    </label>
                    <input
                      type="text"
                      value={settings.key_distancia}
                      onChange={(e) => setSettings({ ...settings, key_distancia: e.target.value })}
                      required
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Caudal Entrada
                    </label>
                    <input
                      type="text"
                      value={settings.key_caudal_entrada}
                      onChange={(e) => setSettings({ ...settings, key_caudal_entrada: e.target.value })}
                      required
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Caudal Salida
                    </label>
                    <input
                      type="text"
                      value={settings.key_caudal_salida}
                      onChange={(e) => setSettings({ ...settings, key_caudal_salida: e.target.value })}
                      required
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Balance Flujo
                    </label>
                    <input
                      type="text"
                      value={settings.key_balance}
                      onChange={(e) => setSettings({ ...settings, key_balance: e.target.value })}
                      required
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Pulsos Entrada (lm)
                    </label>
                    <input
                      type="text"
                      value={settings.key_lm}
                      onChange={(e) => setSettings({ ...settings, key_lm: e.target.value })}
                      required
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Pulsos Salida (lm2)
                    </label>
                    <input
                      type="text"
                      value={settings.key_lm2}
                      onChange={(e) => setSettings({ ...settings, key_lm2: e.target.value })}
                      required
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-700/50">
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-1.5"
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : 'Guardar Configuración'}
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  );
}
