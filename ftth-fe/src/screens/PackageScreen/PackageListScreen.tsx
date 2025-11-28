import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/AxiosInstance';
import { 
    Plus, 
    PencilSimple, 
    Trash, 
    MagnifyingGlass, 
    Package as PackageIcon,
    Coin as CurrencyIdr,
    ArrowUp,
    ArrowDown,
    WifiHigh
} from "@phosphor-icons/react";
import Swal from 'sweetalert2';

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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <PackageIcon weight="duotone" className="text-sky-600"/>
                        Manajemen Paket Internet
                    </h1>
                    <p className="text-slate-500 text-sm">Atur harga dan limit bandwidth paket layanan.</p>
                </div>
                <button 
                    onClick={() => navigate('/admin/packages/add')}
                    className="inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-sm active:scale-95"
                >
                    <Plus size={18} weight="bold" />
                    Tambah Paket
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlass className="text-slate-400" size={20} />
                </div>
                <input 
                    type="text"
                    placeholder="Cari nama paket..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all shadow-sm"
                />
            </div>

            {/* Content Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white h-48 rounded-xl border border-slate-200 p-6 animate-pulse">
                            <div className="h-6 bg-slate-100 rounded w-1/2 mb-4"></div>
                            <div className="h-4 bg-slate-100 rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                        </div>
                    ))}
                </div>
            ) : filteredPackages.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <PackageIcon className="mx-auto text-slate-300 mb-2" size={48} weight="duotone"/>
                    <p className="text-slate-500">Belum ada paket internet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPackages.map((pkg) => (
                        <div key={pkg.package_id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col group">
                            {/* Card Header (Gradient) */}
                            <div className="p-6 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 group-hover:text-sky-600 transition-colors">{pkg.package_name}</h3>
                                        <div className="mt-2 flex items-baseline gap-1">
                                            <span className="text-2xl font-bold text-sky-600">{formatRupiah(pkg.package_price)}</span>
                                            <span className="text-xs text-slate-400">/bulan</span>
                                        </div>
                                    </div>
                                    <div className="p-2 bg-sky-50 rounded-lg text-sky-600">
                                        <WifiHigh size={24} weight="bold"/>
                                    </div>
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-6 flex-1 space-y-4">
                                {/* Limit Info */}
                                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <div className="flex flex-col items-center flex-1 border-r border-slate-200">
                                        <div className="flex items-center gap-1 text-xs text-slate-500 uppercase font-bold mb-1">
                                            <ArrowDown className="text-green-500" weight="bold"/> Download
                                        </div>
                                        <span className="font-mono font-bold text-slate-700">{pkg.package_limit.split('/')[1] || '?'}</span>
                                    </div>
                                    <div className="flex flex-col items-center flex-1">
                                        <div className="flex items-center gap-1 text-xs text-slate-500 uppercase font-bold mb-1">
                                            <ArrowUp className="text-purple-500" weight="bold"/> Upload
                                        </div>
                                        <span className="font-mono font-bold text-slate-700">{pkg.package_limit.split('/')[0] || '?'}</span>
                                    </div>
                                </div>

                                {/* Deskripsi */}
                                <div className="text-sm text-slate-500 leading-relaxed min-h-[40px]">
                                    {pkg.package_desc}
                                </div>
                            </div>

                            {/* Card Footer (Actions) */}
                            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                                <button 
                                    onClick={() => navigate(`/admin/packages/edit/${pkg.package_id}`)}
                                    className="flex-1 py-2 flex items-center justify-center gap-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 transition-all"
                                >
                                    <PencilSimple weight="bold"/> Edit
                                </button>
                                <button 
                                    onClick={() => handleDelete(pkg.package_id)}
                                    className="py-2 px-3 flex items-center justify-center text-red-500 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-all"
                                    title="Hapus Paket"
                                >
                                    <Trash weight="bold" size={18}/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PackageListScreen;