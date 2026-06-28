import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/AxiosInstance';
import { 
    Plus, 
    PencilSimple, 
    Trash, 
    MagnifyingGlass, 
    Package as PackageIcon,
    ArrowUp,
    ArrowDown,
    WifiHigh
} from "@phosphor-icons/react";
import Swal from 'sweetalert2';
import PaginationControl from '../../components/ui/PaginationControl';

interface PackageData {
    package_id: number;
    package_name: string;
    package_limit: string; // Format "10M/10M"
    package_price: number;
    package_desc: string;
}

const PackageListScreen: React.FC = () => {
    const [packages, setPackages] = useState<PackageData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    // Pagination State
    const [page, setPage] = useState<number>(1);
    const [limit, setLimit] = useState<number>(10);

    // Get User Role
    const token = localStorage.getItem('jwt_token') || '';
    let userRole = 1;
    try {
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userRole = Number(payload.role) || 1;
        }
    } catch (e) {}

    const fetchPackages = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/api/internetpackages');
            if (response.data.status === 'success') {
                setPackages(response.data.data || []); // Handle jika data null
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Gagal', 'Gagal memuat data paket', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPackages();
    }, []);

    const handleDelete = async (id: number) => {
        const result = await Swal.fire({
            title: 'Hapus Paket?',
            text: "Paket yang dihapus tidak dapat dipulihkan.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Ya, Hapus!'
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/api/internetpackages/${id}`);
                Swal.fire('Terhapus!', 'Paket berhasil dihapus.', 'success');
                fetchPackages();
            } catch (err: any) {
                Swal.fire('Gagal!', err.response?.data?.message || 'Error', 'error');
            }
        }
    };

    // Helper: Format Rupiah
    const formatRupiah = (price: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
    };

    const filteredPackages = packages.filter(pkg => 
        pkg.package_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Client-side Pagination Logic
    const totalItems = filteredPackages.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const paginatedPackages = filteredPackages.slice((page - 1) * limit, page * limit);

    // Reset ke halaman 1 jika filter berubah
    useEffect(() => {
        setPage(1);
    }, [searchTerm]);

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
                <div>
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <PackageIcon size={28} weight="fill" className="text-sky-400" />
                        Manajemen Paket Internet
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">Kelola harga layanan bulanan, limitasi bandwidth unggah (upload) & unduh (download) pelanggan secara modular.</p>
                </div>
                <div>
                    {userRole === 1 && (
                        <button 
                            onClick={() => navigate('/admin/packages/add')}
                            className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 shadow-md shadow-sky-500/25 transition-all duration-300"
                        >
                            <Plus size={16} weight="bold" /> Tambah Paket Baru
                        </button>
                    )}
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MagnifyingGlass className="text-slate-400" size={18} />
                </div>
                <input 
                    type="text"
                    placeholder="Cari berdasarkan nama paket layanan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all shadow-sm text-xs font-semibold text-slate-700 placeholder:text-slate-400"
                />
            </div>

            {/* Content Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white h-52 rounded-3xl border border-slate-100 p-6 animate-pulse space-y-4">
                            <div className="h-6 bg-slate-100 rounded-xl w-1/2"></div>
                            <div className="h-10 bg-slate-50 rounded-xl w-3/4"></div>
                            <div className="h-4 bg-slate-100 rounded-xl w-1/4"></div>
                        </div>
                    ))}
                </div>
            ) : filteredPackages.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-350">
                    <PackageIcon className="mx-auto text-slate-300 mb-2" size={48} weight="fill"/>
                    <p className="text-slate-400 text-xs font-bold">Belum ada paket internet terdaftar.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedPackages.map((pkg) => (
                        <div key={pkg.package_id} className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group">
                            {/* Card Header */}
                            <div className="p-6 bg-gradient-to-br from-slate-50/50 to-white border-b border-slate-50">
                                <div className="flex justify-between items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-sm font-extrabold text-slate-800 group-hover:text-sky-600 transition-colors truncate">{pkg.package_name}</h3>
                                        <div className="mt-2.5 flex items-baseline gap-1">
                                            <span className="text-xl font-black text-sky-600 tracking-tight">{formatRupiah(pkg.package_price)}</span>
                                            <span className="text-[10px] text-slate-400 font-bold">/ bln</span>
                                        </div>
                                    </div>
                                    <div className="p-2.5 bg-sky-50 text-sky-500 rounded-2xl ring-4 ring-sky-500/5">
                                        <WifiHigh size={20} weight="bold"/>
                                    </div>
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-6 flex-1 space-y-4">
                                {/* Limit Info */}
                                <div className="flex items-center justify-between bg-slate-50/70 p-3 rounded-2xl border border-slate-100/50">
                                    <div className="flex flex-col items-center flex-1 border-r border-slate-100">
                                        <div className="flex items-center gap-1 text-[9px] text-slate-400 uppercase font-black tracking-wider mb-1">
                                            <ArrowDown className="text-green-500 animate-bounce" weight="bold" size={10}/> Download
                                        </div>
                                        <span className="font-mono font-extrabold text-xs text-slate-700">{pkg.package_limit.split('/')[1] || '?'}</span>
                                    </div>
                                    <div className="flex flex-col items-center flex-1">
                                        <div className="flex items-center gap-1 text-[9px] text-slate-400 uppercase font-black tracking-wider mb-1">
                                            <ArrowUp className="text-purple-500" weight="bold" size={10}/> Upload
                                        </div>
                                        <span className="font-mono font-extrabold text-xs text-slate-700">{pkg.package_limit.split('/')[0] || '?'}</span>
                                    </div>
                                </div>

                                {/* Deskripsi */}
                                <div className="text-xs text-slate-500 leading-relaxed font-semibold min-h-[40px]">
                                    {pkg.package_desc || 'Tidak ada deskripsi layanan.'}
                                </div>
                            </div>

                            {/* Card Footer (Actions) */}
                            {userRole === 1 && (
                                <div className="p-4 border-t border-slate-50 bg-slate-50/30 flex gap-3">
                                    <button 
                                        onClick={() => navigate(`/admin/packages/edit/${pkg.package_id}`)}
                                        className="flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 active:scale-95 transition-all duration-300"
                                    >
                                        <PencilSimple weight="bold" size={14}/> Edit Paket
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(pkg.package_id)}
                                        className="py-2 px-3 flex items-center justify-center text-red-500 bg-white border border-slate-200 rounded-xl hover:bg-red-50 hover:border-red-200 active:scale-95 transition-all duration-300"
                                        title="Hapus Paket"
                                    >
                                        <Trash weight="bold" size={15}/>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination UI */}
            {totalItems > limit && (
                <PaginationControl
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={limit}
                    onPageChange={setPage}
                    onLimitChange={setLimit}
                />
            )}
        </div>
    );
};

export default PackageListScreen;