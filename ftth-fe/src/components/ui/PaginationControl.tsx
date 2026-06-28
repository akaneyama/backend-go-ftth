import React from 'react';

interface PaginationControlProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onLimitChange?: (limit: number) => void; // Optional if we want to allow changing page size
}

const PaginationControl: React.FC<PaginationControlProps> = ({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    onPageChange,
    onLimitChange
}) => {
    if (totalItems === 0 || totalPages <= 1) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mt-4">
            <div className="text-xs text-slate-500 font-semibold">
                Menampilkan <span className="text-slate-800 font-bold">{Math.min(itemsPerPage, totalItems)}</span> dari <span className="text-slate-800 font-bold">{totalItems}</span> data
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-1.5">
                <button 
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs transition"
                >
                    Prev
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let p = currentPage;
                    if (totalPages <= 5) {
                        p = i + 1;
                    } else {
                        if (currentPage <= 3) p = i + 1;
                        else if (currentPage >= totalPages - 2) p = totalPages - 4 + i;
                        else p = currentPage - 2 + i;
                    }
                    
                    return (
                        <button
                            key={p}
                            onClick={() => onPageChange(p)}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                                currentPage === p 
                                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' 
                                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {p}
                        </button>
                    );
                })}
                
                <button 
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs transition"
                >
                    Next
                </button>
            </div>

            {onLimitChange && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Per Hal:</span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => {
                            onPageChange(1);
                            onLimitChange(Number(e.target.value));
                        }}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-bold text-slate-700 cursor-pointer"
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                    </select>
                </div>
            )}
        </div>
    );
};

export default PaginationControl;
