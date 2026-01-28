"use client";
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'; // [FIX] Import keepPreviousData
import toast, { Toaster } from 'react-hot-toast';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

import Sidebar from '@/components/Sidebar';
import DashboardView from '@/components/DashboardView';

// --- TYPES (Fixes TypeScript Errors) ---
interface Table {
  raw: string;
  display: string;
}

interface ApiResponse {
  data: any[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Simple Fetcher Function
const fetcher = async (url: string) => (await axios.get(url)).data;

export default function Dashboard() {
  const queryClient = useQueryClient();
  
  // --- STATE ---
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'history'>('table');
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'row_id', direction: 'asc' });

  // --- QUERY 1: Fetch List of Tables ---
  const { data: tables = [] } = useQuery<Table[]>({
    queryKey: ['tables'],
    queryFn: () => fetcher('http://localhost:3000/api/tables'),
  });

  // [FIX] Replaces 'onSuccess': Effect to Auto-select first table
  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0].display);
    }
  }, [tables, selectedTable]);

  // --- QUERY 2: Fetch Sheet Data ---
  const { data: sheetData, isLoading, isError, isFetching } = useQuery<any>({ // Type as any for flexibility between history/table
    queryKey: ['sheet', selectedTable, view, page, sortConfig],
    queryFn: () => {
      if (!selectedTable) return null;
      if (view === 'history') return fetcher(`http://localhost:3000/api/history/${selectedTable}`);
      
      const params = `?page=${page}&limit=50&sortBy=${sortConfig.key}&order=${sortConfig.direction}`;
      return fetcher(`http://localhost:3000/api/sheets/${selectedTable}${params}`);
    },
    enabled: !!selectedTable,
    placeholderData: keepPreviousData, // [FIX] v5 Syntax for "Keep Previous Data"
    refetchInterval: 5000,
  });

  // --- MUTATION: Handle Saves ---
  const saveMutation = useMutation({
    mutationFn: (payload: any) => axios.post('http://localhost:3000/api/admin-update', payload),
    onSuccess: () => {
      toast.success("Saved!");
      // [FIX] v5 Syntax: Pass object with queryKey
      queryClient.invalidateQueries({ queryKey: ['sheet', selectedTable] });
    },
    onError: () => toast.error("Save Failed")
  });

  const handleSave = (rowId: number, colHeader: string, value: string, sheetName: string) => {
    saveMutation.mutate({ sheet_name: sheetName, row_id: rowId, col_header: colHeader, value });
  };

  const handleSort = (key: string) => {
    setSortConfig(curr => ({ key, direction: curr.key === key && curr.direction === 'asc' ? 'desc' : 'asc' }));
  };

  // Helper for Pagination Logic (Safe Access)
  const totalPages = sheetData?.meta?.totalPages || 1;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Toaster position="bottom-right" />
      <Sidebar 
        tables={tables} 
        selectedTable={selectedTable} 
        onSelect={(t) => { setSelectedTable(t); setPage(1); }} 
        activeView={view} 
        onViewChange={setView} 
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800">{selectedTable || "Dashboard"}</h2>
            {isFetching && !isLoading && <span className="text-xs text-blue-500 animate-pulse font-medium">Updating...</span>}
          </div>
          {/* [FIX] v5 Syntax for invalidateQueries */}
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['sheet'] })} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-blue-600 transition-all">
            <RefreshCw size={18} className={isFetching ? "animate-spin text-blue-500" : ""} />
          </button>
        </div>

        {/* Main Content Area */}
        <DashboardView 
          view={view}
          isLoading={isLoading}
          isError={isError}
          data={sheetData}
          sheetName={selectedTable}
          onSave={handleSave}
          onSort={handleSort}
          sortConfig={sortConfig}
        />

        {/* Footer (Pagination Controls) */}
        {view === 'table' && !isLoading && !isError && (
          <div className="h-14 bg-white border-t border-slate-200 flex items-center justify-between px-6">
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-slate-50 flex items-center gap-1 text-sm text-slate-600">
                <ChevronLeft size={16} /> Previous
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-slate-50 flex items-center gap-1 text-sm text-slate-600">
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
