import { useEffect, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';

interface Stats {
  total_habitaciones: number;
  ocupadas: number;
  disponibles: number;
  contratos_activos: number;
}

interface Pago {
  id: number;
  contrato_id: number;
  mes: number;
  anio: number;
  monto_total: number;
  estado_pago: string;
  fecha_vencimiento: string;
  contrato: {
    id: number;
    inquilino_nombre: string;
    tipo_contrato: string;
    fecha_inicio: string;
    habitacion: {
      numero: string;
      bloque: string;
    };
  };
}

interface Contrato {
  id: number;
  estado: string;
  tipo_contrato: string;
  monto_mensual: number;
  monto_servicios: number;
  incluye_internet: boolean;
  monto_internet: number;
  inquilino_nombre: string;
  habitacion: {
    numero: string;
    bloque: string;
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    total_habitaciones: 0,
    ocupadas: 0,
    disponibles: 0,
    contratos_activos: 0,
  });
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Activos');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedContractType, setSelectedContractType] = useState('Todos');
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    contrato_id: '',
    mes: String(new Date().getMonth() + 1),
    monto_pagado: '',
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/dashboard/stats').then((res) => res.json()),
      fetch('/api/pagos').then((res) => res.json()),
      fetch('/api/contratos').then((res) => res.json()),
    ])
      .then(([statsData, pagosData, contratosData]) => {
        setStats(statsData);
        setPagos(pagosData || []);
        setContratos(contratosData || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setMessage('No se pudo cargar la matriz de pagos');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const getContratoMontoTotal = (contrato: Contrato) => (
    (contrato.tipo_contrato === 'Anticretico' ? 0 : Number(contrato.monto_mensual || 0)) +
    Number(contrato.monto_servicios || 0) +
    (contrato.incluye_internet ? Number(contrato.monto_internet || 0) : 0)
  );

  const activeContracts = contratos
    .filter((contrato) => {
      const matchesActive = contrato.estado === 'Activo';
      const matchesType = selectedContractType === 'Todos' || contrato.tipo_contrato === selectedContractType;
      return matchesActive && matchesType;
    })
    .sort((a, b) => a.inquilino_nombre.localeCompare(b.inquilino_nombre));

  const selectedContrato = activeContracts.find((contrato) => String(contrato.id) === paymentForm.contrato_id);
  const selectedMontoTotal = selectedContrato ? getContratoMontoTotal(selectedContrato) : 0;

  const openPaymentForm = () => {
    const firstContrato = activeContracts[0];
    setPaymentForm({
      contrato_id: firstContrato ? String(firstContrato.id) : '',
      mes: String(new Date().getMonth() + 1),
      monto_pagado: firstContrato ? String(getContratoMontoTotal(firstContrato)) : '',
    });
    setShowPaymentForm(true);
    setMessage(null);
  };

  const handleRegisterPayment = () => {
    setGenerating(true);
    setMessage(null);

    fetch('/api/pagos/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contrato_id: Number(paymentForm.contrato_id),
        anio: Number(selectedYear),
        mes: Number(paymentForm.mes),
        monto_pagado: Number(paymentForm.monto_pagado || 0),
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo registrar el pago');
        }
        setShowPaymentForm(false);
        setMessage('Pago registrado correctamente.');
        loadData();
      })
      .catch((err) => {
        console.error(err);
        setMessage(err instanceof Error ? err.message : 'No se pudo registrar el pago');
      })
      .finally(() => setGenerating(false));
  };

  const pagosFiltrados = pagos.filter((pago) => {
    const matchesYear = pago.anio === Number(selectedYear);
    const matchesType = selectedContractType === 'Todos' || pago.contrato?.tipo_contrato === selectedContractType;
    return matchesYear && matchesType;
  });

  const contratosMap = new Map<number, any>();
  pagosFiltrados.forEach((pago) => {
    if (!contratosMap.has(pago.contrato_id)) {
      const fechaVenc = new Date(pago.fecha_vencimiento);
      const dia = fechaVenc.getDate().toString().padStart(2, '0');

      contratosMap.set(pago.contrato_id, {
        id: pago.contrato_id,
        inquilino: pago.contrato.inquilino_nombre,
        habitacion: pago.contrato.habitacion.numero,
        bloque: pago.contrato.habitacion.bloque || '',
        dia,
        meses: Array(12).fill(null),
      });
    }
    contratosMap.get(pago.contrato_id).meses[pago.mes - 1] = pago;
  });

  const matrixData = Array.from(contratosMap.values());
  const mesesNombres = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  const getCellColor = (pago: Pago | null) => {
    if (!pago) return 'bg-slate-100 dark:bg-slate-700/50';
    switch (pago.estado_pago) {
      case 'Pagado':
        return 'bg-emerald-500 text-white';
      case 'Parcial':
        return 'bg-orange-500 text-white';
      case 'Vencido':
        return 'bg-red-500 text-white';
      case 'Pendiente':
        return 'bg-blue-600 text-white';
      default:
        return 'bg-slate-100 dark:bg-slate-700/50';
    }
  };

  const getCellContent = (pago: Pago | null) => {
    if (!pago) return '';
    if (pago.estado_pago === 'Pagado') return <Check size={16} className="mx-auto" />;
    if (pago.estado_pago === 'Vencido') return <AlertTriangle size={16} className="mx-auto" />;
    if (pago.estado_pago === 'Pendiente') return <span className="text-xs">Bs.0</span>;
    return <span className="text-xs">Bs.{pago.monto_total}</span>;
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-12">
      <h2 className="text-xl font-medium text-slate-800 dark:text-slate-100 transition-colors">
        Dashboard de Pagos - Anio {selectedYear}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 text-center transition-colors">
          <h3 className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{stats.total_habitaciones}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase mt-1 tracking-wide">Total Habitaciones</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 text-center transition-colors">
          <h3 className="text-3xl font-bold text-emerald-500">{stats.ocupadas}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase mt-1 tracking-wide">Ocupadas</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 text-center transition-colors">
          <h3 className="text-3xl font-bold text-orange-500">{stats.disponibles}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase mt-1 tracking-wide">Disponibles</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 text-center transition-colors">
          <h3 className="text-3xl font-bold text-cyan-500">{stats.contratos_activos}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase mt-1 tracking-wide">Contratos Activos</p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => setActiveTab('Activos')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'Activos' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
        >
          Contratos Activos ({stats.contratos_activos})
        </button>
        <button
          onClick={() => setActiveTab('Inactivos')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'Inactivos' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
        >
          Contratos Inactivos
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-wrap items-end gap-6 transition-colors">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Anio</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 transition-colors"
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Contrato</label>
          <select
            value={selectedContractType}
            onChange={(e) => setSelectedContractType(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 min-w-[150px] transition-colors"
          >
            <option value="Todos">Todos</option>
            <option value="Alquiler">Alquiler</option>
            <option value="Anticretico">Anticretico</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
          >
            Filtrar
          </button>
          <button
            onClick={openPaymentForm}
            disabled={generating}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
          >
            + Generar Pago
          </button>
        </div>
      </div>

      {showPaymentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-white">Registrar pago mensual</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Selecciona el inquilino activo, el mes y el monto recibido.
                </p>
              </div>
              <button
                onClick={() => setShowPaymentForm(false)}
                className="rounded-lg px-3 py-1 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                X
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-200">Inquilino activo</label>
                <select
                  value={paymentForm.contrato_id}
                  onChange={(e) => {
                    const nextContrato = activeContracts.find((contrato) => String(contrato.id) === e.target.value);
                    setPaymentForm((prev) => ({
                      ...prev,
                      contrato_id: e.target.value,
                      monto_pagado: nextContrato ? String(getContratoMontoTotal(nextContrato)) : '',
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-indigo-500"
                >
                  {activeContracts.length === 0 ? (
                    <option value="">No hay contratos activos</option>
                  ) : (
                    activeContracts.map((contrato) => (
                      <option key={contrato.id} value={contrato.id}>
                        {contrato.inquilino_nombre} - Cuarto {contrato.habitacion?.numero}
                        {contrato.habitacion?.bloque ? ` - ${contrato.habitacion.bloque}` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">Mes a pagar</label>
                  <select
                    value={paymentForm.mes}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, mes: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-indigo-500"
                  >
                    {mesesNombres.map((mes, index) => (
                      <option key={mes} value={index + 1}>
                        {mes}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">Monto pagado</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentForm.monto_pagado}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, monto_pagado: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-indigo-500"
                    placeholder="0"
                  />
                </div>
              </div>

              {selectedContrato && (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                  Monto esperado por este cuarto: <strong>Bs. {selectedMontoTotal.toFixed(2)}</strong>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowPaymentForm(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegisterPayment}
                disabled={generating || !paymentForm.contrato_id}
                className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? 'Guardando...' : 'Registrar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
          {message}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300 font-medium px-2">
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-emerald-500 rounded-sm"></div> Pagado</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-orange-500 rounded-sm"></div> Pago Parcial</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-blue-600 rounded-sm"></div> Pendiente</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-red-500 rounded-sm"></div> Vencido</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-sm"></div> Sin Datos</div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto transition-colors">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 transition-colors">
              <th className="p-3 border-r border-slate-200 dark:border-slate-700 w-48">Inquilino</th>
              <th className="p-3 border-r border-slate-200 dark:border-slate-700 w-24 text-center">Habitacion</th>
              <th className="p-3 border-r border-slate-200 dark:border-slate-700 w-16 text-center">Dia</th>
              {mesesNombres.map((mes) => (
                <th key={mes} className="p-3 border-r border-slate-200 dark:border-slate-700 text-center w-14 text-xs font-semibold">{mes}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={15} className="p-6 text-center text-slate-500 dark:text-slate-400">Cargando matriz...</td></tr>
            ) : matrixData.length === 0 ? (
              <tr><td colSpan={15} className="p-6 text-center text-slate-500 dark:text-slate-400">No hay contratos para mostrar.</td></tr>
            ) : matrixData.map((row) => (
              <tr key={row.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group">
                <td className="p-3 border-r border-slate-200 dark:border-slate-700">
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{row.inquilino}</p>
                </td>
                <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">
                  <div className="inline-block bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300 text-xs font-bold px-2 py-0.5 rounded-full mb-1 transition-colors">
                    {row.habitacion}
                  </div>
                  {row.bloque && <p className="text-xs text-slate-500 dark:text-slate-400">{row.bloque}</p>}
                </td>
                <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">
                  <span className="inline-block bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-2 py-1 rounded transition-colors">
                    {row.dia}
                  </span>
                </td>
                {row.meses.map((pago: Pago | null, i: number) => (
                  <td key={i} className="p-1 border-r border-slate-200 dark:border-slate-700 border-b border-white dark:border-slate-800">
                    <div className={`w-full h-12 flex items-center justify-center ${getCellColor(pago)} rounded-sm shadow-sm opacity-90 group-hover:opacity-100 transition-opacity`}>
                      {getCellContent(pago)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
