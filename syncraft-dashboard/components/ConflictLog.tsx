import React from 'react';
import { format } from 'date-fns';

export default function ConflictLog({ history }: { history: any[] }) {
  if (!history || history.length === 0) return <div className="p-10 text-center text-slate-400">No history found.</div>;

  return (
    <div className="overflow-auto h-full p-8">
      <h3 className="text-lg font-bold text-slate-800 mb-6">Audit & Conflict Log</h3>
      <div className="space-y-4 max-w-4xl">
        {history.map((log) => (
          <div key={log.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-sm">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
               <div className="flex items-center gap-2">
                 <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                   {(log.updated_by || "A")[0].toUpperCase()}
                 </div>
                 <span className="font-medium text-slate-700">{log.updated_by}</span>
                 <span className="text-slate-400">• Row {log.row_id}</span>
               </div>
               <span className="text-xs text-slate-400 font-mono">
                 {format(new Date(log.timestamp), 'MMM d, h:mm:ss a')}
               </span>
            </div>
            
            {/* Diff View */}
            <div className="grid grid-cols-2 gap-6">
              <DiffBox title="Previous Value" data={log.prev_value} type="old" />
              <DiffBox title="New Value" data={log.new_value} type="new" compareData={log.prev_value} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper Component for Diffing
function DiffBox({ title, data, type, compareData }: any) {
  if (!data) return <div className="text-slate-300 italic">No Data</div>;

  return (
    <div className={`p-3 rounded-lg border ${type === 'old' ? 'bg-red-50/50 border-red-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
      <p className={`text-xs font-bold uppercase mb-2 ${type === 'old' ? 'text-red-500' : 'text-emerald-600'}`}>
        {title}
      </p>
      <div className="space-y-1">
        {Object.entries(data).map(([key, val]: any) => {
          // Skip internal fields
          if (['last_updated_at', 'row_id'].includes(key)) return null; 

          // Convert both to String to avoid "5" !== 5 false positives
          // Also check if compareData exists
          const oldVal = compareData ? String(compareData[key]) : '';
          const newVal = String(val);
          
          const isChanged = compareData && oldVal !== newVal;
          const highlight = isChanged && type === 'new';

          return (
            <div key={key} className={`flex justify-between text-xs py-0.5 px-1 rounded ${highlight ? 'bg-yellow-200 font-bold text-slate-900' : 'text-slate-600'}`}>
              <span className="opacity-70">{key}:</span>
              <span>{String(val)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}