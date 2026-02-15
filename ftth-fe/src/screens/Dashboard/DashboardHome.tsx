import React, { useState, useEffect } from 'react';
import api from '../../api/AxiosInstance';
import { 
    Cloud as RouterIcon, 
    CheckCircle, 
    XCircle, 
    TrendUp, 
    Pulse as Activity
} from "@phosphor-icons/react";
import { 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer 
} from 'recharts';

// --- TYPES ---

interface StatData {
    name: string;
    value: string;
    icon: any; // Menggunakan any agar aman dari isu versi library icon
    color: string;
    bg: string;
}

interface MonitorOption {
    interface_id: number;
    interface_name: string;
    router?: { // Tanda tanya (?) berarti router bisa undefined/null
        router_name: string;
    };
}

interface TrafficPoint {
    time: string;
    download: number;
    upload: number;
    raw_time: Date;
}

const DashboardHome: React.FC = () => {
    // --- STATE ---
    const [stats, setStats] = useState<StatData[]>([
        { name: 'Total Router', value: '0', icon: RouterIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
        { name: 'Router Aktif', value: '0', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
        { name: 'Router Down', value: '0', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
        { name: 'Interface Monitored', value: '0', icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
    ]);

    const [monitors, setMonitors] = useState<MonitorOption[]>([]);
    const [selectedMonitorId, setSelectedMonitorId] = useState<string>('');
    const [trafficData, setTrafficData] = useState<TrafficPoint[]>([]);
    const [lastUpdated, setLastUpdated] = useState<string>('-');

    // --- HELPER: FORMAT BIT SPEED ---
    const formatSpeed = (bits: number): string => {
        if (bits >= 1000000000) return (bits / 1000000000).toFixed(2) + ' Gbps';
        if (bits >= 1000000) return (bits / 1000000).toFixed(2) + ' Mbps';
        if (bits >= 1000) return (bits / 1000).toFixed(0) + ' Kbps';
        return bits + ' bps';
    };

    // --- CUSTOM TOOLTIP FORMATTER ---
    const tooltipFormatter = (value: number): [string, string] => {
        return [formatSpeed(value), '']; 
    };

    // --- 1. FETCH INITIAL DATA ---
    useEffect(() => {
        const fetchInit = async () => {
            try {
                // Pastikan endpoint ini sesuai dengan backend Anda
                const resMonitors = await api.get('/api/interfaces'); 
                if (resMonitors.data.status === 'success') {
                    const data: MonitorOption[] = resMonitors.data.data || [];
                    setMonitors(data);
                    
                    if (data.length > 0) {
                        setSelectedMonitorId(data[0].interface_id.toString());
                    }

                    setStats(prev => prev.map(s => 
                        s.name === 'Interface Monitored' ? { ...s, value: data.length.toString() } : s
                    ));
                }
            } catch (err) {
                console.error("Gagal load init data", err);
            }
        };
        fetchInit();
    }, []);

    // --- 2. POLLING TRAFFIC DATA ---
    useEffect(() => {
        if (!selectedMonitorId) return;

        const fetchTraffic = async () => {
            try {
                // Simulasi Data (Hapus/Ganti dengan API Call jika backend sudah siap)
                const now = new Date();
                const newPoint: TrafficPoint = {
                    time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    raw_time: now,
                    download: Math.floor(Math.random() * (50000000 - 5000000 + 1) + 5000000), 
                    upload: Math.floor(Math.random() * (20000000 - 2000000 + 1) + 2000000),
                };
                
                setTrafficData(prev => {
                    const newData = [...prev, newPoint];
                    return newData.slice(-20); // Keep last 20 points
                });

                setLastUpdated(new Date().toLocaleTimeString());

            } catch (err) {
                console.error("Gagal load traffic", err);
            }
        };

        fetchTraffic();
        const interval = setInterval(fetchTraffic, 3000);

        return () => clearInterval(interval);
    }, [selectedMonitorId]);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
                    Ringkasan Jaringan
                </h2>
                <p className="mt-1 text-sm text-slate-500">Overview status jaringan FTTH Anda hari ini.</p>
            </div>

            {/* Stats Grid */}
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((item) => (
                    <div
                        key={item.name}
                        className="relative overflow-hidden rounded-xl bg-white px-4 pt-5 pb-12 shadow-sm ring-1 ring-slate-200 sm:px-6 sm:pt-6 transition hover:shadow-md hover:-translate-y-1 duration-300"
                    >
                        <dt>
                            <div className={`absolute rounded-lg p-3 ${item.bg}`}>
                                <item.icon className={`h-6 w-6 ${item.color}`} aria-hidden="true" weight="duotone" />
                            </div>
                            <p className="ml-16 truncate text-sm font-medium text-slate-500">{item.name}</p>
                        </dt>
                        <dd className="ml-16 flex items-baseline pb-1 sm:pb-7">
                            <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                        </dd>
                    </div>
                ))}
            </dl>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* --- LIVE TRAFFIC CHART --- */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                        <div>
                            <h3 className="text-base font-bold leading-6 text-slate-900 flex items-center gap-2">
                                <TrendUp className="text-sky-600" size={20} weight="bold"/>
                                Live Traffic Monitor
                            </h3>
                            <p className="text-xs text-slate-400">Update terakhir: {lastUpdated}</p>
                        </div>

                        <div className="w-full sm:w-64">
                            <select 
                                value={selectedMonitorId}
                                onChange={(e) => {
                                    setSelectedMonitorId(e.target.value);
                                    setTrafficData([]); 
                                }}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer"
                            >
                                {monitors.length === 0 && <option value="">Tidak ada monitoring aktif</option>}
                                
                                {/* PERBAIKAN DI SINI: Optional Chaining (?.) dan Fallback */}
                                {monitors.map(m => (
                                    <option key={m.interface_id} value={m.interface_id}>
                                        {/* Jika m.router ada, ambil namanya. Jika null, tampilkan 'Unknown' */}
                                        {m.router?.router_name || 'Unknown Router'} - {m.interface_name}
                                    </option>
                                ))}

                            </select>
                        </div>
                    </div>

                    <div className="h-[350px] w-full">
                        {trafficData.length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={trafficData}
                                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                >
                                    <defs>
                                        <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="time" 
                                        tick={{fontSize: 12, fill: '#64748b'}} 
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis 
                                        tickFormatter={formatSpeed} 
                                        tick={{fontSize: 12, fill: '#64748b'}}
                                        axisLine={false}
                                        tickLine={false}
                                        width={80}
                                    />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        labelStyle={{ color: '#64748b', marginBottom: '0.5rem', fontSize: '0.75rem' }}
                                        formatter={(value: number) => tooltipFormatter(value)}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="download" 
                                        name="Download" 
                                        stroke="#0ea5e9" 
                                        strokeWidth={2}
                                        fillOpacity={1} 
                                        fill="url(#colorDownload)" 
                                        animationDuration={500}
                                        isAnimationActive={false} 
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="upload" 
                                        name="Upload" 
                                        stroke="#22c55e" 
                                        strokeWidth={2}
                                        fillOpacity={1} 
                                        fill="url(#colorUpload)" 
                                        animationDuration={500}
                                        isAnimationActive={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                {monitors.length === 0 ? (
                                    <>
                                        <Activity size={48} className="mb-2 opacity-50"/>
                                        <p>Belum ada interface yang dimonitor.</p>
                                        <p className="text-xs">Masuk ke menu Interface untuk setup.</p>
                                    </>
                                ) : (
                                    <>
                                        <Activity size={48} className="mb-2 animate-bounce opacity-50"/>
                                        <p>Menunggu data traffic...</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex justify-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-sky-500"></span>
                            <span className="text-sm text-slate-600 font-medium">Download</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-green-500"></span>
                            <span className="text-sm text-slate-600 font-medium">Upload</span>
                        </div>
                    </div>
                </div>

                {/* --- ACTIVITY LOG --- */}
                <div className="lg:col-span-1 bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-6 h-fit">
                    <h3 className="text-base font-bold leading-6 text-slate-900 mb-6">Aktivitas Terakhir</h3>
                    <div className="space-y-6">
                        <div className="flex gap-4 relative">
                            <div className="flex-none">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 ring-4 ring-white">
                                    <RouterIcon weight="fill" size={16}/>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Router MikroTik-Core ditambahkan</p>
                                <p className="text-xs text-slate-500 mt-0.5">2 jam yang lalu oleh Admin</p>
                            </div>
                            <div className="absolute left-4 top-8 bottom-[-24px] w-0.5 bg-slate-100 -z-10"></div>
                        </div>

                        <div className="flex gap-4 relative">
                            <div className="flex-none">
                                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 ring-4 ring-white">
                                    <Activity weight="fill" size={16}/>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Alert: Traffic High pada Eth2</p>
                                <p className="text-xs text-slate-500 mt-0.5">4 jam yang lalu • System</p>
                            </div>
                            <div className="absolute left-4 top-8 bottom-[-24px] w-0.5 bg-slate-100 -z-10"></div>
                        </div>

                        <div className="flex gap-4 relative">
                            <div className="flex-none">
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 ring-4 ring-white">
                                    <CheckCircle weight="fill" size={16}/>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">GPON-01 Online Kembali</p>
                                <p className="text-xs text-slate-500 mt-0.5">5 jam yang lalu • System</p>
                            </div>
                        </div>
                    </div>
                    
                    <button className="w-full mt-8 py-2 text-sm text-slate-600 hover:text-sky-600 font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                        Lihat Semua Log
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;