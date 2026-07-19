import { useEffect, useState } from 'react';
import { Check, AlertTriangle } from 'lucide-react';

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
    fecha_inicio: string;
    habitacion: {
      numero: string;
      bloque: string;
    };
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total_habitaciones: 0, ocupadas: 0, disponibles: 0, contratos_activos: 0 });
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Activos');

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/stats').then(res => res.json()),
      fetch('/api/pagos').then(res => res.json())
    ]).then(([statsData, pagosData]) => {
      setStats(statsData);
      setPagos(pagosData);
      setLoading(false);
    }).catch(console.error);
  }, []);

  // Group payments by contract
  const contratosMap = new Map<number, any>();
  pagos.forEach(p => {
    if (!contratosMap.has(p.contrato_id)) {
      const fechaVenc = new Date(p.fecha_vencimiento);
      const dia = fechaVenc.getDate().toString().padStart(2, '0');
      
      contratosMap.set(p.contrato_id, {
        id: p.contrato_id,
        inquilino: p.contrato.inquilino_nombre,
        habitacion: p.contrato.habitacion.numero,
        bloque: p.contrato.habitacion.bloque || '',
        dia: dia,
        meses: Array(12).fill(null)
      });
    }
    // mes is 1-12, index is 0-11
    contratosMap.get(p.contrato_id).meses[p.mes - 1] = p;
  });

  const matrixData = Array.from(contratosMap.values());
  const mesesNombres = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  const getCellColor = (pago: Pago | null) => {
    if (!pago) return 'bg-slate-100 dark:bg-slate-700/50'; // Sin datos
    switch (pago.estado_pago) {
      case 'Pagado': return 'bg-emerald-500 text-white'; // Green
      case 'Parcial': return 'bg-orange-500 text-white'; // Orange
      case 'Vencido': return 'bg-red-500 text-white'; // Red
      case 'Pendiente': return 'bg-blue-600 text-white'; // Blue
      default: return 'bg-slate-100 dark:bg-slate-700/50';
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
      <h2 className="text-xl font-medium text-slate-800 dark:text-slate-100 transition-colors">Dashboard de Pagos - Año 2026</h2>

      {/* Top Stats Cards */}
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

      {/* Tabs */}
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

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-wrap items-end gap-6 transition-colors">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Año</label>
          <select className="border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 transition-colors">
            <option>2026</option>
            <option>2025</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Contrato</label>
          <select className="border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 min-w-[150px] transition-colors">
            <option>Todos</option>
            <option>Alquiler</option>
            <option>Anticrético</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
            Filtrar
          </button>
          <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
            + Generar Pagos
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300 font-medium px-2">
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-emerald-500 rounded-sm"></div> Pagado</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-orange-500 rounded-sm"></div> Pago Parcial</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-blue-600 rounded-sm"></div> Pendiente</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-red-500 rounded-sm"></div> Vencido</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-sm"></div> Sin Datos</div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto transition-colors">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 transition-colors">
              <th className="p-3 border-r border-slate-200 dark:border-slate-700 w-48">Inquilino</th>
              <th className="p-3 border-r border-slate-200 dark:border-slate-700 w-24 text-center">Habitación</th>
              <th className="p-3 border-r border-slate-200 dark:border-slate-700 w-16 text-center">Día</th>
              {mesesNombres.map(mes => (
                <th key={mes} className="p-3 border-r border-slate-200 dark:border-slate-700 text-center w-14 text-xs font-semibold">{mes}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={15} className="p-6 text-center text-slate-500 dark:text-slate-400">Cargando matriz...</td></tr>
            ) : matrixData.length === 0 ? (
              <tr><td colSpan={15} className="p-6 text-center text-slate-500 dark:text-slate-400">No hay contratos para mostrar.</td></tr>
            ) : matrixData.map(row => (
              <tr key={row.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group">
                <td className="p-3 border-r border-slate-200 dark:border-slate-700">
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{row.inquilino}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">77777777</p> {/* Placeholder phone */}
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
                  <td key={i} className={`p-1 border-r border-slate-200 dark:border-slate-700 border-b border-white dark:border-slate-800`}>
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
