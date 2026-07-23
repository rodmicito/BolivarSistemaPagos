import { ReactNode, useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, FileText, CreditCard, LogOut, Activity, Sun, Moon, Menu, ChevronLeft, ChevronRight, X, Cpu } from 'lucide-react';

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

  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile drawer open/close
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex transition-colors duration-200 relative overflow-hidden">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        w-64 ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}
        bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/80 flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out
      `}>
        {/* Sidebar Header / Brand */}
        <div className="p-6 pb-2 flex items-center justify-between text-sm font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase relative">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 dark:bg-indigo-500 rounded-lg flex items-center justify-center text-white font-extrabold text-xs shadow-md flex-shrink-0">
              B
            </div>
            <span className={`transition-opacity duration-300 text-slate-850 dark:text-slate-200 ${isSidebarCollapsed ? 'md:opacity-0 md:w-0 overflow-hidden' : 'opacity-100'}`}>
              Bolívar Host
            </span>
          </div>
          
          {/* Mobile Close Button inside sidebar */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 mt-4 px-3">
          <ul className="space-y-1.5">
            <li>
              <NavLink 
                to="/" 
                className={({isActive}) => `flex items-center ${isSidebarCollapsed ? 'md:justify-center md:px-0' : 'gap-4 px-4'} py-3 rounded-lg transition-all duration-255 font-medium ${isActive ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'}`}
                onClick={() => setIsSidebarOpen(false)}
              >
                <Activity size={22} className="flex-shrink-0" />
                <span className={`text-[15px] truncate transition-all duration-200 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>Dashboard</span>
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/habitaciones" 
                className={({isActive}) => `flex items-center ${isSidebarCollapsed ? 'md:justify-center md:px-0' : 'gap-4 px-4'} py-3 rounded-lg transition-all duration-255 font-medium ${isActive ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-955/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'}`}
                onClick={() => setIsSidebarOpen(false)}
              >
                <Home size={22} className="flex-shrink-0" />
                <span className={`text-[15px] truncate transition-all duration-200 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>Habitaciones</span>
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/inquilinos" 
                className={({isActive}) => `flex items-center ${isSidebarCollapsed ? 'md:justify-center md:px-0' : 'gap-4 px-4'} py-3 rounded-lg transition-all duration-255 font-medium ${isActive ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-955/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'}`}
                onClick={() => setIsSidebarOpen(false)}
              >
                <Users size={22} className="flex-shrink-0" />
                <span className={`text-[15px] truncate transition-all duration-200 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>Inquilinos</span>
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/contratos" 
                className={({isActive}) => `flex items-center ${isSidebarCollapsed ? 'md:justify-center md:px-0' : 'gap-4 px-4'} py-3 rounded-lg transition-all duration-255 font-medium ${isActive ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-955/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'}`}
                onClick={() => setIsSidebarOpen(false)}
              >
                <FileText size={22} className="flex-shrink-0" />
                <span className={`text-[15px] truncate transition-all duration-200 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>Contratos</span>
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/pagos" 
                className={({isActive}) => `flex items-center ${isSidebarCollapsed ? 'md:justify-center md:px-0' : 'gap-4 px-4'} py-3 rounded-lg transition-all duration-255 font-medium ${isActive ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-955/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'}`}
                onClick={() => setIsSidebarOpen(false)}
              >
                <CreditCard size={22} className="flex-shrink-0" />
                <span className={`text-[15px] truncate transition-all duration-200 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>Pagos</span>
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/automatizacion" 
                className={({isActive}) => `flex items-center ${isSidebarCollapsed ? 'md:justify-center md:px-0' : 'gap-4 px-4'} py-3 rounded-lg transition-all duration-255 font-medium ${isActive ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'}`}
                onClick={() => setIsSidebarOpen(false)}
              >
                <Cpu size={22} className="flex-shrink-0" />
                <span className={`text-[15px] truncate transition-all duration-200 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>Automatización</span>
              </NavLink>
            </li>
            <li className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80">
              <button className={`flex items-center ${isSidebarCollapsed ? 'md:justify-center md:px-0' : 'gap-4 px-4'} py-3 w-full text-left rounded-lg transition-all duration-200 font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white`}>
                <LogOut size={22} className="flex-shrink-0" />
                <span className={`text-[15px] truncate transition-all duration-200 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>Cerrar sesión</span>
              </button>
            </li>
          </ul>
        </nav>

        {/* Desktop Collapse Toggle Button */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          className="hidden md:flex absolute bottom-6 right-0 left-0 justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
          title={isSidebarCollapsed ? "Expandir panel" : "Contraer panel"}
        >
          {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-indigo-600 dark:bg-slate-950 border-b border-indigo-700 dark:border-slate-850 text-white h-16 flex items-center px-4 md:px-8 justify-between flex-shrink-0 transition-colors duration-200">
          <div className="flex items-center gap-3 font-bold tracking-wide">
            {/* Hamburger button for mobile */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 rounded-lg hover:bg-white/10 dark:hover:bg-slate-900 transition-colors md:hidden text-white"
              aria-label="Open Menu"
            >
              <Menu size={22} />
            </button>
            
            <div className="w-5 h-5 border-2 border-white/90 rounded-sm flex items-center justify-center md:hidden">
              <div className="w-2 h-2 bg-white/90 rounded-sm"></div>
            </div>
            <span className="md:hidden">BOLÍVAR HOST</span>
          </div>
          
          <div className="flex items-center gap-4 md:gap-6">
            <button 
              onClick={toggleDarkMode} 
              className="p-2 rounded-full bg-white/10 dark:bg-slate-900 hover:bg-white/20 dark:hover:bg-slate-800 transition-colors text-white"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="flex items-center gap-3">
              <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Profile" className="w-8 h-8 rounded-full border-2 border-indigo-400 dark:border-indigo-600" />
              <span className="text-sm font-medium hidden sm:inline-block">Reynaldo</span>
            </div>
          </div>
        </header>

        {/* Page Content Container */}
        <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
          {children}
        </div>
      </main>
    </div>
  );
}
