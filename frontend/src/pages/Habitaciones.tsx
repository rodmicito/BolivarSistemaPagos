import { useEffect, useState } from 'react';
import { Home, CheckCircle2, XCircle, Percent, Filter, Lock, X, UserRound, Phone, DollarSign } from 'lucide-react';

interface Habitacion {
  id: number;
  numero: string;
  bloque: string;
  nivel: string;
  tipo_habitacion: string;
  tipo_bano: string;
  precio_alquiler: number;
  precio_anticretico: number;
  precio_internet: number;
  descripcion: string;
  estado?: 'DISPONIBLE' | 'OCUPADA';
}

interface Inquilino {
  id?: number;
  nombre: string;
  documento?: string;
  telefono?: string;
  email?: string;
  activo?: boolean;
}

interface Contrato {
  id?: number;
  habitacion_id?: number;
  inquilino_id?: number;
  inquilino?: Inquilino;
  inquilino_nombre?: string;
  tipo_contrato: string;
  monto_mensual: number;
  monto_garantia: number;
  estado: string;
}

export default function Habitaciones() {
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHabitacion, setSelectedHabitacion] = useState<Habitacion | null>(null);
  const [selectedInquilinoId, setSelectedInquilinoId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const contratosActivos = contratos.filter(c => c.estado === 'Activo');
  const activeContractByRoom = new Map<number, Contrato>();
  contratosActivos.forEach(c => {
    if (c.habitacion_id) activeContractByRoom.set(Number(c.habitacion_id), c);
  });

  const inquilinosActivos = inquilinos.filter(i => i.activo !== false);
  const totalHabitaciones = habitaciones.length;
  const ocupadas = activeContractByRoom.size;
  const disponibles = Math.max(totalHabitaciones - ocupadas, 0);

  const stats = {
    total: totalHabitaciones,
    disponibles,
    ocupadas,
    ocupacion: totalHabitaciones > 0 ? `${((ocupadas / totalHabitaciones) * 100).toFixed(1)}%` : '0.0%'
  };

  const loadRooms = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/habitaciones').then(res => res.json()),
      fetch('/api/contratos').then(res => res.json()),
      fetch('/api/inquilinos').then(res => res.json())
    ])
      .then(([habitacionesData, contratosData, inquilinosData]) => {
        const activeRoomIds = new Set(
          (contratosData || [])
            .filter((c: Contrato) => c.estado === 'Activo' && c.habitacion_id)
            .map((c: Contrato) => Number(c.habitacion_id))
        );

        const mapped = (habitacionesData || []).map((h: any) => ({
          ...h,
          estado: activeRoomIds.has(Number(h.id)) ? 'OCUPADA' : 'DISPONIBLE',
          nivel: h.nivel || 'PB',
          tipo_habitacion: h.tipo_habitacion || 'Cuarto Pequeño',
          tipo_bano: h.tipo_bano || 'BAÑO PRIVADO'
        }));

        if (mapped.length === 0) {
          setHabitaciones([
            { id: 1, numero: '1', bloque: 'BLOQUE A', nivel: 'PB', tipo_habitacion: 'Cuarto Pequeño', tipo_bano: 'BAÑO PRIVADO', descripcion: 'Cuarto Pequeño con baño Privado', estado: 'DISPONIBLE', precio_alquiler: 0, precio_anticretico: 0, precio_internet: 0 },
            { id: 2, numero: '2', bloque: 'BLOQUE A', nivel: 'PB', tipo_habitacion: 'Cuarto Pequeño', tipo_bano: 'BAÑO PRIVADO', descripcion: 'Cuarto Pequeño con baño Privado', estado: 'DISPONIBLE', precio_alquiler: 0, precio_anticretico: 0, precio_internet: 0 }
          ]);
        } else {
          setHabitaciones(mapped);
        }

        setContratos(contratosData || []);
        setInquilinos(inquilinosData || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const getContratoInquilino = (contrato: Contrato): Inquilino => {
    return contrato.inquilino || inquilinos.find(i => i.id === contrato.inquilino_id) || {
      id: contrato.inquilino_id,
      nombre: contrato.inquilino_nombre || '',
      documento: '',
      telefono: '',
      email: ''
    };
  };

  const getOccupantName = (contrato?: Contrato) => {
    if (!contrato) return '';
    return contrato.inquilino?.nombre || contrato.inquilino_nombre || 'Sin nombre';
  };

  const getAssignableInquilinos = () => {
    const currentRoomId = selectedHabitacion?.id;
    const occupiedTenantIds = new Set(
      contratosActivos
        .filter(c => c.habitacion_id && Number(c.habitacion_id) !== Number(currentRoomId))
        .map(c => c.inquilino?.id || c.inquilino_id)
        .filter(Boolean)
    );

    return inquilinosActivos.filter(inquilino => inquilino.id && !occupiedTenantIds.has(inquilino.id));
  };

  const handleCardClick = (hab: Habitacion) => {
    const activeContract = activeContractByRoom.get(Number(hab.id));
    setSelectedHabitacion(hab);
    setSelectedInquilinoId(activeContract?.inquilino?.id?.toString() || activeContract?.inquilino_id?.toString() || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedHabitacion(null);
    setSelectedInquilinoId('');
    setFormError('');
  };

  const saveContrato = async (url: string, method: 'POST' | 'PUT', payload: Contrato) => {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo guardar la ocupación de la habitación');
    }
  };

  const syncRoomOccupant = async (habitacion: Habitacion) => {
    const activeContract = activeContractByRoom.get(Number(habitacion.id));
    const nextInquilinoId = selectedInquilinoId ? Number(selectedInquilinoId) : undefined;
    const currentInquilinoId = activeContract?.inquilino?.id || activeContract?.inquilino_id;

    if (currentInquilinoId === nextInquilinoId) return;

    if (!nextInquilinoId) {
      if (!activeContract?.id) return;
      const currentInquilino = getContratoInquilino(activeContract);
      await saveContrato(`/api/contratos/${activeContract.id}`, 'PUT', {
        ...activeContract,
        estado: 'Inactivo',
        tipo_contrato: activeContract.tipo_contrato || 'Alquiler',
        monto_mensual: activeContract.monto_mensual || 0,
        monto_garantia: activeContract.monto_garantia || 0,
        inquilino: currentInquilino,
        inquilino_nombre: currentInquilino.nombre
      });
      return;
    }

    const inquilino = inquilinos.find(i => i.id === nextInquilinoId);
    if (!inquilino) {
      throw new Error('Selecciona un inquilino válido');
    }

    const contratoPayload: Contrato = {
      ...(activeContract || {}),
      habitacion_id: habitacion.id,
      inquilino_id: inquilino.id,
      inquilino,
      inquilino_nombre: inquilino.nombre,
      estado: 'Activo',
      tipo_contrato: activeContract?.tipo_contrato || 'Alquiler',
      monto_mensual: activeContract?.monto_mensual || habitacion.precio_alquiler || 0,
      monto_garantia: activeContract?.monto_garantia || 0
    };

    if (activeContract?.id) {
      await saveContrato(`/api/contratos/${activeContract.id}`, 'PUT', contratoPayload);
    } else {
      await saveContrato('/api/contratos', 'POST', contratoPayload);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHabitacion) return;

    setSaving(true);
    setFormError('');

    try {
      const response = await fetch(`/api/habitaciones/${selectedHabitacion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedHabitacion)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo guardar la habitación');
      }

      await syncRoomOccupant(selectedHabitacion);
      closeModal();
      loadRooms();
    } catch (error: any) {
      console.error(error);
      setFormError(error.message || 'No se pudieron guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 pb-12 relative">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 transition-colors">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 text-center mb-8 transition-colors">Gestión de Habitaciones</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="flex items-center gap-4 border-l-4 border-blue-500 bg-white dark:bg-slate-800 p-4 rounded-r-lg shadow-sm transition-colors">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 rounded-lg transition-colors">
              <Home size={32} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.total}</p>
              <p className="text-xs text-slate-400 font-medium uppercase">Total Habitaciones</p>
            </div>
          </div>

          <div className="flex items-center gap-4 border-l-4 border-emerald-500 bg-white dark:bg-slate-800 p-4 rounded-r-lg shadow-sm transition-colors">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400 rounded-lg transition-colors">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.disponibles}</p>
              <p className="text-xs text-slate-400 font-medium uppercase">Disponibles</p>
            </div>
          </div>

          <div className="flex items-center gap-4 border-l-4 border-red-500 bg-white dark:bg-slate-800 p-4 rounded-r-lg shadow-sm transition-colors">
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-lg transition-colors">
              <XCircle size={32} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.ocupadas}</p>
              <p className="text-xs text-slate-400 font-medium uppercase">Ocupadas</p>
            </div>
          </div>

          <div className="flex items-center gap-4 border-l-4 border-cyan-500 bg-white dark:bg-slate-800 p-4 rounded-r-lg shadow-sm transition-colors">
            <div className="p-3 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-500 dark:text-cyan-400 rounded-lg transition-colors">
              <Percent size={32} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.ocupacion}</p>
              <p className="text-xs text-slate-400 font-medium uppercase">Ocupación</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 transition-colors">Bloque</label>
            <select className="w-full border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
              <option>Todos</option>
              <option>BLOQUE A</option>
              <option>BLOQUE B</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 transition-colors">Nivel</label>
            <select className="w-full border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
              <option>Todos</option>
              <option>PB</option>
              <option>Piso 1</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 transition-colors">Tipo de Habitación</label>
            <select className="w-full border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
              <option>Todas</option>
              <option>Cuarto Pequeño</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 transition-colors">Disponibilidad</label>
            <select className="w-full border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
              <option>Todas</option>
              <option>Disponible</option>
              <option>Ocupada</option>
            </select>
          </div>
          <div>
            <button className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <Filter size={16} />
              Filtrar
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">Cargando habitaciones...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {habitaciones.map((hab) => {
            const activeContract = activeContractByRoom.get(Number(hab.id));
            const inquilino = activeContract ? getContratoInquilino(activeContract) : undefined;

            return (
              <div
                key={hab.id}
                onClick={() => handleCardClick(hab)}
                className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border ${hab.estado === 'DISPONIBLE' ? 'border-emerald-500' : 'border-red-500'} border-l-4 p-5 relative flex flex-col transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer`}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-4xl font-black text-blue-600 dark:text-blue-400 leading-none">{hab.numero}</h3>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors ${hab.estado === 'DISPONIBLE' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                    {hab.estado}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold px-3 py-1 rounded-md transition-colors">
                    {hab.bloque || '-'}
                  </span>
                  <span className="text-slate-300 dark:text-slate-500 font-semibold text-xs">
                    {hab.nivel}
                  </span>
                </div>

                <div className="mb-4 flex-grow">
                  <p className="text-slate-700 dark:text-slate-200 font-bold text-sm mb-1">{hab.tipo_habitacion}</p>
                  <p className="text-slate-400 dark:text-slate-400 text-xs line-clamp-3">{hab.descripcion}</p>
                </div>

                {activeContract && inquilino && (
                  <div className="mb-4 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                      <UserRound size={14} className="text-indigo-500" />
                      <span className="text-xs font-bold truncate">{getOccupantName(activeContract)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                      {inquilino.telefono && (
                        <span className="inline-flex items-center gap-1">
                          <Phone size={11} />
                          {inquilino.telefono}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <DollarSign size={11} />
                        Bs. {(activeContract.monto_mensual || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center mt-auto gap-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
                    {activeContract?.tipo_contrato || 'Sin contrato'}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors">
                    <Lock size={12} />
                    {hab.tipo_bano}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && selectedHabitacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Editar Habitación {selectedHabitacion.numero}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form id="editRoomForm" onSubmit={handleSave} className="space-y-6">
                {formError && (
                  <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Número</label>
                    <input
                      type="text"
                      value={selectedHabitacion.numero}
                      onChange={(e) => setSelectedHabitacion({ ...selectedHabitacion, numero: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Bloque</label>
                    <input
                      type="text"
                      value={selectedHabitacion.bloque}
                      onChange={(e) => setSelectedHabitacion({ ...selectedHabitacion, bloque: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nivel</label>
                    <input
                      type="text"
                      value={selectedHabitacion.nivel}
                      onChange={(e) => setSelectedHabitacion({ ...selectedHabitacion, nivel: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tipo de Baño</label>
                    <input
                      type="text"
                      value={selectedHabitacion.tipo_bano}
                      onChange={(e) => setSelectedHabitacion({ ...selectedHabitacion, tipo_bano: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Inquilino asignado</label>
                  <select
                    value={selectedInquilinoId}
                    onChange={(e) => setSelectedInquilinoId(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  >
                    <option value="">Sin ocupante / disponible</option>
                    {getAssignableInquilinos().map(inquilino => (
                      <option key={inquilino.id} value={inquilino.id}>
                        {inquilino.nombre}{inquilino.documento ? ` - CI ${inquilino.documento}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    Al elegir un inquilino se crea o actualiza el contrato activo de esta habitación. Si lo dejas vacío, se marca disponible.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tipo de Habitación</label>
                  <input
                    type="text"
                    value={selectedHabitacion.tipo_habitacion}
                    onChange={(e) => setSelectedHabitacion({ ...selectedHabitacion, tipo_habitacion: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Descripción</label>
                  <textarea
                    value={selectedHabitacion.descripcion}
                    onChange={(e) => setSelectedHabitacion({ ...selectedHabitacion, descripcion: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors min-h-[100px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Precio Alquiler (Bs)</label>
                    <input
                      type="number"
                      value={selectedHabitacion.precio_alquiler || 0}
                      onChange={(e) => setSelectedHabitacion({ ...selectedHabitacion, precio_alquiler: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Precio Anticrético (Bs)</label>
                    <input
                      type="number"
                      value={selectedHabitacion.precio_anticretico || 0}
                      onChange={(e) => setSelectedHabitacion({ ...selectedHabitacion, precio_anticretico: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Precio Internet (Bs)</label>
                    <input
                      type="number"
                      value={selectedHabitacion.precio_internet || 0}
                      onChange={(e) => setSelectedHabitacion({ ...selectedHabitacion, precio_internet: parseFloat(e.target.value) || 0 })}
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
                form="editRoomForm"
                disabled={saving}
                className="px-6 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
