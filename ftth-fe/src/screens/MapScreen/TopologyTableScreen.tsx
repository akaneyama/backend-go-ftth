import React, { useState, useEffect } from 'react';
import api from '../../api/AxiosInstance';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import {
    MagnifyingGlass,
    DownloadSimple,
    MapPin,
    PlugsConnected,
    Funnel,
} from '@phosphor-icons/react';

// --- TYPES ---
interface NodeRow {
    node_id: number;
    name: string;
    type: string;
    lat: number;
    lng: number;
    description: string;
    status: string;
    total_ports?: number;
    used_ports?: number;
    brand?: string;
    uplink_type?: string;
    ip_address?: string;
    capacity?: number;
    subscriber_id?: string;
    packet_name?: string;
    linked_router_id?: string;
    cable_count: number;
}

interface CableRow {
    cable_id: number;
    source_name: string;
    target_name: string;
    cable_type: string;
    description: string;
    length_meter: number;
}

interface SummaryData {
    total_nodes: number;
    total_cables: number;
}

// --- TYPE COLOR MAP ---
const typeColors: Record<string, string> = {
    OLT: 'bg-red-100 text-red-700',
    ODC: 'bg-orange-100 text-orange-700',
    ODP: 'bg-blue-100 text-blue-700',
    CLIENT: 'bg-green-100 text-green-700',
    ROUTER: 'bg-purple-100 text-purple-700',
    TB: 'bg-slate-100 text-slate-700',
};

// ==========================================
// MAIN COMPONENT
// ==========================================
const TopologyTableScreen: React.FC = () => {
    const [nodes, setNodes] = useState<NodeRow[]>([]);
    const [cables, setCables] = useState<CableRow[]>([]);
    const [summary, setSummary] = useState<SummaryData>({ total_nodes: 0, total_cables: 0 });
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchNode, setSearchNode] = useState('');
    const [searchCable, setSearchCable] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [activeTab, setActiveTab] = useState<'nodes' | 'cables'>('nodes');

    // Fetch
    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/topology/table');
            if (res.data.status === 'success') {
                setNodes(res.data.data.nodes || []);
                setCables(res.data.data.cables || []);
                setSummary(res.data.data.summary || { total_nodes: 0, total_cables: 0 });
            }
        } catch (err) {
            console.error(err);
            Swal.fire({ toast: true, icon: 'error', title: 'Gagal memuat data', position: 'top-end' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // --- FILTERED DATA ---
    const filteredNodes = nodes.filter(n => {
        const matchSearch = n.name.toLowerCase().includes(searchNode.toLowerCase()) ||
            n.description?.toLowerCase().includes(searchNode.toLowerCase());
        const matchType = filterType === 'ALL' || n.type === filterType;
        return matchSearch && matchType;
    });

    const filteredCables = cables.filter(c =>
        c.source_name.toLowerCase().includes(searchCable.toLowerCase()) ||
        c.target_name.toLowerCase().includes(searchCable.toLowerCase()) ||
        c.cable_type?.toLowerCase().includes(searchCable.toLowerCase())
    );

    // --- SUMMARY CARDS ---
    const typeCounts = nodes.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // --- EXPORT EXCEL ---
    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Nodes
        const nodeData = filteredNodes.map(n => ({
            'ID': n.node_id,
            'Nama': n.name,
            'Tipe': n.type,
            'Status': n.status,
            'Latitude': n.lat,
            'Longitude': n.lng,
            'Deskripsi': n.description || '-',
            'Total Port (ODP)': n.total_ports || '-',
            'Port Terpakai (ODP)': n.used_ports || '-',
            'Brand OLT': n.brand || '-',
            'Uplink OLT': n.uplink_type || '-',
            'IP OLT': n.ip_address || '-',
            'Kapasitas ODC (Core)': n.capacity || '-',
            'ID Pelanggan (Client)': n.subscriber_id || '-',
            'Paket Internet (Client)': n.packet_name || '-',
            'Linked Router ID': n.linked_router_id || '-',
            'Jumlah Kabel': n.cable_count,
        }));
        const wsNodes = XLSX.utils.json_to_sheet(nodeData);
        // Set column widths
        wsNodes['!cols'] = [
            { wch: 6 }, { wch: 25 }, { wch: 10 }, { wch: 10 },
            { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 15 },
            { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
            { wch: 20 }, { wch: 22 }, { wch: 22 }, { wch: 36 },
            { wch: 15 },
        ];
        XLSX.utils.book_append_sheet(wb, wsNodes, 'Data Node');

        // Sheet 2: Cables
        const cableData = filteredCables.map(c => ({
            'ID': c.cable_id,
            'Dari': c.source_name,
            'Ke': c.target_name,
            'Tipe Kabel': c.cable_type || '-',
            'Deskripsi': c.description || '-',
            'Panjang (m)': c.length_meter || 0,
        }));
        const wsCables = XLSX.utils.json_to_sheet(cableData);
        wsCables['!cols'] = [
            { wch: 6 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 12 },
        ];
        XLSX.utils.book_append_sheet(wb, wsCables, 'Data Kabel');

        // Sheet 3: Summary
        const summaryData = [
            { 'Kategori': 'Total Node', 'Jumlah': summary.total_nodes },
            { 'Kategori': 'Total Kabel', 'Jumlah': summary.total_cables },
            ...Object.entries(typeCounts).map(([type, count]) => ({
                'Kategori': `Node ${type}`, 'Jumlah': count,
            })),
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 20 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

        // Download
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Data_Topologi_FTTH_${dateStr}.xlsx`);
        Swal.fire({ toast: true, icon: 'success', title: 'File Excel berhasil diunduh!', position: 'top-end', timer: 2000 });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Data Topologi Jaringan</h1>
                    <p className="text-sm text-slate-500 mt-1">Tabel lengkap semua node dan kabel jaringan FTTH</p>
                </div>
                <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all hover:shadow-md"
                >
                    <DownloadSimple size={18} weight="bold" />
                    Export Excel
                </button>
            </div>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: 'Total Node', value: summary.total_nodes, color: 'bg-sky-50 text-sky-700 border-sky-200' },
                    { label: 'Total Kabel', value: summary.total_cables, color: 'bg-slate-50 text-slate-700 border-slate-200' },
                    { label: 'OLT', value: typeCounts['OLT'] || 0, color: 'bg-red-50 text-red-700 border-red-200' },
                    { label: 'ODC', value: typeCounts['ODC'] || 0, color: 'bg-orange-50 text-orange-700 border-orange-200' },
                    { label: 'ODP', value: typeCounts['ODP'] || 0, color: 'bg-blue-50 text-blue-700 border-blue-200' },
                    { label: 'Client', value: typeCounts['CLIENT'] || 0, color: 'bg-green-50 text-green-700 border-green-200' },
                ].map(card => (
                    <div key={card.label} className={`p-3 rounded-xl border ${card.color} transition-all hover:shadow-sm`}>
                        <div className="text-2xl font-bold">{card.value}</div>
                        <div className="text-xs font-medium mt-0.5 opacity-80">{card.label}</div>
                    </div>
                ))}
            </div>

            {/* TAB SWITCH */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('nodes')}
                    className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'nodes' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <MapPin size={16} /> Node ({filteredNodes.length})
                </button>
                <button
                    onClick={() => setActiveTab('cables')}
                    className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'cables' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <PlugsConnected size={16} /> Kabel ({filteredCables.length})
                </button>
            </div>

            {/* === NODES TABLE === */}
            {activeTab === 'nodes' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Search + Filter */}
                    <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Cari nama node..."
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                value={searchNode}
                                onChange={(e) => setSearchNode(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Funnel size={16} className="text-slate-400" />
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                                <option value="ALL">Semua Tipe</option>
                                <option value="OLT">OLT</option>
                                <option value="ODC">ODC</option>
                                <option value="ODP">ODP</option>
                                <option value="ROUTER">Router</option>
                                <option value="TB">TB</option>
                                <option value="CLIENT">Client</option>
                            </select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-left whitespace-nowrap">
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">ID</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Nama</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Tipe</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Latitude</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Longitude</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Port</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Brand</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Kabel</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Deskripsi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
                                {filteredNodes.length === 0 ? (
                                    <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">Tidak ada data ditemukan</td></tr>
                                ) : (
                                    filteredNodes.map(node => (
                                        <tr key={node.node_id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">{node.node_id}</td>
                                            <td className="px-4 py-3 font-semibold text-slate-800">{node.name}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${typeColors[node.type] || 'bg-slate-100 text-slate-600'}`}>
                                                    {node.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 text-xs font-medium ${node.status === 'ONLINE' ? 'text-green-600' : 'text-red-500'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                    {node.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">{node.lat?.toFixed(6)}</td>
                                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">{node.lng?.toFixed(6)}</td>
                                            <td className="px-4 py-3 text-slate-600 text-xs">
                                                {node.total_ports ? (
                                                    <span className={node.used_ports! >= node.total_ports ? 'text-red-600 font-bold' : ''}>
                                                        {node.used_ports}/{node.total_ports}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 text-xs">{node.brand || '-'}</td>
                                            <td className="px-4 py-3 text-slate-600 text-xs font-medium">{node.cable_count}</td>
                                            <td className="px-4 py-3 text-slate-400 text-xs max-w-[200px] truncate">{node.description || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* --- MOBILE CARD VIEW (NODES) --- */}
                    <div className="lg:hidden divide-y divide-slate-100">
                        {filteredNodes.length === 0 ? (
                            <div className="px-4 py-8 text-center text-slate-400 text-xs">Tidak ada data ditemukan</div>
                        ) : (
                            filteredNodes.map(node => (
                                <div key={node.node_id} className="p-4 space-y-3 hover:bg-slate-50 transition-colors">
                                    <div className="flex justify-between items-start gap-2">
                                        <div>
                                            <div className="font-semibold text-slate-800 text-sm">{node.name}</div>
                                            <div className="text-slate-500 font-mono text-[10px]">ID: {node.node_id}</div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${typeColors[node.type] || 'bg-slate-100 text-slate-600'}`}>
                                                {node.type}
                                            </span>
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${node.status === 'ONLINE' ? 'text-green-600' : 'text-red-500'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                {node.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        <div className="space-y-1">
                                            <span className="text-slate-400 block font-semibold">Port:</span>
                                            <span className={`text-slate-700 ${node.total_ports && node.used_ports! >= node.total_ports ? 'text-red-600 font-bold' : ''}`}>
                                                {node.total_ports ? `${node.used_ports}/${node.total_ports}` : '-'}
                                            </span>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <span className="text-slate-400 block font-semibold">Brand/Kabel:</span>
                                            <span className="text-slate-700">{node.brand || '-'} / {node.cable_count} Kabel</span>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-[10px]">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400 font-semibold">Koordinat:</span>
                                            <span className="font-mono text-slate-600">{node.lat?.toFixed(5)}, {node.lng?.toFixed(5)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400 font-semibold">Desc:</span>
                                            <span className="text-slate-500 truncate max-w-[150px]">{node.description || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* === CABLES TABLE === */}
            {activeTab === 'cables' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Search */}
                    <div className="p-4 border-b border-slate-100">
                        <div className="relative max-w-md">
                            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Cari nama node atau tipe kabel..."
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                value={searchCable}
                                onChange={(e) => setSearchCable(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-left whitespace-nowrap">
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">ID</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Dari (Source)</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Ke (Target)</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Tipe Kabel</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Panjang (m)</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Deskripsi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
                                {filteredCables.length === 0 ? (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Tidak ada data ditemukan</td></tr>
                                ) : (
                                    filteredCables.map(cable => (
                                        <tr key={cable.cable_id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">{cable.cable_id}</td>
                                            <td className="px-4 py-3 font-medium text-slate-800">{cable.source_name}</td>
                                            <td className="px-4 py-3 font-medium text-slate-800">{cable.target_name}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                                                    {cable.cable_type || '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 text-xs">{cable.length_meter > 0 ? `${cable.length_meter.toFixed(1)} m` : '-'}</td>
                                            <td className="px-4 py-3 text-slate-400 text-xs max-w-[250px] truncate">{cable.description || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* --- MOBILE CARD VIEW (CABLES) --- */}
                    <div className="lg:hidden divide-y divide-slate-100">
                        {filteredCables.length === 0 ? (
                            <div className="px-4 py-8 text-center text-slate-400 text-xs">Tidak ada data ditemukan</div>
                        ) : (
                            filteredCables.map(cable => (
                                <div key={cable.cable_id} className="p-4 space-y-3 hover:bg-slate-50 transition-colors">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold text-slate-800 text-xs">{cable.source_name}</span>
                                            <span className="text-[10px] text-slate-400 leading-none">➜ ke</span>
                                            <span className="font-bold text-sky-700 text-xs">{cable.target_name}</span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[9px] font-bold">
                                                {cable.cable_type || '-'}
                                            </span>
                                            <span className="text-[10px] font-mono text-slate-500">ID: {cable.cable_id}</span>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-[10px]">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400 font-semibold">Panjang:</span>
                                            <span className="font-semibold text-emerald-600">{cable.length_meter > 0 ? `${cable.length_meter.toFixed(1)} m` : '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400 font-semibold">Desc:</span>
                                            <span className="text-slate-500 truncate max-w-[150px]">{cable.description || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TopologyTableScreen;
