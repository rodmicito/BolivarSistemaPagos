import { useEffect, useState } from 'react';
import { FileText, Plus, Home, DollarSign, Briefcase, Eye, Edit, Trash2, Filter, X } from 'lucide-react';

interface Habitacion {
  id: number;
  numero: string;
}

interface Contrato {
  id?: number;
  habitacion_id?: number;
  habitacion?: { numero: string };
  inquilino_nombre: string;
  tipo_contrato: string;
  monto_mensual: number;
  monto_garantia: number;
  estado: string;
  fecha_inicio?: string;
}

export default function Contratos() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterEstado, setFilterEstado] = useState('Todos');
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [filterHabitacion, setFilterHabitacion] = useState('Todas');

  // Modal State
  const [selectedContrato, setSelectedContrato] = useState<Contrato | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const loadData = () => {
    Promise.all([
      fetch('/api/contratos').then(r => r.json()),
      fetch('/api/habitaciones').then(r => r.json())
    ])
    .then(([contratosData, habitacionesData]) => {
      setContratos(contratosData || []);
      setHabitaciones(habitacionesData || []);
      setLoading(false);
    })
    .catch(console.error);
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Calculations for Summary Cards ---
  const contratosActivos = contratos.filter(c => c.estado === 'Activo');
  const ingresoMensualTotal = contratosActivos.reduce((sum, c) => sum + (c.monto_mensual || 0), 0);
  const totalHabitaciones = habitaciones.length;
  const ocupacionPorcentaje = totalHabitaciones > 0 ? ((contratosActivos.length / totalHabitaciones) * 100).toFixed(1) : '0.0';
  const anticreticosActivos = contratosActivos.filter(c => c.tipo_contrato?.toLowerCase() === 'anticretico');
  const totalGarantiaAnticreticos = anticreticosActivos.reduce((sum, c) => sum + (c.monto_garantia || 0), 0);

  // --- Filtering Logic ---
  const filteredContratos = contratos.filter(c => {
    const matchEstado = filterEstado === 'Todos' || c.estado === filterEstado;
    const matchTipo = filterTipo === 'Todos' || c.tipo_contrato === filterTipo;
    const matchHab = filterHabitacion === 'Todas' || c.habitacion?.numero === filterHabitacion;
    return matchEstado && matchTipo && matchHab;
  });

  // --- Actions ---
  const handleToggleEstado = (c: Contrato) => {
    const newEstado = c.estado === 'Activo' ? 'Inactivo' : 'Activo';
    fetch(`/api/contratos/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...c, estado: newEstado })
    })
    .then(() => loadData())
    .catch(console.error);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este contrato y todos sus pagos asociados? Esta acción no se puede deshacer.")) {
      fetch(`/api/contratos/${id}`, { method: 'DELETE' })
        .then(() => loadData())
        .catch(console.error);
    }
  };

  const openCreateModal = () => {
    setIsCreating(true);
    setSelectedContrato({
      inquilino_nombre: '',
      estado: 'Activo',
      tipo_contrato: 'Alquiler',
      monto_mensual: 0,
      monto_garantia: 0,
      habitacion_id: habitaciones.length > 0 ? habitaciones[0].id : undefined
    });
    setIsModalOpen(true);
  };

  const openEditModal = (c: Contrato) => {
    setIsCreating(false);
    setSelectedContrato(c);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedContrato(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContrato) return;

    const payload = {
      ...selectedContrato,
      habitacion_id: selectedContrato.habitacion_id ? Number(selectedContrato.habitacion_id) : undefined
    };

    const url = isCreating 
      ? '/api/contratos' 
      : `/api/contratos/${selectedContrato.id}`;
      
    const method = isCreating ? 'POST' : 'PUT';

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(() => {
        closeModal();
        loadData();
      })
      .catch(console.error);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 transition-colors">Gestión de Contratos</h2>
        <button 
          onClick={openCreateModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-sm w-full sm:w-auto"
        >
          <Plus size={18} />
          Nuevo Contrato
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 border-indigo-500 shadow-sm flex justify-between items-center transition-colors">
          <div>
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-1 uppercase">Contratos Activos</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{contratosActivos.length} <span className="text-sm font-normal text-slate-500">de {contratos.length}</span></h3>
          </div>
          <FileText className="text-slate-200 dark:text-slate-700" size={48} />
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 border-emerald-500 shadow-sm flex justify-between items-center transition-colors">
          <div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1 uppercase">Ingreso Mensual Total</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Bs. {ingresoMensualTotal.toFixed(2)}</h3>
          </div>
          <DollarSign className="text-slate-200 dark:text-slate-700" size={48} />
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 border-sky-500 shadow-sm flex justify-between items-center transition-colors">
          <div>
            <p className="text-sm font-semibold text-sky-600 dark:text-sky-400 mb-1 uppercase">Ocupación</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{contratosActivos.length}/{totalHabitaciones} <span className="text-sm font-normal text-slate-500">({ocupacionPorcentaje}%)</span></h3>
          </div>
          <Home className="text-slate-200 dark:text-slate-700" size={48} />
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 border-orange-500 shadow-sm flex justify-between items-center transition-colors">
          <div>
            <p className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-1 uppercase">Total Anticréticos</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Bs. {totalGarantiaAnticreticos.toFixed(2)} <span className="text-sm font-normal text-slate-500">({anticreticosActivos.length} contratos)</span></h3>
          </div>
          <Briefcase className="text-slate-200 dark:text-slate-700" size={48} />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap gap-6 items-end transition-colors">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Estado</label>
          <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors">
            <option value="Todos">Todos</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
            <option value="Finalizado">Finalizado</option>
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tipo de Contrato</label>
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors">
            <option value="Todos">Todos</option>
            <option value="Alquiler">Alquiler</option>
            <option value="Anticretico">Anticretico</option>
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Habitación</label>
          <select value={filterHabitacion} onChange={e => setFilterHabitacion(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors">
            <option value="Todas">Todas</option>
            {habitaciones.map(h => <option key={h.id} value={h.numero}>{h.numero}</option>)}
          </select>
        </div>
        <div>
          <button className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Filter size={16} />
            Filtrar
          </button>
        </div>
      </div>
      {/* Vista Móvil: Tarjetas */}
      <div className="space-y-4 md:hidden">
        {loading ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">Cargando datos...</p>
        ) : filteredContratos.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">No hay contratos registrados.</p>
        ) : filteredContratos.map(c => (
          <div key={c.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">{c.inquilino_nombre}</h4>
                <p className="text-xs text-slate-400 dark:text-slate-500">Inicio: {c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString() : 'N/A'}</p>
              </div>
              <span className="inline-flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-lg font-bold text-xs border border-indigo-100 dark:border-indigo-900/50">
                Hab. {c.habitacion?.numero}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
              <div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-semibold">Tipo</span>
                <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase ${c.tipo_contrato?.toLowerCase() === 'alquiler' ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'}`}>
                  {c.tipo_contrato}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-semibold">Mensualidad</span>
                <span className="font-bold text-slate-800 dark:text-slate-205 text-sm">Bs. {c.monto_mensual?.toFixed(2)}</span>
                {c.tipo_contrato?.toLowerCase() === 'anticretico' && (
                  <span className="text-[10px] text-slate-400 block font-medium">Garantía: Bs. {c.monto_garantia?.toFixed(2)}</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Estado:</span>
                <button 
                  onClick={() => handleToggleEstado(c)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${c.estado === 'Activo' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${c.estado === 'Activo' ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
                <span className={`text-[11px] font-bold ${c.estado === 'Activo' ? 'text-emerald-500' : 'text-slate-500'}`}>{c.estado}</span>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => openEditModal(c)} className="p-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors shadow-sm" title="Ver Detalle">
                  <Eye size={15} />
                </button>
                <button onClick={() => openEditModal(c)} className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors shadow-sm" title="Editar">
                  <Edit size={15} />
                </button>
                <button onClick={() => handleDelete(c.id!)} className="p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors shadow-sm" title="Eliminar">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Vista Desktop: Tabla */}
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-650 dark:text-slate-350 uppercase tracking-wider transition-colors">
                <th className="p-5">Inquilino</th>
                <th className="p-5 text-center">Habitación</th>
                <th className="p-5 text-center">Tipo</th>
                <th className="p-5">Monto Mensual</th>
                <th className="p-5 text-center">Estado</th>
                <th className="p-5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400">Cargando datos...</td></tr>
              ) : filteredContratos.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400">No hay contratos que coincidan con los filtros.</td></tr>
              ) : filteredContratos.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors group">
                  <td className="p-5">
                    <p className="font-bold text-slate-800 dark:text-slate-100">{c.inquilino_nombre}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Inicio: {c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString() : 'N/A'}</p>
                  </td>
                  <td className="p-5 text-center">
                    <span className="inline-flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1 rounded-lg font-bold text-sm">
                      <Home size={14} className="mr-1" /> {c.habitacion?.numero}
                    </span>
                  </td>
                  <td className="p-5 text-center">
                    <span className={`inline-block px-3 py-1 rounded-md text-xs font-bold uppercase ${c.tipo_contrato?.toLowerCase() === 'alquiler' ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'}`}>
                      {c.tipo_contrato}
                    </span>
                  </td>
                  <td className="p-5">
                    <p className="font-bold text-slate-800 dark:text-slate-100">Bs. {c.monto_mensual?.toFixed(2)}</p>
                    {c.tipo_contrato?.toLowerCase() === 'anticretico' && (
                      <p className="text-xs text-slate-400">Gar: Bs. {c.monto_garantia?.toFixed(2)}</p>
                    )}
                  </td>
                  <td className="p-5 text-center">
                    {/* Toggle Slider */}
                    <button 
                      onClick={() => handleToggleEstado(c)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${c.estado === 'Activo' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${c.estado === 'Activo' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="p-5">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openEditModal(c)} className="p-2 bg-sky-500 hover:bg-sky-600 text-white rounded-md transition-colors shadow-sm" title="Ver Detalle">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => openEditModal(c)} className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md transition-colors shadow-sm" title="Editar">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(c.id!)} className="p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-md transition-colors shadow-sm" title="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && selectedContrato && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {isCreating ? 'Registrar Nuevo Contrato' : 'Editar Contrato'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="editContratoForm" onSubmit={handleSave} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nombre del Inquilino</label>
                    <input 
                      type="text" 
                      value={selectedContrato.inquilino_nombre}
                      onChange={(e) => setSelectedContrato({...selectedContrato, inquilino_nombre: e.target.value})}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Habitación {isCreating ? '(Seleccionar)' : '(Asignada)'}
                    </label>
                    {isCreating ? (
                      <select
                        value={selectedContrato.habitacion_id || ''}
                        onChange={(e) => setSelectedContrato({...selectedContrato, habitacion_id: parseInt(e.target.value)})}
                        className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                        required
                      >
                        {habitaciones.map(h => (
                          <option key={h.id} value={h.id}>Habitación {h.numero}</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        value={selectedContrato.habitacion?.numero || 'N/A'}
                        disabled
                        className="w-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 rounded-lg px-4 py-2.5 cursor-not-allowed transition-colors"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Estado del Contrato</label>
                  <select 
                    value={selectedContrato.estado}
                    onChange={(e) => setSelectedContrato({...selectedContrato, estado: e.target.value})}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Finalizado">Finalizado</option>
                    <option value="Suspendido">Suspendido</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tipo Contrato</label>
                    <select 
                      value={selectedContrato.tipo_contrato || 'Alquiler'}
                      onChange={(e) => setSelectedContrato({...selectedContrato, tipo_contrato: e.target.value})}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    >
                      <option value="Alquiler">Alquiler</option>
                      <option value="Anticretico">Anticretico</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Monto Mensual (Bs)</label>
                    <input 
                      type="number" 
                      value={selectedContrato.monto_mensual || 0}
                      onChange={(e) => setSelectedContrato({...selectedContrato, monto_mensual: parseFloat(e.target.value) || 0})}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Monto Garantía (Bs)</label>
                    <input 
                      type="number" 
                      value={selectedContrato.monto_garantia || 0}
                      onChange={(e) => setSelectedContrato({...selectedContrato, monto_garantia: parseFloat(e.target.value) || 0})}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

              </form>
            </div>
            
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 rounded-b-2xl">
              <button 
                type="button" 
                onClick={closeModal} 
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                form="editContratoForm" 
                className="px-6 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
              >
                {isCreating ? 'Crear Contrato' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
