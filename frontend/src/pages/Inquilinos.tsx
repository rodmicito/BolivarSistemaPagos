import { useEffect, useMemo, useState } from 'react';
import { Home, Mail, Phone, Plus, Users, X } from 'lucide-react';

interface Inquilino {
  id?: number;
  nombre: string;
  documento: string;
  telefono: string;
  email: string;
  observaciones: string;
  activo: boolean;
}

interface Habitacion {
  id: number;
  numero: string;
  bloque?: string;
  precio_alquiler?: number;
}

interface Contrato {
  id?: number;
  habitacion_id?: number;
  habitacion?: Habitacion;
  inquilino_id?: number;
  inquilino?: Inquilino;
  inquilino_nombre?: string;
  tipo_contrato: string;
  monto_mensual: number;
  monto_garantia: number;
  estado: string;
}

interface InquilinoFormState extends Inquilino {
  habitacion_id?: number;
}

const emptyInquilino: InquilinoFormState = {
  nombre: '',
  documento: '',
  telefono: '',
  email: '',
  observaciones: '',
  activo: true,
  habitacion_id: undefined,
};

export default function Inquilinos() {
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquilino, setSelectedInquilino] = useState<InquilinoFormState | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contratosActivos = useMemo(
    () => contratos.filter((contrato) => contrato.estado === 'Activo'),
    [contratos]
  );

  const habitacionById = useMemo(() => {
    const map = new Map<number, Habitacion>();
    habitaciones.forEach((habitacion) => {
      map.set(habitacion.id, habitacion);
    });
    return map;
  }, [habitaciones]);

  const activeContractByTenantId = useMemo(() => {
    const map = new Map<number, Contrato>();
    contratosActivos.forEach((contrato) => {
      const inquilinoID = contrato.inquilino?.id || contrato.inquilino_id;
      if (inquilinoID) {
        map.set(Number(inquilinoID), contrato);
      }
    });
    return map;
  }, [contratosActivos]);

  const loadData = () => {
    setLoading(true);
    fetch('/api/inquilinos')
      .then((r) => {
        if (!r.ok) throw new Error('No se pudo cargar inquilinos');
        return r.json();
      })
      .then(async (inquilinosData) => {
        setInquilinos(inquilinosData || []);
        setError(null);

        const [habitacionesResult, contratosResult] = await Promise.allSettled([
          fetch('/api/habitaciones').then((r) => {
            if (!r.ok) throw new Error('No se pudo cargar habitaciones');
            return r.json();
          }),
          fetch('/api/contratos').then((r) => {
            if (!r.ok) throw new Error('No se pudo cargar contratos');
            return r.json();
          }),
        ]);

        if (habitacionesResult.status === 'fulfilled') {
          setHabitaciones(habitacionesResult.value || []);
        } else {
          console.error(habitacionesResult.reason);
          setHabitaciones([]);
        }

        if (contratosResult.status === 'fulfilled') {
          setContratos(contratosResult.value || []);
        } else {
          console.error(contratosResult.reason);
          setContratos([]);
        }
      })
      .catch((err) => {
        console.error(err);
        setError('No se pudo cargar el directorio de inquilinos');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const getActiveRoomIdForTenant = (inquilinoId?: number) => {
    if (!inquilinoId) return undefined;
    const contrato = activeContractByTenantId.get(Number(inquilinoId));
    return contrato?.habitacion_id ? Number(contrato.habitacion_id) : undefined;
  };

  const getRoomLabel = (habitacionId?: number) => {
    if (!habitacionId) return 'Sin cuarto asignado';
    const habitacion = habitacionById.get(Number(habitacionId));
    if (!habitacion) return 'Cuarto no encontrado';
    return habitacion.bloque ? `Cuarto ${habitacion.numero} - ${habitacion.bloque}` : `Cuarto ${habitacion.numero}`;
  };

  const getAssignableRooms = (inquilinoId?: number) => {
    const occupiedRoomIds = new Set(
      contratosActivos
        .filter((contrato) => {
          const currentTenantId = contrato.inquilino?.id || contrato.inquilino_id;
          return Number(currentTenantId) !== Number(inquilinoId);
        })
        .map((contrato) => contrato.habitacion_id)
        .filter(Boolean)
        .map((habitacionId) => Number(habitacionId))
    );

    return habitaciones.filter((habitacion) => !occupiedRoomIds.has(Number(habitacion.id)));
  };

  const handleCardClick = (inquilino: Inquilino) => {
    setIsCreating(false);
    setSelectedInquilino({
      ...inquilino,
      habitacion_id: getActiveRoomIdForTenant(inquilino.id),
    });
    setIsModalOpen(true);
    setError(null);
  };

  const handleCreateClick = () => {
    setIsCreating(true);
    setSelectedInquilino(emptyInquilino);
    setIsModalOpen(true);
    setError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedInquilino(null);
    setError(null);
    setSaving(false);
  };

  const saveTenant = async (payload: InquilinoFormState) => {
    const url = isCreating ? '/api/inquilinos' : `/api/inquilinos/${payload.id}`;
    const method = isCreating ? 'POST' : 'PUT';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        habitacion_id: undefined,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo guardar el inquilino');
    }

    return response.json();
  };

  const syncTenantRoom = async (savedInquilino: Inquilino, nextRoomId?: number) => {
    const existingContract = activeContractByTenantId.get(Number(savedInquilino.id));
    const currentRoomId = existingContract?.habitacion_id ? Number(existingContract.habitacion_id) : undefined;

    if (currentRoomId === nextRoomId) {
      return;
    }

    if (!nextRoomId) {
      if (!existingContract?.id) return;

      const response = await fetch(`/api/contratos/${existingContract.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...existingContract,
          inquilino: savedInquilino,
          inquilino_nombre: savedInquilino.nombre,
          estado: 'Inactivo',
          tipo_contrato: existingContract.tipo_contrato || 'Alquiler',
          monto_mensual: existingContract.monto_mensual || 0,
          monto_garantia: existingContract.monto_garantia || 0,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo liberar el cuarto del inquilino');
      }

      return;
    }

    const habitacion = habitacionById.get(Number(nextRoomId));
    if (!habitacion) {
      throw new Error('Selecciona un cuarto válido');
    }

    const payload = {
      ...(existingContract || {}),
      habitacion_id: nextRoomId,
      inquilino_id: savedInquilino.id,
      inquilino: savedInquilino,
      inquilino_nombre: savedInquilino.nombre,
      estado: 'Activo',
      tipo_contrato: existingContract?.tipo_contrato || 'Alquiler',
      monto_mensual: existingContract?.monto_mensual || habitacion.precio_alquiler || 0,
      monto_garantia: existingContract?.monto_garantia || 0,
    };

    const response = await fetch(existingContract?.id ? `/api/contratos/${existingContract.id}` : '/api/contratos', {
      method: existingContract?.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo asignar el cuarto al inquilino');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquilino) return;

    const payload: InquilinoFormState = {
      ...selectedInquilino,
      nombre: selectedInquilino.nombre.trim(),
      documento: selectedInquilino.documento.trim(),
      telefono: selectedInquilino.telefono.trim(),
      email: selectedInquilino.email.trim(),
      observaciones: selectedInquilino.observaciones.trim(),
      habitacion_id: selectedInquilino.habitacion_id ? Number(selectedInquilino.habitacion_id) : undefined,
    };

    if (!payload.nombre) {
      setError('El nombre del inquilino es obligatorio');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const savedInquilino = await saveTenant(payload);
      await syncTenantRoom(savedInquilino, payload.habitacion_id);

      setInquilinos((current) => {
        if (isCreating) {
          return [...current, savedInquilino].sort((a, b) => a.nombre.localeCompare(b.nombre));
        }
        return current
          .map((inquilino) => (inquilino.id === savedInquilino.id ? savedInquilino : inquilino))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
      });

      closeModal();
      loadData();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'No se pudo guardar el inquilino');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 transition-colors">Directorio de Inquilinos</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Datos personales guardados una sola vez, con su cuarto activo visible desde la ficha.</p>
        </div>
        <button
          onClick={handleCreateClick}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-sm w-full sm:w-auto"
        >
          <Plus size={18} />
          Nuevo Inquilino
        </button>
      </div>

      {error && !isModalOpen && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-slate-500 dark:text-slate-400">Cargando...</p>
        ) : inquilinos.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">No hay inquilinos registrados.</p>
        ) : inquilinos.map((inquilino) => {
          const activeRoomId = getActiveRoomIdForTenant(inquilino.id);

          return (
            <button
              key={inquilino.id}
              onClick={() => handleCardClick(inquilino)}
              className="text-left bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-4 hover:-translate-y-1 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 transition-colors">
                <Users size={24} />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{inquilino.nombre}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">CI: <span className="font-medium text-slate-700 dark:text-slate-200">{inquilino.documento || 'Sin registro'}</span></p>
                <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  {inquilino.telefono && <p className="flex items-center gap-1.5"><Phone size={13} /> {inquilino.telefono}</p>}
                  {inquilino.email && <p className="flex items-center gap-1.5 truncate"><Mail size={13} /> {inquilino.email}</p>}
                  <p className="flex items-center gap-1.5">
                    <Home size={13} />
                    {getRoomLabel(activeRoomId)}
                  </p>
                </div>
                <span className={`inline-block mt-3 px-2 py-1 rounded-full text-xs font-medium transition-colors ${inquilino.activo ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                  {inquilino.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

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
              <form id="editInquilinoForm" onSubmit={handleSave} className="space-y-5">
                {error && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nombre Completo</label>
                  <input
                    type="text"
                    value={selectedInquilino.nombre}
                    onChange={(e) => setSelectedInquilino({ ...selectedInquilino, nombre: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Documento / CI</label>
                    <input
                      type="text"
                      value={selectedInquilino.documento}
                      onChange={(e) => setSelectedInquilino({ ...selectedInquilino, documento: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Teléfono</label>
                    <input
                      type="text"
                      value={selectedInquilino.telefono}
                      onChange={(e) => setSelectedInquilino({ ...selectedInquilino, telefono: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={selectedInquilino.email}
                    onChange={(e) => setSelectedInquilino({ ...selectedInquilino, email: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Cuarto asignado</label>
                  <select
                    value={selectedInquilino.habitacion_id || ''}
                    onChange={(e) => setSelectedInquilino({
                      ...selectedInquilino,
                      habitacion_id: e.target.value ? Number(e.target.value) : undefined,
                    })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  >
                    <option value="">Sin cuarto asignado</option>
                    {getAssignableRooms(selectedInquilino.id).map((habitacion) => (
                      <option key={habitacion.id} value={habitacion.id}>
                        {getRoomLabel(habitacion.id)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    El cuarto se guarda usando el contrato activo del inquilino.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Observaciones</label>
                  <textarea
                    value={selectedInquilino.observaciones}
                    onChange={(e) => setSelectedInquilino({ ...selectedInquilino, observaciones: e.target.value })}
                    className="w-full min-h-[90px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  />
                </div>

                <label className="flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/70 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Inquilino activo</span>
                  <input
                    type="checkbox"
                    checked={selectedInquilino.activo}
                    onChange={(e) => setSelectedInquilino({ ...selectedInquilino, activo: e.target.checked })}
                    className="h-4 w-4 accent-indigo-600"
                  />
                </label>
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
                disabled={saving}
                className="px-6 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {saving ? 'Guardando...' : isCreating ? 'Registrar Inquilino' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
