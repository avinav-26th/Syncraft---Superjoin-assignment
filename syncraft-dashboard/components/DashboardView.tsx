import React from 'react';
import DataTable from './DataTable';
import ConflictLog from './ConflictLog';
import { TableSkeleton } from './Skeleton';

interface DashboardViewProps {
  view: 'table' | 'history';
  isLoading: boolean;
  isError: boolean;
  data: any;
  sheetName: string | null;
  onSave: (rowId: number, colHeader: string, value: string, sheetName: string) => void;
  onSort: (key: string) => void;
  sortConfig: any;
}

export default function DashboardView({ 
  view, isLoading, isError, data, sheetName, onSave, onSort, sortConfig 
}: DashboardViewProps) {

  if (isError) return <div className="p-10 text-center text-red-500">Failed to load data.</div>;

  // 1. Loading State
  if (isLoading) return <TableSkeleton />;

  // 2. History View (SAFE GUARDED)
  if (view === 'history') {
    // CRITICAL FIX: We must check if 'data' is actually an Array. 
    // If it's still the old Table Object (from keepPreviousData), we treat it as loading/empty.
    const historyData = Array.isArray(data) ? data : [];
    return <ConflictLog history={historyData} />;
  }

  // 3. Table View
  // If data is an Array (History data lingering), fallback to empty. 
  // Otherwise use data.data (Pagination Object)
  const tableRows = !Array.isArray(data) && data?.data ? data.data : [];

  if (tableRows.length === 0) {
     return <div className="p-20 text-center text-slate-400">No data found in {sheetName}.</div>;
  }
  
  return (
    <DataTable 
      data={tableRows} 
      sheetName={sheetName} 
      onSave={onSave} 
      onSort={onSort}
      sortConfig={sortConfig}
    />
  );
}