import React, { useState, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

// Editable Cell (Same logic, tighter styling)
const EditableCell = ({ rowId, colHeader, initialValue, sheetName, onSave }: any) => {
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => { setValue(initialValue); }, [initialValue]);

  const handleBlur = () => {
    setIsEditing(false);
    if (value !== initialValue) onSave(rowId, colHeader, value, sheetName);
  };

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter') e.target.blur();
  };

  if (isEditing) {
    return (
      <input 
        autoFocus 
        value={value} 
        onChange={(e) => setValue(e.target.value)} 
        onBlur={handleBlur} 
        onKeyDown={handleKeyDown} 
        className="w-full px-2 py-1 text-sm border border-blue-400 rounded outline-none bg-blue-50" 
      />
    );
  }
  return (
    <div 
      onClick={() => setIsEditing(true)} 
      className="cursor-pointer hover:bg-slate-100 px-2 py-1 rounded text-sm truncate min-h-7 flex items-center" 
      title={value}
    >
      {value}
    </div>
  );
};

// Main Table
export default function DataTable({ data, sheetName, onSave, onSort, sortConfig }: any) {
  if (!data || data.length === 0) return <div className="p-20 text-center text-slate-400">No data found.</div>;
  
  const headers = Object.keys(data[0]);

  return (
    <div className="flex-1 overflow-auto bg-white relative">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
          <tr>
            {headers.map((h) => (
              <th 
                key={h} 
                onClick={() => onSort(h)}
                className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-blue-600 transition-colors select-none group border-b border-slate-200"
              >
                <div className="flex items-center gap-1">
                  {h.replace(/_/g, ' ')}
                  {sortConfig?.key === h ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  ) : (
                    <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-30" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row: any) => (
            <tr key={row.row_id} className="hover:bg-blue-50/50 transition-colors group">
              {headers.map((col) => (
                <td key={col} className="px-3 py-2 whitespace-nowrap border-r border-transparent group-hover:border-slate-200/50 last:border-0">
                  {['row_id', 'last_updated_at'].includes(col) ? (
                    <span className="text-slate-400 text-xs select-none font-mono">{row[col]}</span>
                  ) : (
                    <EditableCell rowId={row.row_id} colHeader={col} initialValue={row[col]} sheetName={sheetName} onSave={onSave} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}