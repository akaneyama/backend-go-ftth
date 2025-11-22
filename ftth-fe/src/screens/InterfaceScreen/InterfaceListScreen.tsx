import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/AxiosInstance';
import { 
    Plus, 
    PencilSimple, 
    Trash, 
    MagnifyingGlass, 
    ArrowsLeftRight,
    Plugs,
    WifiHigh
} from "@phosphor-icons/react";
import Swal from 'sweetalert2';

interface InterfaceData {
    interface_id: number;
    interface_name: string;
    router_id: string;
    Router?: {
        router_name: string;
        router_address: string;
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
        item.Router?.router_name.toLowerCase().includes(searchTerm.toLowerCase())
        ||
        item.Router?.router_type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Monitoring Interface</h1>
                    <p className="text-slate-500 text-sm">Kelola interface router yang akan dipantau traffic-nya.</p>
                </div>
                <button 
                    onClick={() => navigate('/admin/interfaces/add')}
                    className="inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-sm"
                >
                    <Plus size={18} weight="bold" />
                    Tambah Monitoring
                </button>
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                    <MagnifyingGlass className="text-slate-400" size={20} />
                    <input 
                        type="text"
                        placeholder="Cari Interface atau Router..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-700 placeholder:text-slate-400 outline-none"
                    />
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-slate-500">Memuat data...</div>
                ) : filteredData.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">Belum ada interface yang dimonitor.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Nama Interface</th>
                                    <th className="px-6 py-4">Router Induk</th>
                                    <th className="px-6 py-4">IP Router</th>
                                    <th className="px-6 py-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.map((item) => (
                                    <tr key={item.interface_id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-purple-100 flex items-center justify-center text-purple-600">
                                                    <ArrowsLeftRight size={18} weight="bold"/>
                                                </div>
                                                <span className="font-bold text-slate-700">{item.interface_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-600">
                                            {item.Router?.router_type || '-'}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-slate-500">
                                            {item.Router?.router_address || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => navigate(`/admin/interfaces/edit/${item.interface_id}`)}
                                                    className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all"
                                                >
                                                    <PencilSimple size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(item.interface_id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
                )}
            </div>
        </div>
    );
};

export default InterfaceListScreen;