import React, { useState, useEffect } from 'react';
import api from '../../api/AxiosInstance';
import { useNavigate } from 'react-router-dom';
import { 
    Cloud as RouterIcon, 
    CheckCircle, 
    Users, 
    Globe, 
    ArrowRight,
    MapTrifold,
    Prohibit,
    Table,
    FileText,
    Clock,
    Info,
    Spinner
} from "@phosphor-icons/react";

interface DashboardStats {
	total_router: number;
	active_router: number;
	offline_router: number;
	total_client: number;
	total_olt: number;
	total_odp: number;
	total_odc: number;
	total_cable: number;
}

interface AuditLog {
	log_id: number;
	executor: string;
	log_type: string;
	log_status: string;
	log_description: string;
	created_at: string;
}

const DashboardHome: React.FC = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [currentDate, setCurrentDate] = useState<string>('');

    useEffect(() => {
        // Set formatted local date
        const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        setCurrentDate(new Date().toLocaleDateString('id-ID', options));

        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                // Fetch stats and logs in parallel
                const [resStats, resLogs] = await Promise.all([
                    api.get('/api/dashboard/stats'),
                    api.get('/api/dashboard/logs')
                ]);

                if (resStats.data.status === 'success') {
                    setStats(resStats.data.data);
                }
                if (resLogs.data.status === 'success') {
                    setLogs(resLogs.data.data || []);
                }
            } catch (err) {
                console.error("Gagal memuat data dashboard:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    // Format relative time helper
    const formatRelativeTime = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffMins < 1) return 'Baru saja';
            if (diffMins < 60) return `${diffMins} menit yang lalu`;
            if (diffHours < 24) return `${diffHours} jam yang lalu`;
            if (diffDays === 1) return 'Kemarin';
            return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return dateStr;
        }
    };

    if (loading) {
        return (
            <div className="h-[75vh] flex flex-col items-center justify-center text-slate-400">
                <Spinner size={40} className="animate-spin text-sky-500 mb-3" />
                <span className="font-semibold text-slate-600 animate-pulse">Menghubungkan ke server FTTH...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in font-sans w-full">
            
            {/* 1. PREMIUM WELCOME HEADER CARD */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-sky-950 to-indigo-900 p-6 md:p-8 text-white shadow-2xl border border-slate-800">
                <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-80 h-80 rounded-full bg-sky-500/10 blur-3xl" />
                <div className="absolute left-1/3 bottom-0 translate-y-12 w-60 h-60 rounded-full bg-indigo-500/10 blur-3xl" />
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
                            Sistem Manajemen FTTH
                        </span>
                        <h1 className="text-3xl font-extrabold tracking-tight mt-3 text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-sky-200">
                            Selamat Datang kembali, Admin!
                        </h1>
                        <p className="text-slate-300 text-sm mt-1 max-w-xl">
                            Kelola infrastruktur serat optik, pantau topologi, router Mikrotik, dan lakukan isolir pelanggan secara terpusat.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md self-start md:self-auto shadow-inner text-sm font-medium">
                        <Clock size={20} className="text-sky-400" />
                        <span className="text-slate-200">{currentDate}</span>
                    </div>
                </div>
            </div>

            {/* 2. DYNAMIC STATS GRID (REAL DATA) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                
                {/* Total Router */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-sm font-bold uppercase tracking-wider">Total Router</span>
                        <span className="p-2.5 bg-sky-50 text-sky-600 rounded-xl"><RouterIcon size={24} weight="duotone" /></span>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-slate-800">{stats?.total_router || 0}</span>
                        <span className="text-xs text-slate-400 font-semibold">Mikrotik Node</span>
                    </div>
                </div>

                {/* Router Aktif */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-sm font-bold uppercase tracking-wider">Router Online</span>
                        <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle size={24} weight="duotone" /></span>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-emerald-600">{stats?.active_router || 0}</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Active
                        </span>
                    </div>
                </div>

                {/* Total Pelanggan */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-sm font-bold uppercase tracking-wider">Total Pelanggan</span>
                        <span className="p-2.5 bg-orange-50 text-orange-600 rounded-xl"><Users size={24} weight="duotone" /></span>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-slate-800">{stats?.total_client || 0}</span>
                        <span className="text-xs text-slate-400 font-semibold">Rumah (Client)</span>
                    </div>
                </div>

                {/* Infrastruktur Optik */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-sm font-bold uppercase tracking-wider">Node Distribusi</span>
                        <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Globe size={24} weight="duotone" /></span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1">
                        <div className="flex items-baseline gap-1">
                            <span className="font-extrabold text-slate-800 text-xl">{stats?.total_olt || 0}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">OLT</span>
                        </div>
                        <div className="flex items-baseline gap-1 border-l border-slate-200 pl-3">
                            <span className="font-extrabold text-slate-800 text-xl">{stats?.total_odp || 0}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">ODP</span>
                        </div>
                        <div className="flex items-baseline gap-1 border-l border-slate-200 pl-3">
                            <span className="font-extrabold text-slate-800 text-xl">{stats?.total_odc || 0}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">ODC</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* 3. CORE PANEL GRID (QUICK TOOLS ACCESS & RECENT LOGS) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* --- QUICK ACCESS TOOLS (2 COLS) --- */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                            <MapTrifold size={22} className="text-sky-500" /> Pintasan Navigasi & Alat Kerja
                        </h2>
                        <p className="text-slate-400 text-xs mb-6">Akses instan fitur core topologi serat optik dan konfigurasi jaringan Mikrotik Anda.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            
                            {/* Network Map Shortcut */}
                            <div 
                                onClick={() => navigate('/admin/network-map')}
                                className="group relative overflow-hidden bg-slate-50 hover:bg-sky-50/50 border border-slate-200 hover:border-sky-300 p-5 rounded-2xl cursor-pointer transition-all duration-300"
                            >
                                <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 text-sky-500/5 group-hover:scale-110 transition-transform duration-300">
                                    <MapTrifold size={120} weight="fill" />
                                </div>
                                <div className="p-3 bg-sky-100 text-sky-600 rounded-xl w-fit mb-4">
                                    <MapTrifold size={22} weight="bold" />
                                </div>
                                <h3 className="font-bold text-slate-800 group-hover:text-sky-600 transition-colors">Peta Network Optik</h3>
                                <p className="text-slate-400 text-xs mt-1 leading-relaxed">Visualisasi interaktif OLT, ODC, ODP, kabel fiber, dan klik/sentuh peta tambah di HP.</p>
                                <div className="mt-4 flex items-center gap-1.5 text-xs text-sky-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                    Buka Peta <ArrowRight size={14} />
                                </div>
                            </div>

                            {/* Isolir Batch Shortcut */}
                            <div 
                                onClick={() => navigate('/admin/isolir')}
                                className="group relative overflow-hidden bg-slate-50 hover:bg-rose-50/50 border border-slate-200 hover:border-rose-300 p-5 rounded-2xl cursor-pointer transition-all duration-300"
                            >
                                <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 text-rose-500/5 group-hover:scale-110 transition-transform duration-300">
                                    <Prohibit size={120} weight="fill" />
                                </div>
                                <div className="p-3 bg-rose-100 text-rose-600 rounded-xl w-fit mb-4">
                                    <Prohibit size={22} weight="bold" />
                                </div>
                                <h3 className="font-bold text-slate-800 group-hover:text-rose-600 transition-colors">Isolir Batch Excel</h3>
                                <p className="text-slate-400 text-xs mt-1 leading-relaxed">Unggah daftar pelanggan berformat Excel, jalankan isolir massal otomatis & background.</p>
                                <div className="mt-4 flex items-center gap-1.5 text-xs text-rose-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                    Buka Tools <ArrowRight size={14} />
                                </div>
                            </div>

                            {/* Topology Data Table */}
                            <div 
                                onClick={() => navigate('/admin/topology-table')}
                                className="group relative overflow-hidden bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 p-5 rounded-2xl cursor-pointer transition-all duration-300"
                            >
                                <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 text-emerald-500/5 group-hover:scale-110 transition-transform duration-300">
                                    <Table size={120} weight="fill" />
                                </div>
                                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl w-fit mb-4">
                                    <Table size={22} weight="bold" />
                                </div>
                                <h3 className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">Eksplor Data Topologi</h3>
                                <p className="text-slate-400 text-xs mt-1 leading-relaxed">Tabel ringkasan node, manajemen kabel, dan ekspor excel laporan kapasitas ODP.</p>
                                <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                    Buka Tabel <ArrowRight size={14} />
                                </div>
                            </div>

                            {/* Mikrotik Routers */}
                            <div 
                                onClick={() => navigate('/admin/routers')}
                                className="group relative overflow-hidden bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 p-5 rounded-2xl cursor-pointer transition-all duration-300"
                            >
                                <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 text-amber-500/5 group-hover:scale-110 transition-transform duration-300">
                                    <RouterIcon size={120} weight="fill" />
                                </div>
                                <div className="p-3 bg-amber-100 text-amber-600 rounded-xl w-fit mb-4">
                                    <RouterIcon size={22} weight="bold" />
                                </div>
                                <h3 className="font-bold text-slate-800 group-hover:text-amber-600 transition-colors">Mikrotik Router Pool</h3>
                                <p className="text-slate-400 text-xs mt-1 leading-relaxed">Kelola host IP, credentials, status koneksi API/SSL, dan integrasi pool Mikrotik.</p>
                                <div className="mt-4 flex items-center gap-1.5 text-xs text-amber-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                    Atur Router <ArrowRight size={14} />
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                {/* --- OPERATIONAL ACTIVITY LOGS (1 COL) --- */}
                <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col h-full justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                            <FileText size={22} className="text-sky-500" /> Audit Aktivitas
                        </h2>
                        <p className="text-slate-400 text-xs mb-6">Riwayat aksi konfigurasi real-time admin & sistem di database.</p>

                        <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                            {logs.length > 0 ? (
                                logs.map((log) => (
                                    <div key={log.log_id} className="flex gap-3 relative pb-1 border-b border-slate-100 last:border-0 last:pb-0">
                                        <div className="flex-none mt-0.5">
                                            {log.log_status === 'DANGER' || log.log_status === 'DELETE' ? (
                                                <span className="flex w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-100" />
                                            ) : log.log_status === 'SUCCESS' || log.log_status === 'CREATE' ? (
                                                <span className="flex w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                                            ) : (
                                                <span className="flex w-2.5 h-2.5 rounded-full bg-sky-500 ring-4 ring-sky-100" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-slate-700 leading-tight">
                                                {log.log_description}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-semibold">
                                                <span className="text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded uppercase">{log.executor}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-0.5"><Clock size={10} /> {formatRelativeTime(log.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 text-slate-400">
                                    <Info size={32} className="mx-auto mb-2 opacity-45 text-slate-500" />
                                    <span className="text-xs">Belum ada riwayat aktivitas.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <button 
                        onClick={() => navigate('/admin/topology-table')}
                        className="w-full mt-6 py-2.5 text-xs text-slate-600 hover:text-sky-600 font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-1 active:scale-[0.98]"
                    >
                        Eksplor Data Tambahan <ArrowRight size={14} />
                    </button>
                </div>

            </div>

        </div>
    );
};

export default DashboardHome;