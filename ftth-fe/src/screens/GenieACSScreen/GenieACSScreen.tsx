import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import api from '../../api/AxiosInstance';
import { 
    MagnifyingGlass, 
    Cloud as RouterIcon, 
    WifiHigh, 
    Thermometer, 
    Clock, 
    Info, 
    WarningCircle,
    CheckCircle,
    HardDrives,
    Lightning,
    LockKey,
    ListBullets,
    ArrowsClockwise
} from '@phosphor-icons/react';

interface DeviceInfo {
    deviceId: string;
    lastInform: string;
    ssid: string;
    ipAddress: string;
    rxPower: string;
    deviceSN: string;
    temp: string;
    ponMode: string;
    macAddress: string;
    manufaktur: string;
    uptime: string;
}

interface HostDevice {
    macAddress: string;
    ipAddress: string;
    hostName: string;
    active: string;
    layer1Interface: string;
}

const GenieACSScreen: React.FC = () => {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<'search' | 'list'>('search');

    // Single Device State
    const [ip, setIp] = useState('');
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Connected Hosts State
    const [hosts, setHosts] = useState<HostDevice[]>([]);
    const [loadingHosts, setLoadingHosts] = useState(false);

    // RX History State
    const [rxHistory, setRxHistory] = useState<any[]>([]);
    const [loadingRxHistory, setLoadingRxHistory] = useState(false);

    // List Devices State
    const [allDevices, setAllDevices] = useState<DeviceInfo[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const [listSearchQuery, setListSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Form state
    const [newSsid, setNewSsid] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [ssidIndex, setSsidIndex] = useState(1);
    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateMessage, setUpdateMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const performSearch = useCallback(async (searchIp: string) => {
        if (!searchIp) return;

        setLoading(true);
        setError(null);
        setDeviceInfo(null);
        setUpdateMessage(null);
        setHosts([]);

        try {
            const response = await api.get(`/api/genie-acs/device?ip=${searchIp}`);
            setDeviceInfo(response.data);
            setNewSsid(response.data.ssid === 'Unknown/Hidden' ? '' : response.data.ssid);
            if (response.data.deviceSN) {
                fetchRxHistory(response.data.deviceSN);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Perangkat tidak ditemukan atau terjadi kesalahan server.');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchHosts = async () => {
        if (!deviceInfo) return;
        setLoadingHosts(true);
        try {
            const response = await api.get(`/api/genie-acs/hosts?deviceId=${deviceInfo.deviceId}`);
            if (response.data.status === 'success') {
                setHosts(response.data.data || []);
            }
        } catch (err: any) {
            setHosts([]);
        } finally {
            setLoadingHosts(false);
        }
    };

    const fetchRxHistory = async (deviceSN: string) => {
        setLoadingRxHistory(true);
        try {
            const response = await api.get(`/api/genie-acs/rx-history?deviceSn=${deviceSN}`);
            if (response.data.status === 'success') {
                setRxHistory(response.data.data || []);
            }
        } catch (err) {
            console.error("Gagal mengambil riwayat RX Power", err);
        } finally {
            setLoadingRxHistory(false);
        }
    };

    const fetchAllDevices = async () => {
        setLoadingList(true);
        setListError(null);
        try {
            const response = await api.get(`/api/genie-acs/devices`);
            if (response.data.status === 'success') {
                setAllDevices(response.data.data || []);
            }
        } catch (err: any) {
            setListError(err.response?.data?.error || 'Gagal memuat daftar perangkat dari GenieACS.');
        } finally {
            setLoadingList(false);
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const queryIp = params.get('ip');
        if (queryIp) {
            setActiveTab('search');
            setIp(queryIp);
            performSearch(queryIp);
        }
    }, [location.search, performSearch]);

    useEffect(() => {
        if (activeTab === 'list' && allDevices.length === 0) {
            fetchAllDevices();
        }
    }, [activeTab]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        performSearch(ip);
    };

    const handleUpdateWifi = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deviceInfo) return;
        if (!newSsid && !newPassword) {
            setUpdateMessage({ type: 'error', text: 'SSID atau Password harus diisi.' });
            return;
        }

        setUpdateLoading(true);
        setUpdateMessage(null);

        try {
            await api.post('/api/genie-acs/wifi', {
                deviceId: deviceInfo.deviceId,
                newSsid,
                newPassword,
                ssidIndex
            });
            setUpdateMessage({ type: 'success', text: 'Tugas konfigurasi WiFi berhasil dikirim ke perangkat.' });
            
            setTimeout(() => {
                performSearch(ip);
            }, 5000);
        } catch (err: any) {
            setUpdateMessage({ type: 'error', text: err.response?.data?.error || 'Gagal mengirim konfigurasi.' });
        } finally {
            setUpdateLoading(false);
        }
    };

    const filteredDevices = allDevices.filter(dev => 
        (dev.deviceSN || '').toLowerCase().includes(listSearchQuery.toLowerCase()) ||
        (dev.ipAddress || '').toLowerCase().includes(listSearchQuery.toLowerCase()) ||
        (dev.ssid || '').toLowerCase().includes(listSearchQuery.toLowerCase()) ||
        (dev.macAddress || '').toLowerCase().includes(listSearchQuery.toLowerCase())
    );

    const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);
    const paginatedDevices = filteredDevices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
                <div>
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <WifiHigh size={28} weight="fill" className="text-sky-400" />
                        Manajemen Modem Pelanggan
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                        Cari informasi detail modem pelanggan, konfigurasi nirkabel, dan pantau semua perangkat yang terhubung melalui GenieACS.
                    </p>
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-1 bg-slate-100/60 p-1.5 rounded-2xl w-fit border border-slate-200/50">
                <button
                    onClick={() => setActiveTab('search')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition duration-200 ${
                        activeTab === 'search'
                            ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    <MagnifyingGlass size={16} weight={activeTab === 'search' ? 'bold' : 'regular'} />
                    Cari & Konfigurasi
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition duration-200 ${
                        activeTab === 'list'
                            ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    <ListBullets size={16} weight={activeTab === 'list' ? 'bold' : 'regular'} />
                    Daftar Semua Modem
                </button>
            </div>

            {activeTab === 'search' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Search Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
                            <div className="relative flex-1">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                    <MagnifyingGlass className="h-5 w-5 text-slate-400" aria-hidden="true" />
                                </div>
                                <input
                                    type="text"
                                    value={ip}
                                    onChange={(e) => setIp(e.target.value)}
                                    placeholder="Masukkan IP Address (Contoh: 192.168.1.100)"
                                    className="block w-full rounded-xl border-0 py-3 pl-11 pr-4 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6 transition-shadow"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                                        Mencari...
                                    </div>
                                ) : (
                                    'Cari Device'
                                )}
                            </button>
                        </form>

                        {error && (
                            <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-3">
                                <WarningCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" weight="fill" />
                                <p className="text-sm text-rose-700">{error}</p>
                            </div>
                        )}
                    </div>

                    {/* Content Section */}
                    {deviceInfo && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Info Panel */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center gap-3">
                                        <div className="p-2 bg-sky-100 rounded-lg">
                                            <RouterIcon className="h-5 w-5 text-sky-600" weight="fill" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900">Informasi Perangkat</h3>
                                            <p className="text-xs text-slate-500">ID: {deviceInfo.deviceId}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="p-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                                            <InfoItem label="Manufaktur & Tipe" value={deviceInfo.manufaktur} icon={<HardDrives size={20} />} />
                                            <InfoItem label="Serial Number" value={deviceInfo.deviceSN} icon={<Info size={20} />} />
                                            <InfoItem label="MAC Address" value={deviceInfo.macAddress} icon={<RouterIcon size={20} />} />
                                            <InfoItem label="IP Address" value={deviceInfo.ipAddress} icon={<Lightning size={20} />} />
                                            <InfoItem label="Uptime" value={deviceInfo.uptime} icon={<Clock size={20} />} />
                                            <InfoItem label="Last Inform" value={deviceInfo.lastInform} icon={<Clock size={20} />} />
                                            <InfoItem label="Suhu Perangkat (Temp)" value={deviceInfo.temp ? `${deviceInfo.temp}°C` : '-'} icon={<Thermometer size={20} />} />
                                            <InfoItem label="RX Power" value={deviceInfo.rxPower ? `${deviceInfo.rxPower} dBm` : '-'} icon={<Lightning size={20} />} />
                                            <InfoItem label="PON Mode" value={deviceInfo.ponMode} icon={<RouterIcon size={20} />} />
                                            <InfoItem label="SSID Saat Ini" value={deviceInfo.ssid} icon={<WifiHigh size={20} />} />
                                        </div>
                                    </div>
                                </div>

                                {/* Connected Devices Panel */}
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-100 rounded-lg">
                                                <HardDrives className="h-5 w-5 text-emerald-600" weight="fill" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-900">Perangkat Terhubung (Hosts)</h3>
                                                <p className="text-xs text-slate-500">Klien WiFi / LAN yang aktif</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={fetchHosts}
                                            disabled={loadingHosts}
                                            className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold transition flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {loadingHosts ? (
                                                <div className="h-3 w-3 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin"></div>
                                            ) : (
                                                <ArrowsClockwise size={14} weight="bold" />
                                            )}
                                            Cek Pengguna
                                        </button>
                                    </div>
                                    <div className="p-0">
                                        {hosts.length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                            <th className="py-3 px-6">Nama Perangkat</th>
                                                            <th className="py-3 px-6">IP Address</th>
                                                            <th className="py-3 px-6">MAC Address</th>
                                                            <th className="py-3 px-6">Status / Interface</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                                                        {hosts.map((host, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                                <td className="py-3 px-6 font-semibold text-slate-900">
                                                                    {host.hostName || 'Unknown Device'}
                                                                </td>
                                                                <td className="py-3 px-6 text-indigo-600 font-bold">{host.ipAddress || '-'}</td>
                                                                <td className="py-3 px-6 font-mono text-slate-500">{host.macAddress}</td>
                                                                <td className="py-3 px-6">
                                                                    <span className={`inline-flex items-center justify-center min-w-[70px] px-2 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase shadow-sm ${host.active === '1' || host.active === 'true' ? 'bg-emerald-500 text-white shadow-emerald-200/50' : 'bg-slate-200 text-slate-600 shadow-slate-200/50'}`}>
                                                                        {host.active === '1' || host.active === 'true' ? 'Online' : 'Offline'}
                                                                    </span>
                                                                    {host.layer1Interface && (
                                                                        <span className="block mt-1 text-[9px] text-slate-400">
                                                                            {host.layer1Interface.includes('WLAN') ? 'WLAN (WiFi)' : 'LAN'}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center text-slate-400 text-sm">
                                                Klik "Cek Pengguna" untuk memuat daftar perangkat yang terhubung.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* RX Power History Chart */}
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
                                    <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-rose-100 rounded-lg">
                                                <Lightning className="h-5 w-5 text-rose-600" weight="fill" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-900">Riwayat Sinyal Optik (RX Power)</h3>
                                                <p className="text-xs text-slate-500">Pemantauan degradasi sinyal dalam 7 hari terakhir</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        {loadingRxHistory ? (
                                            <div className="flex items-center justify-center p-8 gap-3 text-slate-500 text-sm">
                                                <div className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-rose-500 animate-spin"></div>
                                                Memuat data historis...
                                            </div>
                                        ) : rxHistory.length > 0 ? (
                                            <div className="h-[300px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={rxHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                        <XAxis 
                                                            dataKey="recorded_at" 
                                                            tickFormatter={(val) => new Date(val).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} 
                                                            tick={{ fontSize: 10, fill: '#94a3b8' }} 
                                                            axisLine={false} 
                                                            tickLine={false} 
                                                        />
                                                        <YAxis 
                                                            tick={{ fontSize: 10, fill: '#94a3b8' }} 
                                                            axisLine={false} 
                                                            tickLine={false} 
                                                            domain={['auto', 'auto']}
                                                        />
                                                        <RechartsTooltip 
                                                            labelFormatter={(label) => new Date(label).toLocaleString('id-ID')}
                                                            formatter={(value: any) => [`${value} dBm`, 'RX Power']}
                                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                                        />
                                                        <Line type="monotone" dataKey="rx_power" stroke="#f43f5e" strokeWidth={3} dot={{ r: 3, fill: '#f43f5e', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#f43f5e', stroke: '#ffe4e6', strokeWidth: 4 }} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center text-slate-400 text-sm">
                                                Belum ada data historis sinyal untuk perangkat ini.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Action Panel */}
                            <div className="lg:col-span-1">
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-24">
                                    <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center gap-3">
                                        <div className="p-2 bg-indigo-100 rounded-lg">
                                            <WifiHigh className="h-5 w-5 text-indigo-600" weight="fill" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900">Konfigurasi WiFi</h3>
                                            <p className="text-xs text-slate-500">Ubah SSID & Password</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleUpdateWifi} className="p-6 space-y-5">
                                        <div>
                                            <label className="block text-sm font-medium leading-6 text-slate-900">
                                                SSID Baru
                                            </label>
                                            <div className="mt-1 relative">
                                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                    <WifiHigh className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={newSsid}
                                                    onChange={(e) => setNewSsid(e.target.value)}
                                                    className="block w-full rounded-lg border-0 py-2.5 pl-9 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                                    placeholder="Kosongkan jika tidak diubah"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium leading-6 text-slate-900">
                                                Password Baru
                                            </label>
                                            <div className="mt-1 relative">
                                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                    <LockKey className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <input
                                                    type="password"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="block w-full rounded-lg border-0 py-2.5 pl-9 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                                    placeholder="Minimal 8 karakter"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium leading-6 text-slate-900">
                                                Index SSID
                                            </label>
                                            <select
                                                value={ssidIndex}
                                                onChange={(e) => setSsidIndex(Number(e.target.value))}
                                                className="mt-1 block w-full rounded-lg border-0 py-2.5 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                            >
                                                <option value={1}>SSID 1</option>
                                                <option value={2}>SSID 2</option>
                                                <option value={3}>SSID 3</option>
                                                <option value={4}>SSID 4</option>
                                            </select>
                                        </div>

                                        {updateMessage && (
                                            <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                                                updateMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                            }`}>
                                                {updateMessage.type === 'success' ? (
                                                    <CheckCircle className="h-5 w-5 shrink-0" weight="fill" />
                                                ) : (
                                                    <WarningCircle className="h-5 w-5 shrink-0" weight="fill" />
                                                )}
                                                <p>{updateMessage.text}</p>
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={updateLoading || (!newSsid && !newPassword)}
                                            className="w-full inline-flex justify-center items-center rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                                        >
                                            {updateLoading ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                                                    Memproses...
                                                </div>
                                            ) : (
                                                'Update Konfigurasi'
                                            )}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'list' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Daftar Perangkat Terhubung</h2>
                            <p className="text-xs text-slate-500">Seluruh modem yang berhasil terhubung dengan server GenieACS.</p>
                        </div>
                        <button
                            onClick={fetchAllDevices}
                            disabled={loadingList}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-sky-50 hover:border-sky-200 text-slate-600 hover:text-sky-700 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                        >
                            <ArrowsClockwise className={loadingList ? "animate-spin" : ""} size={16} weight="bold" />
                            Refresh Data
                        </button>
                    </div>

                    <div className="px-6 pb-4 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white border-b border-slate-100">
                        <div className="relative w-full sm:max-w-md">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <MagnifyingGlass className="h-4 w-4 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                value={listSearchQuery}
                                onChange={(e) => {
                                    setListSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="block w-full rounded-lg border-0 py-2 pl-9 pr-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 transition-shadow"
                                placeholder="Cari berdasarkan SN, MAC, IP, atau SSID..."
                            />
                        </div>
                        <div className="text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            Total: <span className="text-slate-800 font-bold">{filteredDevices.length}</span> Perangkat
                        </div>
                    </div>
                    
                    {listError && (
                        <div className="m-6 p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-3">
                            <WarningCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" weight="fill" />
                            <p className="text-sm text-rose-700">{listError}</p>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-4 px-6">Identitas Perangkat</th>
                                    <th className="py-4 px-6">Model & Manufaktur</th>
                                    <th className="py-4 px-6">Jaringan / IP</th>
                                    <th className="py-4 px-6">Sinyal / Suhu</th>
                                    <th className="py-4 px-6">SSID Saat Ini</th>
                                    <th className="py-4 px-6">Informasi Sistem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                                {loadingList ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="h-8 w-8 rounded-full border-4 border-slate-200 border-t-sky-500 animate-spin"></div>
                                                <span className="font-semibold">Memuat daftar perangkat...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredDevices.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-400">
                                            <RouterIcon size={32} className="mx-auto mb-2 opacity-50" />
                                            Tidak ada perangkat yang cocok dengan pencarian Anda.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedDevices.map((dev) => {
                                        const isOnline = dev.lastInform ? ((new Date().getTime() - new Date(dev.lastInform).getTime()) / (1000 * 60)) < 30 : false;
                                        return (
                                        <tr key={dev.deviceId} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-slate-800 text-xs block">{dev.deviceSN}</span>
                                                    <span className={`inline-flex items-center justify-center min-w-[50px] px-1.5 py-0.5 rounded-full text-[8px] font-bold tracking-wide uppercase shadow-sm ${isOnline ? 'bg-emerald-500 text-white shadow-emerald-200/50' : 'bg-slate-200 text-slate-600 shadow-slate-200/50'}`}>
                                                        {isOnline ? 'Online' : 'Offline'}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-mono block">{dev.macAddress}</span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="text-xs text-slate-600 block">{dev.manufaktur}</span>
                                                <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 font-bold text-[9px] uppercase tracking-wider">
                                                    PON: {dev.ponMode || '-'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 block w-fit mb-1">{dev.ipAddress}</span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-col gap-1 text-[10px]">
                                                    <span className="flex items-center gap-1"><Lightning size={12} className="text-amber-500"/> RX: {dev.rxPower ? `${dev.rxPower} dBm` : '-'}</span>
                                                    <span className="flex items-center gap-1"><Thermometer size={12} className="text-rose-500"/> Temp: {dev.temp ? `${dev.temp}°C` : '-'}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                                                    <WifiHigh size={14} />
                                                    {dev.ssid}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-col gap-1 text-[10px] text-slate-500">
                                                    <span className="flex items-center gap-1" title="Uptime"><Clock size={12}/> {dev.uptime || '-'}</span>
                                                    <span className="flex items-center gap-1" title="Last Inform"><ArrowsClockwise size={12}/> {dev.lastInform || '-'}</span>
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {!loadingList && totalPages > 1 && (
                        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                Sebelumnya
                            </button>
                            <span className="text-sm font-medium text-slate-500">
                                Halaman <span className="text-slate-800 font-bold">{currentPage}</span> dari {totalPages}
                            </span>
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                Selanjutnya
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const InfoItem = ({ label, value, icon }: { label: string, value: string | undefined, icon: React.ReactNode }) => (
    <div className="flex gap-4">
        <div className="mt-1 shrink-0 text-slate-400">
            {icon}
        </div>
        <div>
            <dt className="text-xs font-medium text-slate-500">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900 break-all">{value || '-'}</dd>
        </div>
    </div>
);

export default GenieACSScreen;
