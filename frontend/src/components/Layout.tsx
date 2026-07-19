import { ReactNode, useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, FileText, CreditCard, LogOut, Activity, Sun, Moon } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col flex-shrink-0 transition-colors duration-200">
        <div className="p-6 pb-2 text-sm font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase">
          Gestión
        </div>
        <nav className="flex-1 mt-4 px-4">
          <ul className="space-y-2">
            <li>
              <NavLink to="/" className={({isActive}) => `flex items-center gap-4 px-4 py-3 rounded-lg transition-colors font-medium ${isActive ? 'text-black dark:text-white bg-slate-50 dark:bg-slate-800' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}>
                <Activity size={22} />
                <span className="text-[15px]">Dashboard</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/habitaciones" className={({isActive}) => `flex items-center gap-4 px-4 py-3 rounded-lg transition-colors font-medium ${isActive ? 'text-black dark:text-white bg-slate-50 dark:bg-slate-800' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}>
                <Home size={22} />
                <span className="text-[15px]">Habitaciones</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/inquilinos" className={({isActive}) => `flex items-center gap-4 px-4 py-3 rounded-lg transition-colors font-medium ${isActive ? 'text-black dark:text-white bg-slate-50 dark:bg-slate-800' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}>
                <Users size={22} />
                <span className="text-[15px]">Inquilinos</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/contratos" className={({isActive}) => `flex items-center gap-4 px-4 py-3 rounded-lg transition-colors font-medium ${isActive ? 'text-black dark:text-white bg-slate-50 dark:bg-slate-800' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}>
                <FileText size={22} />
                <span className="text-[15px]">Contratos</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/pagos" className={({isActive}) => `flex items-center gap-4 px-4 py-3 rounded-lg transition-colors font-medium ${isActive ? 'text-black dark:text-white bg-slate-50 dark:bg-slate-800' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}>
                <CreditCard size={22} />
                <span className="text-[15px]">Pagos</span>
              </NavLink>
            </li>
            <li className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button className="flex items-center gap-4 px-4 py-3 w-full text-left rounded-lg transition-colors font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white">
                <LogOut size={22} />
                <span className="text-[15px]">Cerrar sesión</span>
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="bg-indigo-600 dark:bg-indigo-950 text-white h-16 flex items-center px-8 justify-between flex-shrink-0 transition-colors duration-200">
          <div className="flex items-center gap-2 font-bold tracking-wide">
            <div className="w-5 h-5 border-2 border-white/90 rounded-sm flex items-center justify-center">
              <div className="w-2 h-2 bg-white/90 rounded-sm"></div>
            </div>
            THINGSSEES
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={toggleDarkMode} 
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="flex items-center gap-3">
              <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Profile" className="w-8 h-8 rounded-full border-2 border-indigo-400 dark:border-indigo-600" />
              <span className="text-sm font-medium">Reynaldo</span>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8 bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
          {children}
        </div>
      </main>
    </div>
  );
}
