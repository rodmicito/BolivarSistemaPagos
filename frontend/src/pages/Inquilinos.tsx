import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';

interface Contrato {
  id: number;
  habitacion: { numero: string };
  inquilino_nombre: string;
  estado: string;
}

export default function Inquilinos() {
  const [inquilinos, setInquilinos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);

  // In this phase, we treat the 'Contrato' data as the source of truth for 'Inquilinos'
  useEffect(() => {
    fetch('http://localhost:8080/api/contratos')
      .then(res => res.json())
      .then(data => {
        setInquilinos(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Directorio de Inquilinos</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-slate-500">Cargando...</p>
        ) : inquilinos.map(i => (
          <div key={i.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Users size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{i.inquilino_nombre}</h3>
              <p className="text-sm text-slate-500">Habitación: <span className="font-medium text-slate-700">{i.habitacion?.numero}</span></p>
              <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${i.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                {i.estado}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
