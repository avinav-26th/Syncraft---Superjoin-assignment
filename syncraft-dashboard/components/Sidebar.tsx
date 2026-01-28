import React from 'react';

interface SidebarProps {
  tables: { raw: string; display: string }[];
  selectedTable: string | null;
  onSelect: (table: string) => void;
  activeView: 'table' | 'history';
  onViewChange: (view: 'table' | 'history') => void;
}

export default function Sidebar({ tables, selectedTable, onSelect, activeView, onViewChange }: SidebarProps) {
  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-full">
      <div className="p-6 border-b border-slate-100">
        <h1 className="text-xl font-extrabold text-blue-900">Syncraft.</h1>
        <p className="text-xs text-slate-400 mt-1">Workspace Manager</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sheets</p>
        {tables.map((t) => (
          <button
            key={t.raw}
            onClick={() => onSelect(t.display)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedTable === t.display 
                ? 'bg-blue-50 text-blue-700' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.display}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100 space-y-2">
         {/* View Toggles */}
         <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => onViewChange('table')}
              className={`flex-1 py-1 text-xs font-semibold rounded-md ${activeView === 'table' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              Data
            </button>
            <button 
              onClick={() => onViewChange('history')}
              className={`flex-1 py-1 text-xs font-semibold rounded-md ${activeView === 'history' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              History
            </button>
         </div>

        <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-md border border-emerald-100">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          System Online
        </div>
      </div>
    </div>
  );
}