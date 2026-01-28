import React from 'react';
import { format } from 'date-fns';

export default function ConflictLog({ history }: { history: any[] }) {
  if (!history || history.length === 0) return <div className="p-10 text-center text-slate-400">No history found.</div>;

  return (
    <div className="overflow-auto h-full p-8">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Audit & Conflict Log</h3>
      <div className="space-y-4">
        {history.map((log) => (
          <div key={log.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-sm">
            <div className="flex justify-between text-slate-400 text-xs mb-2">
              <span>Row {log.row_id} • {log.updated_by}</span>
              <span>{format(new Date(log.timestamp), 'MMM d, h:mm:ss a')}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {/* The "Discarded" Data */}
              <div className="bg-red-50 p-3 rounded border border-red-100">
                <p className="text-xs font-bold text-red-600 uppercase mb-1">Previous (Discarded)</p>
                {log.prev_value ? (
                  <pre className="text-xs text-red-800 overflow-x-auto">
                    {JSON.stringify(log.prev_value, null, 2)}
                  </pre>
                ) : <span className="text-slate-400 italic">New Row Created</span>}
              </div>

              {/* The "New" Data */}
              <div className="bg-emerald-50 p-3 rounded border border-emerald-100">
                <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Current (Saved)</p>
                <pre className="text-xs text-emerald-800 overflow-x-auto">
                  {JSON.stringify(log.new_value, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}