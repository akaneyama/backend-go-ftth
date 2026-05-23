import React, { useState, useEffect } from 'react';
import api from '../../api/AxiosInstance';
import Swal from 'sweetalert2';
import {
    ShareNetwork,
    Plus,
    Trash,
    PencilLine,
    MagnifyingGlass,
    Spinner,
    Cpu,
    Broadcast,
    Database,
    HardDrives,
    ArrowRight,
    X,
    DownloadSimple,
} from '@phosphor-icons/react';

interface RouterOption {
    router_id: string;
    router_name: string;
}

interface NetworkNode {
    node_id: number;
    name: string;
    type: string;
}

interface TopologyMapping {
	mapping_id: number;
	router_id: string;
	olt_node_id: number;
	odc_node_id: number;
	odp_node_id: number;
	router?: {
		router_name: string;
	};
	olt_node?: {
		name: string;
	};
	odc_node?: {
		name: string;
	};
	odp_node?: {
		name: string;
	};
}

const MappingListScreen: React.FC = () => {
    const [mappings, setMappings] = useState<TopologyMapping[]>([]);
    const [filtered, setFiltered] = useState<TopologyMapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [modalOpen, setModalOpen] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [selectedMappingId, setSelectedMappingId] = useState<number | null>(null);

    // Form inputs
    const [selectedRouter, setSelectedRouter] = useState('');
    const [selectedOLT, setSelectedOLT] = useState<number | ''>('');
    const [selectedODC, setSelectedODC] = useState<number | ''>('');
    const [selectedODP, setSelectedODP] = useState<number | ''>('');

    // Dropdown options loaded from server
    const [routers, setRouters] = useState<RouterOption[]>([]);
    const [olts, setOlts] = useState<NetworkNode[]>([]);
    const [odcs, setOdcs] = useState<NetworkNode[]>([]);
    const [odps, setOdps] = useState<NetworkNode[]>([]);

    const [modalSubmitting, setModalSubmitting] = useState(false);

    const loadMappings = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/mappings');
            if (res.data.status === 'success') {
                setMappings(res.data.data || []);
            }
        } catch (err) {
            Swal.fire('Error', 'Gagal memuat data pemetaan jaringan.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadDropdownOptions = async () => {
        try {
            // Load routers
            const routerRes = await api.get('/api/routers');
            if (routerRes.data.status === 'success') {
                setRouters(routerRes.data.data || []);
            }

            // Load topology nodes
            const topoRes = await api.get('/api/topology');
            if (topoRes.data.status === 'success') {
                const nodes: NetworkNode[] = topoRes.data.data.nodes || [];
                setOlts(nodes.filter(n => n.type === 'OLT'));
                setOdcs(nodes.filter(n => n.type === 'ODC'));
                setOdps(nodes.filter(n => n.type === 'ODP'));
            }
        } catch (err) {
            console.error('Gagal memuat opsi pilihan untuk pemetaan:', err);
        }
    };

    useEffect(() => {
        loadMappings();
        loadDropdownOptions();
    }, []);

    // Filter by search query
    useEffect(() => {
        let result = [...mappings];
        const q = searchQuery.toLowerCase();
        if (q) {
            result = result.filter(m =>
                m.router?.router_name.toLowerCase().includes(q) ||
                m.olt_node?.name.toLowerCase().includes(q) ||
                m.odc_node?.name.toLowerCase().includes(q) ||
                m.odp_node?.name.toLowerCase().includes(q)
            );
        }
        setFiltered(result);
    }, [mappings, searchQuery]);

    const handleExport = () => {
        if (filtered.length === 0) {
            Swal.fire('Data Kosong', 'Tidak ada data pemetaan yang bisa diexport.', 'warning');
            return;
        }

        // CSV Header
        const headers = ['No', 'Mikrotik (Core Router)', 'OLT Node', 'ODC Node', 'ODP Node (Area FAT)'];
        
        // CSV Rows
        const rows = filtered.map((m, idx) => [
            idx + 1,
            m.router?.router_name || 'Tidak Terhubung',
            m.olt_node?.name || '-',
            m.odc_node?.name || '-',
            m.odp_node?.name || '-'
        ]);

        // Merge headers and rows
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        // Create Blob and Download
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Pemetaan_Jaringan_FTTH_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Data pemetaan berhasil diexport!',
            showConfirmButton: false,
            timer: 2000
        });
    };

    const handleOpenAddModal = () => {
        setIsEdit(false);
        setSelectedMappingId(null);
        setSelectedRouter('');
        setSelectedOLT('');
        setSelectedODC('');
        setSelectedODP('');
        setModalOpen(true);
    };

    const handleOpenEditModal = (mapping: TopologyMapping) => {
        setIsEdit(true);
        setSelectedMappingId(mapping.mapping_id);
        setSelectedRouter(mapping.router_id);
        setSelectedOLT(mapping.olt_node_id);
        setSelectedODC(mapping.odc_node_id);
        setSelectedODP(mapping.odp_node_id);
        setModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRouter || !selectedOLT || !selectedODC || !selectedODP) {
            Swal.fire('Form Belum Lengkap', 'Silakan pilih Router, OLT, ODC, dan ODP terlebih dahulu.', 'warning');
            return;
        }

        setModalSubmitting(true);
        try {
            const payload = {
                router_id: selectedRouter,
                olt_node_id: Number(selectedOLT),
                odc_node_id: Number(selectedODC),
                odp_node_id: Number(selectedODP)
            };

            let res;
            if (isEdit && selectedMappingId) {
                res = await api.put(`/api/mappings/${selectedMappingId}`, payload);
            } else {
                res = await api.post('/api/mappings', payload);
            }

            if (res.data.status === 'success') {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: isEdit ? 'Pemetaan berhasil diperbarui!' : 'Pemetaan baru berhasil ditambahkan!',
                    showConfirmButton: false,
                    timer: 2000
                });
                setModalOpen(false);
                loadMappings();
            } else {
                Swal.fire('Gagal', res.data.message || 'Gagal menyimpan pemetaan.', 'error');
            }
        } catch (err: any) {
            Swal.fire('Error', err.response?.data?.message || 'Terjadi kesalahan pada server.', 'error');
        } finally {
            setModalSubmitting(false);
        }
    };

    const handleDelete = async (id: number, name: string) => {
        const result = await Swal.fire({
            title: 'Hapus Pemetaan?',
            text: `Apakah Anda yakin ingin menghapus pemetaan jaringan untuk ODP "${name}"? Pelanggan di area ini tidak akan bisa terpetakan otomatis.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f43f5e',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            try {
                const res = await api.delete(`/api/mappings/${id}`);
                if (res.data.status === 'success') {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: 'Pemetaan berhasil dihapus!',
                        showConfirmButton: false,
                        timer: 2000
                    });
                    loadMappings();
                } else {
                    Swal.fire('Gagal', res.data.message || 'Gagal menghapus data.', 'error');
                }
            } catch (err: any) {
                Swal.fire('Error', err.response?.data?.message || 'Terjadi kesalahan server.', 'error');
            }
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
                <div>
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <ShareNetwork size={28} weight="fill" className="text-indigo-400" />
                        Pemetaan Jalur Jaringan (Mapping)
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                        Hubungkan Mikrotik Core ke OLT, ODC, dan ODP/FAT secara terstruktur. Pelanggan baru otomatis terpetakan ketika areanya dipilih.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3 shrink-0">
                    <button
                        onClick={handleExport}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold transition text-xs flex items-center gap-1.5 active:scale-95 shadow-md shadow-emerald-500/10"
                    >
                        <DownloadSimple size={16} weight="bold" /> Export CSV
                    </button>
                    <button
                        onClick={handleOpenAddModal}
                        className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition text-xs flex items-center gap-1.5 active:scale-95 shadow-md shadow-sky-500/10 shrink-0"
                    >
                        <Plus size={16} weight="bold" /> Tambah Pemetaan
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="relative">
                    <MagnifyingGlass className="absolute inset-y-0 left-0 h-full w-5 text-slate-400 ml-3.5" />
                    <input
                        type="text"
                        placeholder="Cari berdasarkan nama ODP, ODC, OLT, atau Mikrotik..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:bg-white transition-all font-semibold text-slate-700"
                    />
                </div>
            </div>

            {/* Main Mappings Table */}
            <div className="bg-white border border-slate-200 shadow-md rounded-2xl overflow-hidden transition-all duration-300">
                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                        <Spinner className="animate-spin text-sky-500 mb-3" size={32} />
                        <span className="font-semibold text-sm">Sedang memuat data pemetaan...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-400 text-center px-4">
                        <ShareNetwork size={48} className="text-slate-300 mb-3" weight="duotone" />
                        <h4 className="font-bold text-slate-700 text-base">Belum Ada Pemetaan Jalur</h4>
                        <p className="text-xs text-slate-400 max-w-sm mt-1">
                            Anda belum mendefinisikan pemetaan dari Mikrotik Core ke ODP. Buat pemetaan pertama agar sistem pencatatan pelanggan Anda berjalan otomatis.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-4 px-6">No.</th>
                                    <th className="py-4 px-6">Mikrotik (Core Router)</th>
                                    <th className="py-4 px-6">OLT Node</th>
                                    <th className="py-4 px-6">ODC Node</th>
                                    <th className="py-4 px-6">ODP Node (Area FAT)</th>
                                    <th className="py-4 px-6 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                                {filtered.map((mapping, idx) => (
                                    <tr key={mapping.mapping_id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="py-4 px-6 text-slate-400 font-mono text-xs">{idx + 1}</td>
                                        
                                        {/* Mikrotik */}
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <Cpu size={16} className="text-purple-500" weight="fill" />
                                                <span className="font-bold text-slate-800">{mapping.router?.router_name || 'Tidak Terhubung'}</span>
                                            </div>
                                        </td>

                                        {/* OLT */}
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <Database size={16} className="text-red-500" weight="fill" />
                                                <span className="font-semibold text-slate-700">{mapping.olt_node?.name || '-'}</span>
                                            </div>
                                        </td>

                                        {/* ODC */}
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <HardDrives size={16} className="text-orange-500" weight="fill" />
                                                <span className="font-semibold text-slate-700">{mapping.odc_node?.name || '-'}</span>
                                            </div>
                                        </td>

                                        {/* ODP */}
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <Broadcast size={16} className="text-blue-500" weight="fill" />
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-50 border border-sky-100 text-sky-700 font-bold text-[10px]">
                                                    📍 {mapping.odp_node?.name || '-'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="py-4 px-6">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={() => handleOpenEditModal(mapping)}
                                                    className="p-2 bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-500 hover:text-sky-600 rounded-xl transition active:scale-95"
                                                    title="Ubah Pemetaan"
                                                >
                                                    <PencilLine size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(mapping.mapping_id, mapping.odp_node?.name || 'Mapping')}
                                                    className="p-2 bg-slate-50 border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition active:scale-95"
                                                    title="Hapus Pemetaan"
                                                >
                                                    <Trash size={16} />
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

            {/* MODAL: ADD / EDIT MAPPING */}
            {modalOpen && (
                <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center z-[999] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 max-w-lg w-full relative shadow-2xl space-y-6 border border-slate-100 animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => setModalOpen(false)}
                            className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-full transition"
                        >
                            <X size={16} weight="bold" />
                        </button>

                        <div>
                            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
                                <ShareNetwork size={20} className="text-sky-500" />
                                {isEdit ? 'Ubah Jalur Pemetaan Jaringan' : 'Tambah Jalur Pemetaan Jaringan'}
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-1">
                                Tentukan hierarki koneksi perangkat dari Core Router hingga ke ODP tingkat pelanggan.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Mikrotik Select */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">1. Mikrotik (Core Router)</label>
                                <select
                                    value={selectedRouter}
                                    onChange={(e) => setSelectedRouter(e.target.value)}
                                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-700 bg-white"
                                >
                                    <option value="">-- Pilih Router Penampung --</option>
                                    {routers.map(r => (
                                        <option key={r.router_id} value={r.router_id}>{r.router_name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* OLT Select */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">2. Node OLT</label>
                                <select
                                    value={selectedOLT}
                                    onChange={(e) => setSelectedOLT(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-700 bg-white"
                                >
                                    <option value="">-- Pilih Node OLT --</option>
                                    {olts.map(o => (
                                        <option key={o.node_id} value={o.node_id}>{o.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ODC Select */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">3. Node ODC (Cabinet)</label>
                                <select
                                    value={selectedODC}
                                    onChange={(e) => setSelectedODC(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-700 bg-white"
                                >
                                    <option value="">-- Pilih Node ODC --</option>
                                    {odcs.map(odc => (
                                        <option key={odc.node_id} value={odc.node_id}>{odc.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ODP Select */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">4. Node ODP (Area FAT / Ujung Pelanggan)</label>
                                <select
                                    value={selectedODP}
                                    onChange={(e) => setSelectedODP(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-700 bg-white"
                                >
                                    <option value="">-- Pilih Node ODP (FAT) --</option>
                                    {odps.map(odp => (
                                        <option key={odp.node_id} value={odp.node_id}>{odp.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Visual Flow Preview */}
                            {(selectedRouter || selectedOLT || selectedODC || selectedODP) && (
                                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block">Pratinjau Aliran Sinyal Jaringan</span>
                                    <div className="flex items-center flex-wrap gap-2 text-[10px] font-bold text-slate-700">
                                        <div className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-1 rounded">
                                            {routers.find(r => r.router_id === selectedRouter)?.router_name || '?'}
                                        </div>
                                        <ArrowRight size={10} className="text-slate-400 flex-shrink-0" />
                                        <div className="bg-red-50 text-red-700 border border-red-100 px-2 py-1 rounded">
                                            {olts.find(o => o.node_id === selectedOLT)?.name || '?'}
                                        </div>
                                        <ArrowRight size={10} className="text-slate-400 flex-shrink-0" />
                                        <div className="bg-orange-50 text-orange-700 border border-orange-100 px-2 py-1 rounded">
                                            {odcs.find(o => o.node_id === selectedODC)?.name || '?'}
                                        </div>
                                        <ArrowRight size={10} className="text-slate-400 flex-shrink-0" />
                                        <div className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded">
                                            {odps.find(o => o.node_id === selectedODP)?.name || '?'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-500 py-3 rounded-xl font-bold text-xs transition active:scale-95"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={modalSubmitting}
                                    className="flex-1 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white py-3 rounded-xl font-black text-xs shadow-md shadow-sky-500/10 transition flex items-center justify-center gap-1.5 active:scale-95"
                                >
                                    {modalSubmitting ? (
                                        <><Spinner className="animate-spin" size={14} /> Memproses...</>
                                    ) : (
                                        'Simpan Pemetaan'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MappingListScreen;
