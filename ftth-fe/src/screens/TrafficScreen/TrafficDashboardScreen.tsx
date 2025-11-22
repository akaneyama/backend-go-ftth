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
    // Mengambil daftar nama router unik dari data yang ada untuk dropdown filter
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
    // Filter Utama: Search -> Router -> Tanggal
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

    // --- RENDER ---
    return (
        <div className="min-h-screen flex flex-col space-y-6 pb-24"> 
            
            {/* --- STICKY HEADER --- */}
            <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md border-b border-slate-200 shadow-sm -mx-4 px-4 sm:-mx-8 sm:px-8 py-4 transition-all">
                <div className="flex flex-col gap-4">
                    
                    {/* Baris Atas: Judul & Last Update */}
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
                                <ChartBar className="text-sky-600" weight="duotone"/>
                                Traffic Monitoring
                            </h1>
                            <p className="text-slate-500 text-xs md:text-sm mt-1">
                                Grafik bandwidth real-time & historis.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 self-end md:self-auto">
                             <p className="text-[10px] text-slate-400">
                                Update: <span className="font-mono font-bold text-slate-600">{lastUpdated.toLocaleTimeString('id-ID')}</span>
                             </p>
                             <button onClick={() => fetchData()} disabled={isLoading || isSyncing} className="p-1.5 bg-white border border-slate-300 rounded-md text-slate-400 hover:text-sky-600 transition-all disabled:animate-spin shadow-sm">
                                <ArrowsClockwise size={16} weight="bold" />
                            </button>
                        </div>
                    </div>

                    {/* Baris Bawah: Filters & Actions */}
                    <div className="flex flex-col lg:flex-row gap-3">
                        
                        {/* GROUP FILTER (Search & Select) */}
                        <div className="flex flex-1 flex-col sm:flex-row gap-3">
                            {/* Search Input */}
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <MagnifyingGlass className="text-slate-400" size={18} />
                                </div>
                                <input 
                                    type="text"
                                    placeholder="Cari Interface..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 shadow-sm"
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-red-500">
                                        <XCircle size={16} weight="fill" />
                                    </button>
                                )}
                            </div>

                            {/* Router Filter */}
                            <div className="relative min-w-[180px]">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <RouterIcon className="text-slate-400" size={18} />
                                </div>
                                <select 
                                    value={selectedRouter}
                                    onChange={(e) => setSelectedRouter(e.target.value)}
                                    className="w-full pl-10 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 shadow-sm appearance-none cursor-pointer"
                                >
                                    <option value="all">Semua Router</option>
                                    {uniqueRouters.map(router => (
                                        <option key={router} value={router}>{router}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                                    <Funnel size={14} weight="fill" />
                                </div>
                            </div>
                        </div>

                        {/* GROUP DATE & ACTION */}
                        <div className="flex flex-col sm:flex-row gap-3 lg:border-l lg:border-slate-200 lg:pl-3">
                            {/* Date Picker */}
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-300 focus-within:ring-2 focus-within:ring-sky-500/50 shadow-sm min-w-[160px]">
                                <CalendarDots className="text-slate-400" size={20} />
                                <div className="flex flex-col w-full">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase leading-none">Tanggal</span>
                                    <input 
                                        type="date" 
                                        value={filterDate}
                                        onChange={(e) => setFilterDate(e.target.value)}
                                        className="text-xs font-bold text-slate-700 bg-transparent outline-none p-0 border-none w-full cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Sync Button */}
                            <button 
                                onClick={handleManualSync}
                                disabled={isSyncing || isLoading}
                                className={`flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm whitespace-nowrap
                                ${(isSyncing || isLoading) ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-md active:scale-95'}`}
                            >
                                <CloudArrowDown size={18} className={isSyncing ? "animate-bounce" : ""} weight="bold"/>
                                <span>{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- CONTENT SECTION --- */}
            <div className="px-1">
                
                {/* 1. LOADING STATE */}
                {isLoading && monitoredData.length === 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="bg-white h-[350px] rounded-xl border border-slate-200 p-6 animate-pulse">
                                <div className="flex justify-between mb-8">
                                    <div className="h-6 bg-slate-100 rounded w-1/3"></div>
                                    <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                                </div>
                                <div className="h-[200px] bg-slate-50 rounded-lg flex items-end justify-between px-4 pb-2 gap-2">
                                    {[...Array(10)].map((_, j) => (
                                        <div key={j} className="bg-slate-200 w-full rounded-t" style={{ height: `${Math.random() * 80 + 20}%` }}></div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 2. EMPTY STATE (Data Kosong / Tidak Ditemukan) */}
                {!isLoading && filteredDisplayData.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-slate-300 mx-auto max-w-2xl mt-10">
                        <div className="p-4 bg-slate-50 rounded-full mb-4">
                            <Faders className="text-slate-300" size={48} weight="duotone"/>
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">Tidak ada data ditemukan</h3>
                        <p className="text-slate-500 text-sm mt-1 max-w-md text-center">
                            {monitoredData.length === 0 
                                ? "Belum ada interface yang dimonitor. Silakan tambahkan di menu Manajemen Interface." 
                                : "Tidak ada interface yang cocok dengan filter pencarian atau router yang dipilih."}
                        </p>
                        {(searchTerm || selectedRouter !== 'all') && (
                            <button onClick={() => { setSearchTerm(''); setSelectedRouter('all'); }} className="mt-4 text-sm text-sky-600 font-semibold hover:underline">
                                Reset Filter
                            </button>
                        )}
                    </div>
                )}

                {/* 3. CHART GRID */}
                {!isLoading && filteredDisplayData.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up">
                        {filteredDisplayData.map((item) => (
                            <div key={item.interface_id} className="relative group">
                                <TrafficChart 
                                    data={item.trafficHistory}
                                    title={item.interface_name}
                                    routerName={item.Router?.router_name || 'Unknown Router'}
                                />
                                
                                {/* Overlay jika data kosong untuk TANGGAL TERSEBUT */}
                                {item.trafficHistory.length === 0 && (
                                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-xl z-10 border border-slate-200 m-[1px]">
                                        <div className="bg-white p-4 rounded-full shadow-sm mb-2">
                                            <Funnel size={32} className="text-slate-300" weight="duotone" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-700">Tidak ada history traffic</p>
                                        <p className="text-xs text-slate-500">Pada tanggal: <span className="font-mono font-bold">{filterDate}</span></p>
                                        
                                        {/* Jika hari ini, sarankan sync */}
                                        {filterDate === new Date().toISOString().split('T')[0] && (
                                            <button 
                                                onClick={handleManualSync}
                                                className="mt-3 text-xs text-sky-600 hover:text-sky-700 font-medium underline"
                                            >
                                                Coba Ambil Data Sekarang
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