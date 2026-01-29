"use client";
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useSession } from "next-auth/react";
import toast, { Toaster } from 'react-hot-toast';

import Sidebar from '@/components/Sidebar';
import DashboardView from '@/components/DashboardView';
import Header from '@/components/Header';
import Pagination from '@/components/Pagination';

const BASE_URL = 'https://syncraft-backend.onrender.com';
const fetcher = async (url: string) => (await axios.get(url)).data;

export default function Dashboard() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'history'>('table');
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'row_id', direction: 'asc' });

  // AUTOMATIC TABLE DISCOVERY - it runs every 5 seconds.
  const { data: tables = [] } = useQuery({
    queryKey: ['tables'],
    queryFn: () => fetcher(`${BASE_URL}/api/tables`),
    refetchInterval: 5000,
    refetchIntervalInBackground: true, // Keep scanning even if tab is hidden
  });

  useEffect(() => {
    if (tables.length > 0 && !selectedTable) setSelectedTable(tables[0].display);
  }, [tables, selectedTable]);

  const { data: sheetData, isLoading, isError, isFetching } = useQuery<any>({
    queryKey: ['sheet', selectedTable, view, page, sortConfig],
    queryFn: () => {
      if (!selectedTable) return null;
      if (view === 'history') return fetcher(`${BASE_URL}/api/history/${selectedTable}`);

      const params = `?page=${page}&limit=50&sortBy=${sortConfig.key}&order=${sortConfig.direction}`;
      return fetcher(`${BASE_URL}/api/sheets/${selectedTable}${params}`);
    },
    enabled: !!selectedTable,
    placeholderData: keepPreviousData,
    refetchInterval: 3000, // This keeps the rows fresh
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => axios.post(`${BASE_URL}/api/admin-update`, payload),
    onSuccess: () => {
      toast.success("Saved!");
      queryClient.invalidateQueries({ queryKey: ['sheet', selectedTable] });
    },
    onError: () => toast.error("Save Failed")
  });

  const handleSave = (rowId: number, colHeader: string, value: string, sheetName: string) => {
    saveMutation.mutate({
      sheet_name: sheetName,
      row_id: rowId,
      col_header: colHeader,
      value,
      user: session?.user?.email || 'Dashboard Admin'
    });
  };

  const handleSort = (key: string) => {
    setSortConfig(curr => ({ key, direction: curr.key === key && curr.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const isLive = sheetData?.data?.some((row: any) => {
    if (!row.last_updated_at) return false;
    const rowTime = new Date(row.last_updated_at).getTime();
    const now = new Date().getTime();
    return (now - rowTime) < 60000;
  });

  // Manual Trigger Function (just for testing/demo purposes)
  // const handleManualScan = () => {
  //   toast.loading("Scanning...", { id: 'scan' });
  //   queryClient.invalidateQueries({ queryKey: ['tables'] }).then(() => {
  //     toast.success("Scan Complete!", { id: 'scan' });
  //   });
  // };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Toaster position="bottom-right" />
      <Sidebar
        tables={tables}
        selectedTable={selectedTable}
        onSelect={(t) => { setSelectedTable(t); setPage(1); }}
        activeView={view}
        onViewChange={setView}
      // [OPTIONAL] Pass the manual scanner if your Sidebar supports it
      // onGlobalRefresh={handleManualScan} 
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          title={selectedTable}
          isLive={!!isLive}
          isFetching={isFetching}
          isLoading={isLoading}
          activeUsers={sheetData?.meta?.activeUsers || []}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['sheet'] })}
        />

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

        {view === 'table' && !isLoading && !isError && (
          <Pagination
            page={page}
            totalPages={sheetData?.meta?.totalPages || 1}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}