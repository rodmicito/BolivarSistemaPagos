import React, { useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';

interface Contrato {
  id: number;
  habitacion: { numero: string };
  inquilino_nombre: string;
  tipo_contrato: string;
  monto_mensual: number;
  estado: string;
  fecha_inicio: string;
}

export default function Contratos() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8080/api/contratos')
      .then(res => res.json())
      .then(data => {
        setContratos(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Contratos</h2>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} />
          Nuevo Contrato
        </button>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-500">
              <th className="p-4">Habitación</th>
              <th className="p-4">Inquilino</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Monto Mensual</th>
              <th className="p-4">Inicio</th>
              <th className="p-4">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={6} className="p-4 text-center text-slate-500">Cargando...</td></tr>
            ) : contratos.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-medium text-slate-800">{c.habitacion?.numero}</td>
                <td className="p-4 text-slate-600 flex items-center gap-2">
                  <FileText size={16} className="text-blue-500" />
                  {c.inquilino_nombre}
                </td>
                <td className="p-4 text-slate-600">{c.tipo_contrato}</td>
                <td className="p-4 text-slate-600">Bs. {c.monto_mensual}</td>
                <td className="p-4 text-slate-600">{new Date(c.fecha_inicio).toLocaleDateString()}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                    {c.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
