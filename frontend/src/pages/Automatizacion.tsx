import { useEffect, useState, useRef } from 'react';
import { Cpu, Power, Droplet, RefreshCw, Radio, HardDrive, Info } from 'lucide-react';

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

interface AutomationStatus {
  connected: boolean;
  relay_state: string;
  last_data: ESP32Data | null;
  last_updated: string;
}

export default function Automatizacion() {
  const [broker, setBroker] = useState('77.42.17.7:11884');
  const [status, setStatus] = useState<AutomationStatus>({
    connected: false,
    relay_state: 'Desconocido',
    last_data: null,
    last_updated: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollInterval = useRef<any>(null);

  const fetchStatus = () => {
    fetch('/api/automation/status')
      .then((res) => {
        if (!res.ok) throw new Error('Error al obtener estado');
        return res.json();
      })
      .then((data: AutomationStatus) => {
        setStatus(data);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError('No se pudo conectar con el servidor backend');
      });
  };

  useEffect(() => {
    // Initial fetch
    fetchStatus();
    // Poll every 1 second
    pollInterval.current = setInterval(fetchStatus, 1000);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, []);

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
        // Refresh status shortly after sending command
        setTimeout(fetchStatus, 300);
      })
      .catch((err) => {
        console.error(err);
        setError(`No se pudo enviar el comando "${cmd}"`);
      });
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
        {status.connected ? (
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
            <Radio size={14} className="animate-pulse" />
            Conectado a Thingsees
          </span>
        ) : (
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <Radio size={14} />
            Desconectado
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 p-4 rounded-xl text-sm font-medium flex items-center gap-3">
          <Info size={18} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Connection & Relay Control */}
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
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
              <Cpu size={20} className="text-indigo-500" />
              Controlador de Relé
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Control manual del actuador rele (GPIO 26) en el módulo ESP32.
            </p>

            <div className="flex flex-col items-center space-y-6">
              {/* Giant Relay Status Display */}
              <div className="flex flex-col items-center space-y-2">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                  status.relay_state === 'ON'
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-4 border-emerald-500'
                    : status.relay_state === 'OFF'
                    ? 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-4 border-slate-300 dark:border-slate-700'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-500 dark:text-amber-400 border-4 border-amber-400'
                }`}>
                  <Power size={36} className={status.relay_state === 'ON' ? 'animate-pulse' : ''} />
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Estado: {status.relay_state === 'ON' ? 'ENCENDIDO' : status.relay_state === 'OFF' ? 'APAGADO' : 'DESCONOCIDO'}
                </span>
              </div>

              {/* Direct Actions */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => handleCommand('on')}
                  className="py-2.5 px-4 rounded-xl font-medium text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm"
                >
                  Encender
                </button>
                <button
                  onClick={() => handleCommand('off')}
                  className="py-2.5 px-4 rounded-xl font-medium text-xs bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-sm"
                >
                  Apagar
                </button>
              </div>

              <div className="border-t border-slate-150 dark:border-slate-700/80 w-full pt-4 space-y-3">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Comandos Auxiliares
                </span>
                
                <div className="grid grid-cols-2 gap-2 w-full">
                  <button
                    onClick={() => handleCommand('ledon')}
                    className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-350 transition-colors"
                  >
                    💡 Encender LED
                  </button>
                  <button
                    onClick={() => handleCommand('ledoff')}
                    className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-350 transition-colors"
                  >
                    🔌 Apagar LED
                  </button>
                </div>
                
                <button
                  onClick={() => handleCommand('/zero')}
                  className="w-full py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-350 transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={12} />
                  Resetear Pulsos Caudalímetro
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Water Level Visual Tank */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200 flex flex-col h-full justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
                <Droplet size={20} className="text-blue-500" />
                Nivel de Agua
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                Indicador visual del porcentaje de volumen del tanque de reserva.
              </p>
            </div>

            {/* Visual Tank Component */}
            <div className="flex flex-col items-center justify-center my-6 flex-1">
              <div className="relative w-44 h-64 border-4 border-slate-300 dark:border-slate-600 rounded-2xl overflow-hidden shadow-inner bg-slate-100 dark:bg-slate-900/40">
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

            {/* Values */}
            <div className="grid grid-cols-2 gap-4 border-t border-slate-150 dark:border-slate-700/80 pt-4">
              <div className="text-center">
                <span className="block text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase">
                  Nivel de Agua
                </span>
                <span className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  {nivel} cm
                </span>
              </div>
              <div className="text-center">
                <span className="block text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase">
                  Distancia Sensor
                </span>
                <span className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  {distancia} cm
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Flow Rates & Raw counters */}
        <div className="space-y-6 lg:col-span-1">
          {/* Flow Rates Card */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
              <Droplet size={20} className="text-cyan-500" />
              Caudales y Flujo
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Mediciones de flujo de entrada y salida registradas en L/min.
            </p>

            <div className="space-y-4">
              {/* Caudal Entrada */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-150 dark:border-slate-700/50 flex justify-between items-center">
                <div>
                  <span className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">
                    Caudal Entrada
                  </span>
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    {caudalEntrada} L/min
                  </span>
                </div>
                <div className="w-2 h-8 rounded-full bg-emerald-500" />
              </div>

              {/* Caudal Salida */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-150 dark:border-slate-700/50 flex justify-between items-center">
                <div>
                  <span className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">
                    Caudal Salida
                  </span>
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    {caudalSalida} L/min
                  </span>
                </div>
                <div className="w-2 h-8 rounded-full bg-rose-500" />
              </div>

              {/* Balance */}
              <div className={`p-4 rounded-xl border flex justify-between items-center ${
                parseFloat(balance) >= 0
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30'
                  : 'bg-rose-50/50 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/30'
              }`}>
                <div>
                  <span className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">
                    Balance Neto
                  </span>
                  <span className={`text-xl font-bold ${parseFloat(balance) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {balance} L/min
                  </span>
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  parseFloat(balance) >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                }`}>
                  {parseFloat(balance) >= 0 ? '+' : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Raw Pulses Counter */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
              <HardDrive size={20} className="text-slate-500" />
              Contadores de Pulsos
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Número bruto de pulsos de sensor acumulados en el microcontrolador.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-150 dark:border-slate-700/50 text-center">
                <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                  Pulsos Entrada (lm)
                </span>
                <span className="text-2xl font-black text-slate-700 dark:text-slate-350 block mt-1">
                  {lm}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-150 dark:border-slate-700/50 text-center">
                <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                  Pulsos Salida (lm2)
                </span>
                <span className="text-2xl font-black text-slate-700 dark:text-slate-350 block mt-1">
                  {lm2}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 justify-end">
              <span>Última actualización:</span>
              <span className="font-semibold">
                {status.last_updated ? new Date(status.last_updated).toLocaleTimeString() : 'Nunca'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
