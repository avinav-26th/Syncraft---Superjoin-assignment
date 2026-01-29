import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  return (
    <div className="h-14 bg-white border-t border-slate-200 flex items-center justify-between px-6">
      <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
      <div className="flex gap-2">
        <button 
          disabled={page === 1} 
          onClick={() => onPageChange(page - 1)} 
          className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-slate-50 flex items-center gap-1 text-sm text-slate-600"
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <button 
          disabled={page >= totalPages} 
          onClick={() => onPageChange(page + 1)} 
          className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-slate-50 flex items-center gap-1 text-sm text-slate-600"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}