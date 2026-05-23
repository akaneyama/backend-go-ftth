import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/AxiosInstance';
import { 
    Plus, 
    PencilSimple, 
    Trash, 
    MagnifyingGlass, 
    ArrowsLeftRight,
} from "@phosphor-icons/react";
import Swal from 'sweetalert2';

interface InterfaceData {
    interface_id: number;
    interface_name: string;
    router_id: string;
    Router?: {
        router_name: string;
        router_address: string;
        router_type: string;
    };
}

const InterfaceListScreen: React.FC = () => {
    const [interfaces, setInterfaces] = useState<InterfaceData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const fetchInterfaces = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/api/interfaces');
            if (response.data.status === 'success') {
                setInterfaces(response.data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInterfaces();
    }, []);

    const handleDelete = async (id: number) => {
        const result = await Swal.fire({
            title: 'Hapus Monitoring?',
            text: "Data traffic yang tersimpan mungkin masih ada, tapi monitoring akan berhenti.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Ya, Hapus!'
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/api/interfaces/${id}`);
                Swal.fire('Terhapus!', 'Monitoring interface dihapus.', 'success');
                fetchInterfaces();
            } catch (err: any) {
                Swal.fire('Gagal!', err.response?.data?.message || 'Error', 'error');
            }
        }
    };

    const filteredData = interfaces.filter(item => 
        item.interface_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Router?.router_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Router?.router_type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
                <div>
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <ArrowsLeftRight size={28} weight="fill" className="text-sky-400 animate-pulse" />
                        Monitoring Interface
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">Kelola pemantauan interface fisik/virtual pada router Mikrotik untuk kalkulasi grafik penggunaan bandwidth secara dinamis.</p>
                </div>
                <div>
                    <button 
                        onClick={() => navigate('/admin/interfaces/add')}
                        className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 shadow-md shadow-sky-500/25 transition-all duration-300"
                    >
                        <Plus size={16} weight="bold" /> Tambah Monitoring
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Search */}
                <div className="p-5 border-b border-slate-50 flex items-center gap-3 bg-slate-50/50">
                    <MagnifyingGlass className="text-slate-400" size={20} />
                    <input 
                        type="text"
                        placeholder="Cari berdasarkan nama interface atau nama router induk..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-xs text-slate-700 placeholder:text-slate-400 outline-none font-medium"
                    />
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-slate-400 font-bold text-xs animate-pulse">Memuat data interface...</div>
                ) : filteredData.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 font-bold text-xs">Belum ada interface yang dimonitor.</div>
                ) : (
                    <>
                        {/* --- DESKTOP TABLE VIEW --- */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Nama Interface</th>
                                        <th className="px-6 py-4">Router Induk</th>
                                        <th className="px-6 py-4">IP Router</th>
                                        <th className="px-6 py-4 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredData.map((item) => (
                                        <tr key={item.interface_id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500 ring-4 ring-purple-500/5">
                                                        <ArrowsLeftRight size={16} weight="bold"/>
                                                    </div>
                                                    <span className="font-extrabold text-slate-800">{item.interface_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-600">
                                                {item.Router?.router_name || '-'}
                                            </td>
                                            <td className="px-6 py-4 font-mono font-bold text-slate-500">
                                                <span className="bg-slate-100 px-2.5 py-1 rounded-md text-[10px]">
                                                    {item.Router?.router_address || '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button 
                                                        onClick={() => navigate(`/admin/interfaces/edit/${item.interface_id}`)}
                                                        className="p-2 bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-500 hover:text-sky-600 rounded-xl transition active:scale-95"
                                                        title="Edit Parameter Interface"
                                                    >
                                                        <PencilSimple size={15} weight="bold" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(item.interface_id)}
                                                        className="p-2 bg-slate-50 border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition active:scale-95"
                                                        title="Hapus Interface"
                                                    >
                                                        <Trash size={15} weight="bold" />
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
                            {filteredData.map((item) => (
                                <div key={item.interface_id} className="p-5 space-y-4 hover:bg-slate-50/30 transition">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500 ring-4 ring-purple-500/5">
                                                <ArrowsLeftRight size={20} weight="bold"/>
                                            </div>
                                            <div>
                                                <p className="font-extrabold text-slate-800 text-xs">{item.interface_name}</p>
                                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{item.Router?.router_address || '-'}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                        <div className="text-[10px] text-slate-500">
                                            Router Induk: <span className="font-bold text-slate-700">{item.Router?.router_name || '-'}</span>
                                        </div>
                                        <div className="flex gap-2.5">
                                            <button 
                                                onClick={() => navigate(`/admin/interfaces/edit/${item.interface_id}`)}
                                                className="px-3.5 py-2 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-100 rounded-xl active:scale-95 transition"
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(item.interface_id)}
                                                className="px-3.5 py-2 text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 rounded-xl active:scale-95 transition"
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

export default InterfaceListScreen;