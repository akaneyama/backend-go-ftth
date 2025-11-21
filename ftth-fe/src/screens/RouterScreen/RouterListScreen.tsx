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

    return (
        <div className="space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Manajemen Router</h1>
                    <p className="text-slate-500 text-sm">Daftar perangkat router yang terdaftar di sistem.</p>
                </div>
                <button 
                    onClick={() => navigate('/admin/routers/add')}
                    className="inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-sm"
                >
                    <Plus size={18} weight="bold" />
                    Tambah Router
                </button>
            </div>

            {/* Search Bar & Content */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Search */}
                <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                    <MagnifyingGlass className="text-slate-400" size={20} />
                    <input 
                        type="text"
                        placeholder="Cari berdasarkan Nama atau IP..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-700 placeholder:text-slate-400 outline-none"
                    />
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-slate-500">Memuat data...</div>
                ) : error ? (
                    <div className="p-8 text-center text-red-500">{error}</div>
                ) : filteredRouters.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">Tidak ada data router ditemukan.</div>
                ) : (
                    <>
                        {/* --- DESKTOP TABLE VIEW --- */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4">Nama Router</th>
                                        <th className="px-6 py-4">IP Address</th>
                                        <th className="px-6 py-4">Tipe</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredRouters.map((router) => (
                                        <tr key={router.router_id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-sky-600">
                                                        <WifiHigh size={18} weight="bold"/>
                                                    </div>
                                                    <span className="font-medium text-slate-700">{router.router_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-slate-500">{router.router_address}:{router.router_port}</td>
                                            <td className="px-6 py-4 text-slate-600">{router.router_type} <span className="text-xs text-slate-400">({router.router_remote_type})</span></td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium 
                                                    ${router.router_status === 'Enable' || router.router_status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                    {router.router_status === 'Enable' || router.router_status === 'Active' 
                                                        ? <CheckCircle weight="fill"/> 
                                                        : <WarningCircle weight="fill"/>}
                                                    {router.router_status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => navigate(`/admin/routers/edit/${router.router_id}`)}
                                                        className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all"
                                                        title="Edit"
                                                    >
                                                        <PencilSimple size={18} />
                                                    </button>
                                                   <button 
                                                        onClick={() => handleDelete(router.router_id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Hapus"
                                                    >
                                                        <Trash size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* --- MOBILE CARD VIEW --- */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {filteredRouters.map((router) => (
                                <div key={router.router_id} className="p-4 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-sky-600">
                                                <WifiHigh size={20} weight="bold"/>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800">{router.router_name}</p>
                                                <p className="text-xs text-slate-500 font-mono">{router.router_address}:{router.router_port}</p>
                                            </div>
                                        </div>
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium 
                                            ${router.router_status === 'Enable' || router.router_status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            {router.router_status}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between pt-2">
                                        <div className="text-xs text-slate-500">
                                            {router.router_type} • {router.router_remote_type}
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => navigate(`/admin/routers/edit/${router.router_id}`)}
                                                className="px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 rounded-md border border-sky-100"
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(router.router_id)}
                                                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-md border border-red-100"
                                            >
                                                Hapus
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default RouterListScreen;