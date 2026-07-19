import { useEffect, useState } from 'react';
import { Users, X, Plus } from 'lucide-react';

interface Habitacion {
  id: number;
  numero: string;
}

interface Contrato {
  id?: number;
  habitacion_id?: number;
  habitacion?: { numero: string };
  inquilino_nombre: string;
  estado: string;
  tipo_contrato: string;
  monto_mensual: number;
  monto_garantia: number;
}

export default function Inquilinos() {
  const [inquilinos, setInquilinos] = useState<Contrato[]>([]);
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedInquilino, setSelectedInquilino] = useState<Contrato | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const loadData = () => {
    Promise.all([
      fetch('/api/contratos').then(r => r.json()),
      fetch('/api/habitaciones').then(r => r.json())
    ])
    .then(([contratosData, habitacionesData]) => {
      setInquilinos(contratosData);
      setHabitaciones(habitacionesData);
      setLoading(false);
    })
    .catch(console.error);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCardClick = (inq: Contrato) => {
    setIsCreating(false);
    setSelectedInquilino(inq);
    setIsModalOpen(true);
  };

  const handleCreateClick = () => {
    setIsCreating(true);
    setSelectedInquilino({
      inquilino_nombre: '',
      estado: 'Activo',
      tipo_contrato: 'Alquiler',
      monto_mensual: 0,
      monto_garantia: 0,
      habitacion_id: habitaciones.length > 0 ? habitaciones[0].id : undefined
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedInquilino(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquilino) return;

    // Ensure habitacion_id is an integer if creating
    const payload = {
      ...selectedInquilino,
      habitacion_id: selectedInquilino.habitacion_id ? Number(selectedInquilino.habitacion_id) : undefined
    };

    const url = isCreating 
      ? '/api/contratos' 
      : `/api/contratos/${selectedInquilino.id}`;
      
    const method = isCreating ? 'POST' : 'PUT';

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(() => {
        closeModal();
        loadData(); // reload to reflect changes
      })
      .catch(console.error);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 transition-colors">Directorio de Inquilinos</h2>
        <button 
          onClick={handleCreateClick}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Nuevo Inquilino
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-slate-500 dark:text-slate-400">Cargando...</p>
        ) : inquilinos.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">No hay inquilinos registrados.</p>
        ) : inquilinos.map(i => (
          <div 
            key={i.id} 
            onClick={() => handleCardClick(i)}
            className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-4 hover:-translate-y-1 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 transition-colors">
              <Users size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{i.inquilino_nombre}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Habitación: <span className="font-medium text-slate-700 dark:text-slate-200">{i.habitacion?.numero}</span></p>
              <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium transition-colors ${i.estado === 'Activo' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                {i.estado}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && selectedInquilino && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {isCreating ? 'Registrar Nuevo Inquilino' : 'Editar Inquilino'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="editInquilinoForm" onSubmit={handleSave} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nombre del Inquilino</label>
                    <input 
                      type="text" 
                      value={selectedInquilino.inquilino_nombre}
                      onChange={(e) => setSelectedInquilino({...selectedInquilino, inquilino_nombre: e.target.value})}
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
                        value={selectedInquilino.habitacion_id || ''}
                        onChange={(e) => setSelectedInquilino({...selectedInquilino, habitacion_id: parseInt(e.target.value)})}
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
                        value={selectedInquilino.habitacion?.numero || 'N/A'}
                        disabled
                        className="w-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 rounded-lg px-4 py-2.5 cursor-not-allowed transition-colors"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Estado del Contrato</label>
                  <select 
                    value={selectedInquilino.estado}
                    onChange={(e) => setSelectedInquilino({...selectedInquilino, estado: e.target.value})}
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
                    <input 
                      type="text" 
                      value={selectedInquilino.tipo_contrato || ''}
                      onChange={(e) => setSelectedInquilino({...selectedInquilino, tipo_contrato: e.target.value})}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Monto Mensual (Bs)</label>
                    <input 
                      type="number" 
                      value={selectedInquilino.monto_mensual || 0}
                      onChange={(e) => setSelectedInquilino({...selectedInquilino, monto_mensual: parseFloat(e.target.value) || 0})}
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
                form="editInquilinoForm" 
                className="px-6 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
              >
                {isCreating ? 'Registrar Inquilino' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
