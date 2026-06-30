import React, { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, FileText, CreditCard, LogOut } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0">
        <div className="p-6">
          <h1 className="text-xl font-bold text-blue-400">Bolívar Host</h1>
          <p className="text-slate-400 text-sm">Sistema de Pagos</p>
        </div>
        <nav className="mt-6">
          <ul className="space-y-2 px-4">
            <li>
              <NavLink to="/" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                <Home size={20} />
                <span>Dashboard</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/pagos" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                <CreditCard size={20} />
                <span>Pagos</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/contratos" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                <FileText size={20} />
                <span>Contratos</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/inquilinos" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                <Users size={20} />
                <span>Inquilinos</span>
              </NavLink>
            </li>
          </ul>
        </nav>
        <div className="absolute bottom-0 w-64 p-4 border-t border-slate-800">
          <button className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white w-full transition-colors">
            <LogOut size={20} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center px-8 justify-between flex-shrink-0">
          <h2 className="text-xl font-semibold text-slate-800">Panel Principal</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600">Admin</span>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
              A
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
