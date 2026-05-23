import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/AxiosInstance';
import Swal from 'sweetalert2';
import {
    Broadcast,
    MagnifyingGlass,
    MapPin,
    Trash,
    Spinner,
    Plus,
    Warning,
    CheckCircle,
    XCircle,
    ArrowSquareOut,
    PlugsConnected,
} from '@phosphor-icons/react';

interface ODPNode {
    node_id: number;
    name: string;
    type: string;
    lat: number;
    lng: number;
    description: string;
    status: string;
    odp_detail?: {
        odp_id: number;
        total_ports: number;
        used_ports: number;
    };
}

const ODPListScreen: React.FC = () => {
    const [nodes, setNodes] = useState<ODPNode[]>([]);
    const [filtered, setFiltered] = useState<ODPNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [capacityFilter, setCapacityFilter] = useState<'all' | 'available' | 'full'>('all');

    const navigate = useNavigate();

    const loadODP = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/topology');
            if (res.data.status === 'success') {
                const allNodes: ODPNode[] = res.data.data.nodes || [];
                const odpNodes = allNodes.filter(n => n.type === 'ODP');
                setNodes(odpNodes);
            }
        } catch (err) {
            Swal.fire('Error', 'Gagal memuat data ODP dari server.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadODP();
    }, []);

    // Filter logic
    useEffect(() => {
        let result = [...nodes];
        const q = searchQuery.toLowerCase();
        if (q) {
            result = result.filter(n =>
                n.name.toLowerCase().includes(q) ||
                n.description?.toLowerCase().includes(q)
            );
        }
        if (capacityFilter === 'available') {
            result = result.filter(n =>
                !n.odp_detail || n.odp_detail.used_ports < n.odp_detail.total_ports
            );
        } else if (capacityFilter === 'full') {
            result = result.filter(n =>
                n.odp_detail && n.odp_detail.used_ports >= n.odp_detail.total_ports
            );
        }
        setFiltered(result);
    }, [nodes, searchQuery, capacityFilter]);

    const handleDelete = async (nodeId: number, name: string) => {
        const result = await Swal.fire({
            title: 'Hapus Node ODP?',
            text: `Node "${name}" dan semua kabel terhubung akan dihapus permanen dari peta jaringan.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        });
        if (result.isConfirmed) {
            try {
                await api.delete(`/api/nodes/${nodeId}`);
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'ODP berhasil dihapus', showConfirmButton: false, timer: 2000 });
                loadODP();
            } catch (err: any) {
                Swal.fire('Gagal', err.response?.data?.message || 'Terjadi kesalahan.', 'error');
            }
        }
    };

    const getCapacityInfo = (node: ODPNode) => {
        if (!node.odp_detail) return { used: 0, total: 8, percent: 0, color: 'blue', label: 'Tidak diketahui' };
        const { used_ports, total_ports } = node.odp_detail;
        const percent = total_ports > 0 ? Math.round((used_ports / total_ports) * 100) : 0;
        let color = 'emerald';
        let label = 'Tersedia';
        if (used_ports >= total_ports) { color = 'red'; label = 'Penuh'; }
        else if (percent >= 75) { color = 'amber'; label = 'Hampir Penuh'; }
        return { used: used_ports, total: total_ports, percent, color, label };
    };

    const totalNodes = nodes.length;
    const fullNodes = nodes.filter(n => n.odp_detail && n.odp_detail.used_ports >= n.odp_detail.total_ports).length;
    const availNodes = totalNodes - fullNodes;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 to-sky-800 p-6 rounded-3xl text-white shadow-xl">
                <div>
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <Broadcast size={28} weight="fill" className="text-sky-300" />
                        Manajemen ODP (Optical Distribution Point)
                    </h2>
                    <p className="text-xs text-sky-200 mt-1">Pantau kapasitas port, lokasi, dan status semua node ODP di jaringan FTTH Anda.</p>
                </div>
                <button
                    onClick={() => navigate('/admin/network-map')}
                    className="bg-white/10 hover:bg-white/20 border border-white/20 px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shrink-0"
                >
                    <Plus size={16} weight="bold" /> Tambah ODP di Peta
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                        <Broadcast size={24} className="text-blue-600" weight="fill" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-semibold">Total ODP</p>
                        <p className="text-2xl font-black text-slate-800">{totalNodes}</p>
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                        <CheckCircle size={24} className="text-emerald-600" weight="fill" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-semibold">Port Tersedia</p>
                        <p className="text-2xl font-black text-emerald-700">{availNodes}</p>
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center">
                        <XCircle size={24} className="text-red-600" weight="fill" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-semibold">Port Penuh</p>
                        <p className="text-2xl font-black text-red-600">{fullNodes}</p>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <MagnifyingGlass className="absolute inset-y-0 left-0 h-full w-5 text-slate-400 ml-3.5" />
                    <input
                        type="text"
                        placeholder="Cari nama ODP atau deskripsi..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-700 transition"
                    />
                </div>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    {[
                        { key: 'all', label: 'Semua' },
                        { key: 'available', label: '✅ Tersedia' },
                        { key: 'full', label: '🔴 Penuh' },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setCapacityFilter(f.key as any)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                                capacityFilter === f.key
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                        <Spinner className="animate-spin text-sky-500 mb-3" size={32} />
                        <span className="font-semibold text-sm">Memuat data ODP...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-400 text-center px-4">
                        <Broadcast size={48} className="text-slate-300 mb-3" weight="duotone" />
                        <h4 className="font-bold text-slate-700 text-base">Tidak Ada ODP Ditemukan</h4>
                        <p className="text-xs text-slate-400 max-w-sm mt-1">
                            Belum ada node ODP yang terdaftar. Tambahkan ODP melalui halaman Peta Topologi.
                        </p>
                        <button
                            onClick={() => navigate('/admin/network-map')}
                            className="mt-4 bg-sky-500 hover:bg-sky-600 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                        >
                            <MapPin size={14} weight="fill" /> Buka Peta Topologi
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-4 px-6">Nama ODP</th>
                                    <th className="py-4 px-6">Kapasitas Port</th>
                                    <th className="py-4 px-6">Status</th>
                                    <th className="py-4 px-6">Deskripsi / Lokasi</th>
                                    <th className="py-4 px-6">Koordinat</th>
                                    <th className="py-4 px-6 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                                {filtered.map(node => {
                                    const cap = getCapacityInfo(node);
                                    const barColor = {
                                        emerald: 'bg-emerald-500',
                                        amber: 'bg-amber-400',
                                        red: 'bg-red-500',
                                        blue: 'bg-blue-400',
                                    }[cap.color] || 'bg-slate-300';
                                    const badgeColor = {
                                        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                                        amber: 'bg-amber-50 text-amber-700 border-amber-100',
                                        red: 'bg-red-50 text-red-700 border-red-100',
                                        blue: 'bg-blue-50 text-blue-700 border-blue-100',
                                    }[cap.color] || 'bg-slate-50 text-slate-600 border-slate-200';

                                    return (
                                        <tr key={node.node_id} className="hover:bg-slate-50/70 transition-colors">
                                            {/* Nama */}
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                                        <Broadcast size={18} className="text-blue-600" weight="fill" />
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-800 text-sm block">{node.name}</span>
                                                        <span className="text-[10px] text-slate-400">ID Node: #{node.node_id}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Kapasitas */}
                                            <td className="py-4 px-6">
                                                <div className="space-y-1.5 min-w-[140px]">
                                                    <div className="flex items-center justify-between text-[11px]">
                                                        <span className="font-bold text-slate-700">
                                                            <PlugsConnected size={12} className="inline mr-1 text-slate-400" />
                                                            {cap.used} / {cap.total} port
                                                        </span>
                                                        <span className="font-black text-slate-500">{cap.percent}%</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                                                        <div
                                                            className={`h-1.5 rounded-full transition-all ${barColor}`}
                                                            style={{ width: `${Math.min(cap.percent, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Status badge */}
                                            <td className="py-4 px-6">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${badgeColor}`}>
                                                    {cap.color === 'red' && <Warning size={11} weight="fill" />}
                                                    {cap.color === 'emerald' && <CheckCircle size={11} weight="fill" />}
                                                    {cap.color === 'amber' && <Warning size={11} weight="fill" />}
                                                    {cap.label}
                                                </span>
                                            </td>

                                            {/* Deskripsi */}
                                            <td className="py-4 px-6 max-w-xs">
                                                {node.description ? (
                                                    <span className="text-slate-600 text-[11px] line-clamp-2">{node.description}</span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-[10px]">Tidak ada keterangan</span>
                                                )}
                                            </td>

                                            {/* Koordinat */}
                                            <td className="py-4 px-6">
                                                {node.lat && node.lng ? (
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${node.lat},${node.lng}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline font-bold text-[11px]"
                                                    >
                                                        <MapPin size={13} weight="fill" className="text-indigo-400" />
                                                        {node.lat.toFixed(5)}, {node.lng.toFixed(5)}
                                                        <ArrowSquareOut size={11} />
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400 italic text-[10px]">Belum dipetakan</span>
                                                )}
                                            </td>

                                            {/* Aksi */}
                                            <td className="py-4 px-6">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => navigate(`/admin/network-map`)}
                                                        title="Lihat di Peta"
                                                        className="p-2 bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-500 hover:text-sky-600 rounded-xl transition active:scale-95"
                                                    >
                                                        <MapPin size={15} weight="fill" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(node.node_id, node.name)}
                                                        title="Hapus ODP"
                                                        className="p-2 bg-slate-50 border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl transition active:scale-95"
                                                    >
                                                        <Trash size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Footer summary */}
                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-semibold flex justify-between">
                            <span>Menampilkan {filtered.length} dari {nodes.length} ODP</span>
                            <span>
                                Total kapasitas: {nodes.reduce((s, n) => s + (n.odp_detail?.total_ports || 0), 0)} port •
                                Terpakai: {nodes.reduce((s, n) => s + (n.odp_detail?.used_ports || 0), 0)} port
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ODPListScreen;
