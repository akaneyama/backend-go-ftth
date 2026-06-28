import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../api/AxiosInstance';
import TrafficChart from '../../components/Chart/TrafficChart';
import { 
    ArrowsClockwise, 
    ChartBar, 
    Faders,
    CloudArrowDown,
    CalendarDots,
    Funnel,
    MagnifyingGlass,
    Cloud as RouterIcon,
    XCircle
} from "@phosphor-icons/react";
import Swal from 'sweetalert2';

// --- TYPE DEFINITIONS ---
interface InterfaceData {
    interface_id: number;
    interface_name: string;
    Router?: {
        router_name: string;
    };
}

interface TrafficData {
    traffic_id: number;
    interface_id: number;
    DownloadSpeed: number;
    UploadSpeed: number;
    timestamp: string;
}

interface InterfaceWithTraffic extends InterfaceData {
    trafficHistory: TrafficData[];
}

const TrafficDashboardScreen: React.FC = () => {
    // --- STATE MANAGEMENT ---
    const [monitoredData, setMonitoredData] = useState<InterfaceWithTraffic[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    
    // Get User Role
    const token = localStorage.getItem('jwt_token') || '';
    let userRole = 1;
    try {
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userRole = Number(payload.role) || 1;
        }
    } catch (e) {}
    
    // Filter States
    const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRouter, setSelectedRouter] = useState('all');

    const intervalRef = useRef<number | null>(null);

    // --- MAIN FUNCTION: FETCH DATA ---
    const fetchData = async () => {
        if (monitoredData.length === 0) setIsLoading(true);

        try {
            // 1. Ambil List Interface
            const responseInterfaces = await api.get('/api/interfaces');
            if (responseInterfaces.data.status !== 'success') throw new Error("Gagal load interface");
            
            const interfaces: InterfaceData[] = responseInterfaces.data.data || [];

            // 2. Ambil Traffic History (Parallel)
            const promises = interfaces.map(async (iface) => {
                try {
                    const resTraffic = await api.get(`/api/traffic/interface/${iface.interface_id}`);
                    const history = resTraffic.data.data || [];
                    
                    // Sorting berdasarkan Timestamp ASC (Grafik kiri ke kanan)
                    const sortedHistory = history.sort((a: TrafficData, b: TrafficData) => 
                        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    );

                    return {
                        ...iface,
                        trafficHistory: sortedHistory
                    };
                } catch (err) {
                    console.error(`Gagal load traffic interface ID: ${iface.interface_id}`, err);
                    return { ...iface, trafficHistory: [] };
                }
            });

            const results = await Promise.all(promises);
            setMonitoredData(results);
            setLastUpdated(new Date());
            
        } catch (error) {
            console.error("Error fetching dashboard data", error);
        } finally {
            setIsLoading(false);
        }
    };

    // --- FUNCTION: MANUAL SYNC ---
    const handleManualSync = async () => {
        setIsSyncing(true);
        try {
            const response = await api.post('/api/traffic/sync-now');
            
            if (response.data.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'Sinkronisasi Berhasil',
                    text: 'Data traffic terbaru berhasil diambil dari router.',
                    timer: 1500,
                    showConfirmButton: false
                });
                await fetchData();
            }
        } catch (error: any) {
            console.error(error);
            Swal.fire({
                icon: 'error',
                title: 'Gagal Sinkronisasi',
                text: error.response?.data?.message || 'Gagal menghubungi router.'
            });
        } finally {
            setIsSyncing(false);
        }
    };

    // --- HELPER: GET UNIQUE ROUTERS ---
    const uniqueRouters = useMemo(() => {
        const routers = new Set<string>();
        monitoredData.forEach(item => {
            if (item.Router?.router_name) {
                routers.add(item.Router.router_name);
            }
        });
        return Array.from(routers);
    }, [monitoredData]);

    // --- FILTER LOGIC (MEMOIZED) ---
    const filteredDisplayData = useMemo(() => {
        return monitoredData
            // 1. Filter Interface berdasarkan Search & Router
            .filter(item => {
                const matchesSearch = item.interface_name.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesRouter = selectedRouter === 'all' || item.Router?.router_name === selectedRouter;
                return matchesSearch && matchesRouter;
            })
            // 2. Filter History berdasarkan Tanggal
            .map(item => {
                const filteredHistory = item.trafficHistory.filter(traffic => {
                    const trafficDate = traffic.timestamp.split('T')[0]; 
                    return trafficDate === filterDate;
                });

                return {
                    ...item,
                    trafficHistory: filteredHistory
                };
            });
    }, [monitoredData, filterDate, searchTerm, selectedRouter]);

    // --- EFFECT ---
    useEffect(() => {
        fetchData();
        const REFRESH_RATE = 300000; // 5 Menit
        intervalRef.current = window.setInterval(fetchData, REFRESH_RATE);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    return (
        <div className="space-y-6 pb-16">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
                <div>
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <ChartBar size={28} weight="fill" className="text-sky-400 animate-pulse" />
                        Traffic Monitoring
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">Grafik bandwidth real-time & historis router Mikrotik. Pantau lalu lintas data unggah dan unduh pelanggan secara presisi.</p>
                </div>
                <div className="flex items-center gap-3">
                    <p className="text-[10px] text-slate-400 font-bold bg-slate-800/40 border border-slate-700/50 px-3 py-1.5 rounded-xl uppercase tracking-wider">
                        Update: <span className="font-mono text-white">{lastUpdated.toLocaleTimeString('id-ID')}</span>
                    </p>
                    <button 
                        onClick={() => fetchData()} 
                        disabled={isLoading || isSyncing} 
                        className="p-2.5 bg-slate-800 border border-slate-700 hover:border-sky-500 text-slate-300 hover:text-sky-400 rounded-xl transition-all disabled:animate-spin active:scale-95 shadow-sm"
                        title="Perbarui data grafik"
                    >
                        <ArrowsClockwise size={16} weight="bold" />
                    </button>
                </div>
            </div>

            {/* Premium Filter Drawer Box */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
                <div className="flex flex-col lg:flex-row gap-4 items-center">
                    {/* Search Input */}
                    <div className="relative flex-1 w-full">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <MagnifyingGlass className="text-slate-400" size={16} />
                        </div>
                        <input 
                            type="text"
                            placeholder="Cari berdasarkan nama interface..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-xs font-semibold text-slate-700 placeholder:text-slate-450"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-red-500 transition">
                                <XCircle size={16} weight="fill" />
                            </button>
                        )}
                    </div>

                    {/* Router Select Filter */}
                    <div className="relative min-w-[200px] w-full lg:w-auto">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <RouterIcon className="text-slate-400" size={16} />
                        </div>
                        <select 
                            value={selectedRouter}
                            onChange={(e) => setSelectedRouter(e.target.value)}
                            className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-xs font-bold text-slate-650 appearance-none cursor-pointer"
                        >
                            <option value="all">Semua Router</option>
                            {uniqueRouters.map(router => (
                                <option key={router} value={router}>{router}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                            <Funnel size={12} weight="fill" />
                        </div>
                    </div>

                    {/* Date Selector */}
                    <div className="flex items-center gap-2.5 bg-slate-50 px-4 py-1.5 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-sky-500/20 w-full lg:w-auto min-w-[180px]">
                        <CalendarDots className="text-slate-400" size={18} />
                        <div className="flex flex-col w-full">
                            <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider leading-none">Tanggal Monitoring</span>
                            <input 
                                type="date" 
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                                className="text-xs font-bold text-slate-700 bg-transparent outline-none p-0 border-none w-full cursor-pointer mt-0.5"
                            />
                        </div>
                    </div>

                    {/* Sync Button */}
                    {userRole === 1 && (
                        <button 
                            onClick={handleManualSync}
                            disabled={isSyncing || isLoading}
                            className={`flex items-center justify-center gap-1.5 bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all w-full lg:w-auto shadow-md shadow-sky-500/10 active:scale-95
                            ${(isSyncing || isLoading) ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-lg'}`}
                        >
                            <CloudArrowDown size={16} className={isSyncing ? "animate-bounce" : ""} weight="bold"/>
                            <span>{isSyncing ? 'Menghubungkan...' : 'Sinkronisasi Router'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content Chart Lists */}
            <div>
                {/* loading shimmer */}
                {isLoading && monitoredData.length === 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="bg-white h-[350px] rounded-3xl border border-slate-100 p-6 animate-pulse space-y-8">
                                <div className="flex justify-between">
                                    <div className="h-6 bg-slate-100 rounded-xl w-1/3"></div>
                                    <div className="h-4 bg-slate-50 rounded-xl w-1/4"></div>
                                </div>
                                <div className="h-[200px] bg-slate-50 rounded-2xl flex items-end justify-between px-4 pb-2 gap-2">
                                    {[...Array(10)].map((_, j) => (
                                        <div key={j} className="bg-slate-200 w-full rounded-t-lg" style={{ height: `${Math.random() * 80 + 20}%` }}></div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* empty data */}
                {!isLoading && filteredDisplayData.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 mx-auto max-w-2xl mt-6">
                        <div className="p-4 bg-slate-50 rounded-3xl mb-4 text-slate-400">
                            <Faders size={40} weight="fill"/>
                        </div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Data Monitoring Kosong</h3>
                        <p className="text-slate-500 text-xs mt-1 max-w-sm text-center font-medium leading-relaxed">
                            {monitoredData.length === 0 
                                ? "Belum ada interface yang terdaftar untuk dimonitor. Tambahkan interface di menu Manajemen Interface." 
                                : "Tidak ada interface yang cocok dengan nama pencarian atau filter router yang dipilih."}
                        </p>
                        {(searchTerm || selectedRouter !== 'all') && (
                            <button 
                                onClick={() => { setSearchTerm(''); setSelectedRouter('all'); }} 
                                className="mt-4 text-xs text-sky-500 font-bold hover:text-sky-600 transition"
                            >
                                Reset Pencarian
                            </button>
                        )}
                    </div>
                )}

                {/* chart grid view */}
                {!isLoading && filteredDisplayData.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {filteredDisplayData.map((item) => (
                            <div key={item.interface_id} className="relative group">
                                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition">
                                    <TrafficChart 
                                        data={item.trafficHistory}
                                        title={item.interface_name}
                                        routerName={item.Router?.router_name || 'Mikrotik'}
                                    />
                                </div>
                                
                                {/* empty overlay */}
                                {item.trafficHistory.length === 0 && (
                                    <div className="absolute inset-0 bg-white/70 backdrop-blur-[3px] flex flex-col items-center justify-center rounded-3xl z-10 border border-slate-100">
                                        <div className="bg-white p-3.5 rounded-3xl shadow-sm mb-3 text-slate-400">
                                            <Funnel size={28} weight="fill" />
                                        </div>
                                        <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Tidak ada riwayat traffic</p>
                                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">Tanggal: <span className="font-mono">{filterDate}</span></p>
                                        
                                        {filterDate === new Date().toISOString().split('T')[0] && userRole === 1 && (
                                            <button 
                                                onClick={handleManualSync}
                                                className="mt-3 text-[10px] text-sky-500 hover:text-sky-600 font-bold uppercase tracking-wider transition underline"
                                            >
                                                Sync data sekarang
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrafficDashboardScreen;