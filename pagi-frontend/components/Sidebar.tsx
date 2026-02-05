
import React, { useState, useEffect } from 'react';
import { MessageSquare, Layers, Activity, Settings2, Sliders } from 'lucide-react';
import { View } from '../types';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  status: 'active' | 'thinking';
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, status }) => {
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    const updateLogo = () => {
      const saved = localStorage.getItem('phoenix_config');
      if (saved) {
        try {
          const config = JSON.parse(saved);
          setLogoUrl(config.logoUrl || '');
        } catch (e) {}
      }
    };
    updateLogo();
    window.addEventListener('storage', updateLogo);
    return () => window.removeEventListener('storage', updateLogo);
  }, []);

  const navItems = [
    { id: View.CHAT, icon: MessageSquare, label: 'Chat' },
    { id: View.PROJECTS, icon: Layers, label: 'Projects' },
    { id: View.REGISTRY, icon: Activity, label: 'Registry' },
  ];

  return (
    <aside className="w-16 flex flex-col items-center py-8 border-r border-slate-200/50 bg-white/50 backdrop-blur-md z-20 transition-colors dark:border-zinc-800 dark:bg-zinc-950/50">
      <div className="mb-12">
        {logoUrl ? (
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-slate-200/50 dark:border-zinc-800">
            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className={`w-10 h-10 rounded-xl overflow-hidden border border-slate-200/50 dark:border-zinc-800 flex items-center justify-center bg-white/50 dark:bg-zinc-900/50 transition-all duration-500 ${status === 'thinking' ? 'animate-pulse ring-2 ring-emerald-400/30' : ''}`}>
            <img src="/sola-logo.svg" alt="Sola Logo" className="h-8 w-8 object-contain" />
          </div>
        )}
      </div>

      <nav className="flex-1 flex flex-col gap-6">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`p-3 rounded-2xl transition-all duration-300 relative group ${
              currentView === item.id 
                ? 'bg-emerald-50 text-emerald-600 shadow-sm dark:bg-emerald-500/10 dark:text-emerald-400' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-900'
            }`}
            title={item.label}
          >
            <item.icon size={20} strokeWidth={currentView === item.id ? 2.5 : 2} />
            <span className="absolute left-16 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {item.label}
            </span>
            {currentView === item.id && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-emerald-600 dark:bg-emerald-400 rounded-l-full" />
            )}
          </button>
        ))}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-6">
        <button
          onClick={() => onViewChange(View.SETTINGS)}
          className={`p-3 rounded-2xl transition-all duration-300 relative group ${
            currentView === View.SETTINGS 
              ? 'bg-zinc-100 text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white' 
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-900'
          }`}
          title="Settings"
        >
          <Sliders size={20} strokeWidth={currentView === View.SETTINGS ? 2.5 : 2} />
          <span className="absolute left-16 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 uppercase tracking-tighter">
            System Config
          </span>
        </button>

        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className={`w-2.5 h-2.5 rounded-full ${status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.5)]'}`} />
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
