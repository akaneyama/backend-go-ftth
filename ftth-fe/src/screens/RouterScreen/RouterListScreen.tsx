import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import api from '../../api/AxiosInstance'; // Pastikan path ini benar
import { 
    Plus, 
    PencilSimple, 
    Trash, 
    MagnifyingGlass, 
    WifiHigh, 
    WarningCircle,
    CheckCircle
} from "@phosphor-icons/react";
import PaginationControl from '../../components/ui/PaginationControl';

interface RouterData {
    router_id: string;
    router_name: string;
    router_address: string;
    router_port: number;
    router_status: string;
    router_type: string;
    router_remote_type: string;
    router_username: string;
}

const RouterListScreen: React.FC = () => {
    const [routers, setRouters] = useState<RouterData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState('');
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

    const fetchRouters = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/api/routers');
            if (response.data.status === 'success') {
                setRouters(response.data.data);
            }
        } catch (err) {
            setError('Gagal memuat data router.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRouters();
    }, []);

const handleDelete = async (id: string) => {
    // DEBUG: Cek apakah ID muncul di console browser (F12)
    console.log("ID yang akan dihapus:", id); 

    const result = await Swal.fire({
        title: 'Hapus Router?',
        text: "Data yang dihapus tidak dapat dikembalikan!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Hapus!'
    });

    if (result.isConfirmed) {
        try {
            // Pastikan URL endpoint sesuai: /api/routers/{uuid}
            const response = await api.delete(`/api/routers/${id}`);
            
            // DEBUG: Cek respon dari server
            console.log("Respon Server:", response.data);

            if (response.data.status === 'success') {
                Swal.fire('Terhapus!', 'Data berhasil dihapus.', 'success');
                fetchRouters();
            } else {
                // Jika status bukan success, tampilkan pesan error dari backend
                Swal.fire('Gagal!', response.data.remark || 'Gagal menghapus.', 'error');
            }
        } catch (err: any) {
            console.error("Error Axios:", err);
            // Tampilkan error spesifik jika ada (misal 404 atau 500)
            Swal.fire('Error!', err.response?.data?.remark || err.message, 'error');
        }
    }
};

    // Filter Logic
    const filteredRouters = routers.filter(router => 
        router.router_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        router.router_address.includes(searchTerm)
    );

    // Client-side Pagination Logic
    const totalItems = filteredRouters.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const paginatedRouters = filteredRouters.slice((page - 1) * limit, page * limit);

    // Reset ke halaman 1 jika filter berubah
    useEffect(() => {
        setPage(1);
    }, [searchTerm]);

    return (
        <div className="space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
                <div>
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <WifiHigh size={28} weight="fill" className="text-sky-400 animate-pulse" />
                        Manajemen Router Mikrotik
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">Kelola integrasi konektivitas perangkat router, status koneksi API/SSH, serta interface monitoring traffic jaringan secara instan.</p>
                </div>
                <div>
                    {userRole === 1 && (
                        <button 
                            onClick={() => navigate('/admin/routers/add')}
                            className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 shadow-md shadow-sky-500/25 transition-all duration-300"
                        >
                            <Plus size={16} weight="bold" /> Tambah Router Baru
                        </button>
                    )}
                </div>
            </div>

            {/* Search Bar & Content */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Search */}
                <div className="p-5 border-b border-slate-50 flex items-center gap-3 bg-slate-50/50">
                    <MagnifyingGlass className="text-slate-400" size={20} />
                    <input 
                        type="text"
                        placeholder="Cari berdasarkan nama perangkat atau alamat IP router..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-xs text-slate-700 placeholder:text-slate-400 outline-none font-medium"
                    />
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-slate-400 font-bold text-xs animate-pulse">Memuat data router...</div>
                ) : error ? (
                    <div className="p-12 text-center text-rose-500 font-bold text-xs">{error}</div>
                ) : filteredRouters.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 font-bold text-xs">Tidak ada data router ditemukan.</div>
                ) : (
                    <>
                        {/* --- DESKTOP TABLE VIEW --- */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Nama Router</th>
                                        <th className="px-6 py-4">IP Address</th>
                                        <th className="px-6 py-4">Tipe & Protokol</th>
                                        <th className="px-6 py-4">Status Perangkat</th>
                                        {userRole === 1 && <th className="px-6 py-4 text-center">Aksi</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {paginatedRouters.map((router) => (
                                        <tr key={router.router_id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center text-sky-500 ring-4 ring-sky-500/5">
                                                        <WifiHigh size={16} weight="bold"/>
                                                    </div>
                                                    <div>
                                                        <span className="font-extrabold text-slate-800">{router.router_name}</span>
                                                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">ID: {router.router_id.substring(0, 8)}...</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono font-bold text-slate-500">
                                                <span className="bg-slate-100 px-2.5 py-1 rounded-md text-[10px]">
                                                    {router.router_address}:{router.router_port}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 font-bold">
                                                {router.router_type} 
                                                <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-500 uppercase tracking-wide font-black">
                                                    {router.router_remote_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border 
                                                    ${router.router_status === 'Enable' || router.router_status === 'Active' 
                                                        ? 'bg-green-50 text-green-700 border-green-150 border-green-200' 
                                                        : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                    {router.router_status === 'Enable' || router.router_status === 'Active' 
                                                        ? <CheckCircle weight="fill" size={11} className="text-green-500"/> 
                                                        : <WarningCircle weight="fill" size={11} className="text-rose-500"/>}
                                                    {router.router_status}
                                                </span>
                                            </td>
                                            {userRole === 1 && (
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button 
                                                            onClick={() => navigate(`/admin/routers/edit/${router.router_id}`)}
                                                            className="p-2 bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-500 hover:text-sky-600 rounded-xl transition active:scale-95"
                                                            title="Edit Parameter Router"
                                                        >
                                                            <PencilSimple size={15} weight="bold" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(router.router_id)}
                                                            className="p-2 bg-slate-50 border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition active:scale-95"
                                                            title="Hapus Router"
                                                        >
                                                            <Trash size={15} weight="bold" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* --- MOBILE CARD VIEW --- */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {paginatedRouters.map((router) => (
                                <div key={router.router_id} className="p-5 space-y-4 hover:bg-slate-50/30 transition">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-500 ring-4 ring-sky-500/5">
                                                <WifiHigh size={20} weight="bold"/>
                                            </div>
                                            <div>
                                                <p className="font-extrabold text-slate-855 text-slate-800 text-xs">{router.router_name}</p>
                                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{router.router_address}:{router.router_port}</p>
                                            </div>
                                        </div>
                                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border 
                                            ${router.router_status === 'Enable' || router.router_status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                            {router.router_status}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                            {router.router_type} • {router.router_remote_type}
                                        </div>
                                        <div className="flex gap-2.5">
                                            {userRole === 1 && (
                                                <>
                                                    <button 
                                                        onClick={() => navigate(`/admin/routers/edit/${router.router_id}`)}
                                                        className="px-3.5 py-2 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-100 rounded-xl active:scale-95 transition"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(router.router_id)}
                                                        className="px-3.5 py-2 text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 rounded-xl active:scale-95 transition"
                                                    >
                                                        Hapus
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
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
        </div>
    );
};

export default RouterListScreen;