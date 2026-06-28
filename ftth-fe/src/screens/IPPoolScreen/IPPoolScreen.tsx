import React, { useEffect, useState } from 'react';
import api from '../../api/AxiosInstance';
import Swal from 'sweetalert2';
import { 
    Plus, 
    Trash, 
    PencilSimple, 
    ArrowsClockwise, 
    MagnifyingGlass,
    Network
} from '@phosphor-icons/react';
import PaginationControl from '../../components/ui/PaginationControl';

interface IPPool {
    id: number;
    name: string;
    subnet: string;
    gateway: string;
    router_id: string;
}

const IPPoolScreen: React.FC = () => {
    const [pools, setPools] = useState<IPPool[]>([]);
    const [filteredPools, setFilteredPools] = useState<IPPool[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Pagination state
    const [page, setPage] = useState<number>(1);
    const [limit, setLimit] = useState<number>(10);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPool, setEditingPool] = useState<IPPool | null>(null);
    const [formData, setFormData] = useState({ name: '', subnet: '', gateway: '', router_id: '' });

    useEffect(() => {
        fetchPools();
    }, []);

    useEffect(() => {
        if (searchTerm) {
            setFilteredPools(pools.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())));
        } else {
            setFilteredPools(pools);
        }
    }, [searchTerm, pools]);

    // Client-side pagination logic
    const totalItems = filteredPools.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const paginatedPools = filteredPools.slice((page - 1) * limit, page * limit);

    // Reset pagination to page 1 when search changes
    useEffect(() => {
        setPage(1);
    }, [searchTerm]);

    const fetchPools = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/ippools');
            if (res.data.status === 'success') {
                setPools(res.data.data || []);
            }
        } catch (err) {
            Swal.fire('Error', 'Gagal memuat data IP Pool', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (pool?: IPPool) => {
        if (pool) {
            setEditingPool(pool);
            setFormData({
                name: pool.name,
                subnet: pool.subnet,
                gateway: pool.gateway,
                router_id: pool.router_id || ''
            });
        } else {
            setEditingPool(null);
            setFormData({ name: '', subnet: '', gateway: '', router_id: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingPool(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                subnet: formData.subnet,
                gateway: formData.gateway,
                router_id: formData.router_id || undefined
            };

            if (editingPool) {
                await api.put(`/api/ippools/${editingPool.id}`, payload);
                Swal.fire('Sukses', 'IP Pool berhasil diupdate', 'success');
            } else {
                await api.post('/api/ippools', payload);
                Swal.fire('Sukses', 'IP Pool berhasil ditambahkan', 'success');
            }
            handleCloseModal();
            fetchPools();
        } catch (err: any) {
            Swal.fire('Error', err.response?.data?.message || 'Gagal menyimpan IP Pool', 'error');
        }
    };

    const handleDelete = async (id: number) => {
        const result = await Swal.fire({
            title: 'Hapus IP Pool?',
            text: "Aksi ini tidak dapat dibatalkan!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, hapus!'
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/api/ippools/${id}`);
                Swal.fire('Terhapus!', 'IP Pool telah dihapus.', 'success');
                fetchPools();
            } catch (err) {
                Swal.fire('Error', 'Gagal menghapus IP Pool', 'error');
            }
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto pb-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-sky-100 p-2.5 rounded-xl border border-sky-200">
                        <Network size={26} className="text-sky-600" weight="fill" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Manajemen IP Pool</h1>
                        <p className="text-slate-500 text-sm mt-0.5">Kelola subnet dan gateway IP untuk PPPoE</p>
                    </div>
                </div>
                
                <button 
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-lg shadow-sm shadow-sky-600/30 transition-all font-medium text-sm"
                >
                    <Plus size={18} weight="bold" />
                    Tambah Pool
                </button>
            </div>

            {/* Toolbar Section */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlass size={18} className="text-slate-400" />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Cari IP Pool..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm transition-all"
                    />
                </div>
                
                <button 
                    onClick={fetchPools}
                    disabled={loading}
                    className="flex items-center gap-2 text-slate-600 hover:text-sky-600 hover:bg-sky-50 px-3 py-2 rounded-lg transition-all text-sm font-medium border border-transparent hover:border-sky-200"
                >
                    <ArrowsClockwise size={18} className={loading ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">
                                <th className="px-6 py-4 font-semibold">Nama Pool</th>
                                <th className="px-6 py-4 font-semibold">Subnet</th>
                                <th className="px-6 py-4 font-semibold">Gateway</th>
                                <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 whitespace-nowrap">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex justify-center mb-3">
                                            <ArrowsClockwise size={32} className="animate-spin text-sky-500" />
                                        </div>
                                        Memuat data...
                                    </td>
                                </tr>
                            ) : filteredPools.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex justify-center mb-3">
                                            <Network size={36} className="text-slate-300" />
                                        </div>
                                        Tidak ada IP Pool yang ditemukan.
                                    </td>
                                </tr>
                            ) : (
                                paginatedPools.map((pool) => (
                                    <tr key={pool.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-800">{pool.name}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-mono border border-blue-100">
                                                {pool.subnet}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-slate-600 font-mono text-sm">{pool.gateway}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleOpenModal(pool)}
                                                    className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                                                    title="Edit"
                                                >
                                                    <PencilSimple size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(pool.id)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                    title="Hapus"
                                                >
                                                    <Trash size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* --- MOBILE CARD VIEW --- */}
                <div className="md:hidden divide-y divide-slate-100">
                    {loading ? (
                        <div className="px-6 py-12 text-center text-slate-500">
                            <div className="flex justify-center mb-3">
                                <ArrowsClockwise size={32} className="animate-spin text-sky-500" />
                            </div>
                            Memuat data...
                        </div>
                    ) : filteredPools.length === 0 ? (
                        <div className="px-6 py-12 text-center text-slate-500">
                            <div className="flex justify-center mb-3">
                                <Network size={36} className="text-slate-300" />
                            </div>
                            Tidak ada IP Pool yang ditemukan.
                        </div>
                    ) : (
                        paginatedPools.map((pool) => (
                            <div key={pool.id} className="p-4 space-y-3 hover:bg-slate-50 transition-colors">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="font-bold text-slate-800">{pool.name}</div>
                                    <div className="flex gap-1.5">
                                        <button 
                                            onClick={() => handleOpenModal(pool)}
                                            className="p-2 text-amber-600 bg-amber-50 rounded-lg transition-colors border border-amber-100 active:scale-95"
                                            title="Edit"
                                        >
                                            <PencilSimple size={16} weight="bold" />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(pool.id)}
                                            className="p-2 text-red-600 bg-red-50 rounded-lg transition-colors border border-red-100 active:scale-95"
                                            title="Hapus"
                                        >
                                            <Trash size={16} weight="bold" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div className="space-y-1">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Subnet</span>
                                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-mono border border-blue-100">
                                            {pool.subnet}
                                        </span>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Gateway</span>
                                        <span className="text-slate-600 font-mono text-sm">{pool.gateway}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

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

            {/* Modal Add/Edit */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800">
                                {editingPool ? 'Edit IP Pool' : 'Tambah IP Pool'}
                            </h3>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <span className="text-2xl leading-none">&times;</span>
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Pool <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                        placeholder="Contoh: Pool PPPoE Area 1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Subnet <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        required
                                        value={formData.subnet}
                                        onChange={(e) => setFormData({...formData, subnet: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 font-mono text-sm"
                                        placeholder="Contoh: 192.168.10.0/24"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Gateway <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        required
                                        value={formData.gateway}
                                        onChange={(e) => setFormData({...formData, gateway: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 font-mono text-sm"
                                        placeholder="Contoh: 192.168.10.1"
                                    />
                                </div>
                                
                                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                                    <button 
                                        type="button" 
                                        onClick={handleCloseModal}
                                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button 
                                        type="submit"
                                        className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 shadow-sm shadow-sky-600/30 transition-all"
                                    >
                                        Simpan
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IPPoolScreen;
