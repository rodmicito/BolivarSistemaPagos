import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface Pago {
  id: number;
  contrato_id?: number;
  contrato: {
    id?: number;
    habitacion?: { numero: string; bloque?: string };
    inquilino_nombre: string;
  };
  mes: number;
  anio: number;
  monto_total: number;
  estado_pago: string;
  fecha_vencimiento: string;
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
  habitacion?: {
    numero: string;
    bloque?: string;
  };
}

const monthOptions = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

const currentDate = new Date();

export default function Pagos() {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    contrato_id: '',
    mes: String(currentDate.getMonth() + 1),
    anio: String(currentDate.getFullYear()),
    monto_pagado: '',
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/pagos').then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar pagos');
        return res.json();
      }),
      fetch('/api/contratos').then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar contratos');
        return res.json();
      }),
    ])
      .then(([pagosData, contratosData]) => {
        setPagos(pagosData || []);
        setContratos(contratosData || []);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : 'No se pudo cargar el control de pagos');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeContracts = useMemo(
    () =>
      contratos
        .filter((contrato) => contrato.estado === 'Activo')
        .sort((a, b) => a.inquilino_nombre.localeCompare(b.inquilino_nombre)),
    [contratos]
  );

  const getContratoMontoTotal = (contrato: Contrato) =>
    (contrato.tipo_contrato === 'Anticretico' ? 0 : Number(contrato.monto_mensual || 0)) +
    Number(contrato.monto_servicios || 0) +
    (contrato.incluye_internet ? Number(contrato.monto_internet || 0) : 0);

  useEffect(() => {
    if (activeContracts.length === 0) return;

    setPaymentForm((current) => {
      const selectedContract =
        activeContracts.find((contrato) => String(contrato.id) === current.contrato_id) || activeContracts[0];

      return {
        ...current,
        contrato_id: String(selectedContract.id),
        monto_pagado:
          current.contrato_id === String(selectedContract.id) && current.monto_pagado !== ''
            ? current.monto_pagado
            : String(getContratoMontoTotal(selectedContract)),
      };
    });
  }, [activeContracts]);

  const selectedContrato = activeContracts.find((contrato) => String(contrato.id) === paymentForm.contrato_id);
  const selectedMontoTotal = selectedContrato ? getContratoMontoTotal(selectedContrato) : 0;

  const formattedPeriod = `${paymentForm.mes}/${paymentForm.anio}`;

  const handlePagar = (id: number) => {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    fetch(`/api/pagos/${id}/pagar`, { method: 'POST' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo cobrar el pago');
        }
        setMessage('Pago cobrado correctamente.');
        loadData();
      })
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : 'No se pudo cobrar el pago');
      })
      .finally(() => setSubmitting(false));
  };

  const handleRegisterPayment = (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentForm.contrato_id) {
      setError('Selecciona un inquilino activo.');
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setError(null);

    fetch('/api/pagos/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contrato_id: Number(paymentForm.contrato_id),
        anio: Number(paymentForm.anio),
        mes: Number(paymentForm.mes),
        monto_pagado: Number(paymentForm.monto_pagado || 0),
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo registrar el pago');
        }
        setMessage(`Pago registrado para el periodo ${formattedPeriod}.`);
        loadData();
      })
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : 'No se pudo registrar el pago');
      })
      .finally(() => setSubmitting(false));
  };

  const getStatusBadge = (estado: string) => {
    if (estado === 'Pagado') {
      return (
        <span className="flex items-center gap-1 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full text-xs font-medium transition-colors">
          <CheckCircle size={14} /> Pagado
        </span>
      );
    }
    if (estado === 'Vencido') {
      return (
        <span className="flex items-center gap-1 text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full text-xs font-medium transition-colors">
          <AlertTriangle size={14} /> Vencido
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full text-xs font-medium transition-colors">
        <Clock size={14} /> Pendiente
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 transition-colors">Control de Pagos</h2>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 md:p-6 space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Cobro puntual por inquilino</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Selecciona un inquilino activo y el mes que deseas cobrar de forma directa.
          </p>
        </div>

        <form onSubmit={handleRegisterPayment} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="xl:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Inquilino</label>
            <select
              value={paymentForm.contrato_id}
              onChange={(e) => {
                const contratoId = e.target.value;
                const contrato = activeContracts.find((item) => String(item.id) === contratoId);
                setPaymentForm((current) => ({
                  ...current,
                  contrato_id: contratoId,
                  monto_pagado: contrato ? String(getContratoMontoTotal(contrato)) : '',
                }));
              }}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
            >
              <option value="">Selecciona un inquilino</option>
              {activeContracts.map((contrato) => (
                <option key={contrato.id} value={contrato.id}>
                  {contrato.inquilino_nombre} - Cuarto {contrato.habitacion?.numero}
                  {contrato.habitacion?.bloque ? ` - ${contrato.habitacion.bloque}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Mes</label>
            <select
              value={paymentForm.mes}
              onChange={(e) => setPaymentForm((current) => ({ ...current, mes: e.target.value }))}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Año</label>
            <input
              type="number"
              min="2020"
              max="2100"
              value={paymentForm.anio}
              onChange={(e) => setPaymentForm((current) => ({ ...current, anio: e.target.value }))}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Monto a pagar</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={paymentForm.monto_pagado}
              onChange={(e) => setPaymentForm((current) => ({ ...current, monto_pagado: e.target.value }))}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="xl:col-span-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 px-4 py-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {selectedContrato ? (
                <>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{selectedContrato.inquilino_nombre}</span>
                  {` pagará el periodo ${formattedPeriod}. Monto sugerido: Bs. ${selectedMontoTotal.toFixed(2)}`}
                </>
              ) : (
                'Selecciona un inquilino para preparar el cobro.'
              )}
            </div>
            <button
              type="submit"
              disabled={submitting || !selectedContrato}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm w-full md:w-auto"
            >
              {submitting ? 'Registrando...' : 'Registrar pago puntual'}
            </button>
          </div>
        </form>

        {message && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 px-4 py-3 rounded-xl text-sm">
            {message}
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="space-y-4 md:hidden">
        {loading ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">Cargando...</p>
        ) : pagos.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">No hay pagos registrados.</p>
        ) : (
          pagos.map((p) => (
            <div key={p.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold px-3 py-1 rounded-md transition-colors">
                  Habitación {p.contrato?.habitacion?.numero}
                </span>
                {getStatusBadge(p.estado_pago)}
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">{p.contrato?.inquilino_nombre}</h4>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Periodo: {p.mes}/{p.anio}</span>
                  <span>Vence: {new Date(p.fecha_vencimiento).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-700/60">
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-semibold uppercase">Monto total</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">Bs. {p.monto_total}</span>
                </div>
                {p.estado_pago !== 'Pagado' && (
                  <button
                    onClick={() => handlePagar(p.id)}
                    disabled={submitting}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm py-2 px-5 rounded-lg font-bold transition-all shadow-sm active:scale-95"
                  >
                    Cobrar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors uppercase tracking-wider">
              <th className="p-4">Habitación</th>
              <th className="p-4">Inquilino</th>
              <th className="p-4">Periodo</th>
              <th className="p-4">Vencimiento</th>
              <th className="p-4">Monto</th>
              <th className="p-4">Estado</th>
              <th className="p-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                  Cargando...
                </td>
              </tr>
            ) : pagos.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                  No hay pagos registrados.
                </td>
              </tr>
            ) : (
              pagos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{p.contrato?.habitacion?.numero}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 font-medium">{p.contrato?.inquilino_nombre}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{p.mes}/{p.anio}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{new Date(p.fecha_vencimiento).toLocaleDateString()}</td>
                  <td className="p-4 font-bold text-slate-800 dark:text-slate-200">Bs. {p.monto_total}</td>
                  <td className="p-4">{getStatusBadge(p.estado_pago)}</td>
                  <td className="p-4 text-right">
                    {p.estado_pago !== 'Pagado' && (
                      <button
                        onClick={() => handlePagar(p.id)}
                        disabled={submitting}
                        className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-1.5 px-4 rounded-lg font-bold transition-all shadow-sm"
                      >
                        Cobrar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
