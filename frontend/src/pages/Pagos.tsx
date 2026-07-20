import { useEffect, useState } from 'react';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface Pago {
  id: number;
  contrato: {
    habitacion: { numero: string };
    inquilino_nombre: string;
  };
  mes: number;
  anio: number;
  monto_total: number;
  estado_pago: string;
  fecha_vencimiento: string;
}

export default function Pagos() {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPagos = () => {
    fetch('/api/pagos')
      .then(res => res.json())
      .then(data => {
        setPagos(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadPagos();
  }, []);

  const handlePagar = (id: number) => {
    fetch(`/api/pagos/${id}/pagar`, { method: 'POST' })
      .then(() => loadPagos());
  };

  const getStatusBadge = (estado: string) => {
    if (estado === 'Pagado') return <span className="flex items-center gap-1 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full text-xs font-medium transition-colors"><CheckCircle size={14}/> Pagado</span>;
    if (estado === 'Vencido') return <span className="flex items-center gap-1 text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full text-xs font-medium transition-colors"><AlertTriangle size={14}/> Vencido</span>;
    return <span className="flex items-center gap-1 text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full text-xs font-medium transition-colors"><Clock size={14}/> Pendiente</span>;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 transition-colors">Control de Pagos</h2>
      </div>
      
      {/* Vista Móvil: Tarjetas */}
      <div className="space-y-4 md:hidden">
        {loading ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">Cargando...</p>
        ) : pagos.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">No hay pagos registrados.</p>
        ) : pagos.map(p => (
          <div key={p.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <span className="bg-indigo-150 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold px-3 py-1 rounded-md transition-colors">
                Habitación {p.contrato?.habitacion?.numero}
              </span>
              {getStatusBadge(p.estado_pago)}
            </div>
            
            <div className="space-y-1">
              <h4 className="font-bold text-slate-800 dark:text-slate-150 text-base">{p.contrato?.inquilino_nombre}</h4>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Periodo: {p.mes}/{p.anio}</span>
                <span>Vence: {new Date(p.fecha_vencimiento).toLocaleDateString()}</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-700/60">
              <div>
                <span className="text-[10px] text-slate-400 dark:text-slate-550 block font-semibold uppercase">Monto Total</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">Bs. {p.monto_total}</span>
              </div>
              {p.estado_pago !== 'Pagado' && (
                <button 
                  onClick={() => handlePagar(p.id)} 
                  className="bg-indigo-650 hover:bg-indigo-700 text-white text-sm py-2 px-5 rounded-lg font-bold transition-all shadow-sm active:scale-95"
                >
                  Cobrar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Vista Desktop: Tabla */}
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-650 dark:text-slate-350 transition-colors uppercase tracking-wider">
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
              <tr><td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">Cargando...</td></tr>
            ) : pagos.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">No hay pagos registrados.</td></tr>
            ) : pagos.map(p => (
              <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{p.contrato?.habitacion?.numero}</td>
                <td className="p-4 text-slate-650 dark:text-slate-300 font-medium">{p.contrato?.inquilino_nombre}</td>
                <td className="p-4 text-slate-600 dark:text-slate-400">{p.mes}/{p.anio}</td>
                <td className="p-4 text-slate-600 dark:text-slate-400">{new Date(p.fecha_vencimiento).toLocaleDateString()}</td>
                <td className="p-4 font-bold text-slate-800 dark:text-slate-200">Bs. {p.monto_total}</td>
                <td className="p-4">{getStatusBadge(p.estado_pago)}</td>
                <td className="p-4 text-right">
                  {p.estado_pago !== 'Pagado' && (
                    <button onClick={() => handlePagar(p.id)} className="text-sm bg-indigo-650 hover:bg-indigo-700 text-white py-1.5 px-4 rounded-lg font-bold transition-all shadow-sm">
                      Cobrar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
