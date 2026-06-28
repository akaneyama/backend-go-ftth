import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/AxiosInstance';
import Swal from 'sweetalert2';
import { 
    Users, 
    Plus, 
    DownloadSimple, 
    UploadSimple, 
    Trash, 
    PencilLine, 
    MagnifyingGlass, 
    MapPin, 
    Phone, 
    House,
    FileText,
    Info,
    X,
    Spinner,
    CheckCircle,
    ArrowCounterClockwise,
    FolderSimplePlus,
    Tag,
    WifiHigh,
    Eye,
    EyeSlash,
    ArrowsClockwise
} from '@phosphor-icons/react';

interface InternetPackage {
    package_id: number;
    package_name: string;
    package_limit: string;
    package_price: number;
    package_desc: string;
}

interface Client {
    client_id: number;
    name: string;
    phone: string;
    address: string;
    house_photo: string;
    router_id?: string;
    fat: string;
    package_id?: number;
    latitude: number;
    longitude: number;
    ip_address?: string;
    onu_sn?: string;
    pppoe_username?: string;
    pppoe_password?: string;
    rx_power?: string;
    created_at: string;
    router?: {
        router_name: string;
    };
    internet_package?: InternetPackage;
}

interface RouterOption {
    router_id: string;
    router_name: string;
}

const ClientListScreen: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [routers, setRouters] = useState<RouterOption[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    
    // Pagination & Total
    const [page, setPage] = useState<number>(1);
    const [limit, setLimit] = useState<number>(10);
    const [totalClients, setTotalClients] = useState<number>(0);
    const totalPages = Math.ceil(totalClients / limit) || 1;

    // FAT Options
    interface FatOption {
        fat: string;
        count: number;
    }
    const [fats, setFats] = useState<FatOption[]>([]);
    
    // Filters & Search
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedRouter, setSelectedRouter] = useState<string>('');
    const [fatQuery, setFatQuery] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<'active' | 'disconnected'>('active');

    // FAT Custom Combobox State
    const [isFatDropdownOpen, setIsFatDropdownOpen] = useState(false);
    const fatDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (fatDropdownRef.current && !fatDropdownRef.current.contains(event.target as Node)) {
                setIsFatDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    // Import Modal & Dropzone
    const [importOpen, setImportOpen] = useState<boolean>(false);
    const [dragActive, setDragActive] = useState<boolean>(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState<boolean>(false);
    const [previewData, setPreviewData] = useState<any[] | null>(null);
    const [importDefaultRouter, setImportDefaultRouter] = useState<string>('');
    const [importForceSync, setImportForceSync] = useState<boolean>(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // House Photo Modal Preview
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

    // Password Visibility State
    const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());

    const togglePasswordVisibility = (clientId: number) => {
        setVisiblePasswords(prev => {
            const next = new Set(prev);
            if (next.has(clientId)) {
                next.delete(clientId);
            } else {
                next.add(clientId);
            }
            return next;
        });
    };

    const navigate = useNavigate();

    // Get User Role
    const token = localStorage.getItem('jwt_token') || '';
    let userRole = 1;
    try {
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userRole = Number(payload.role) || 1;
        }
    } catch (e) {}

    // Fetch FATs once on mount
    useEffect(() => {
        const fetchFats = async () => {
            try {
                const res = await api.get('/api/clients/fats/list');
                if (res.data.status === 'success') {
                    setFats(res.data.data || []);
                }
            } catch (err) {}
        };
        fetchFats();
    }, []);

    // Load clients and routers
    const loadData = async () => {
        setLoading(true);
        try {
            const clientsRes = await api.get('/api/clients', {
                params: {
                    search: searchQuery,
                    router_id: selectedRouter,
                    fat: fatQuery,
                    status: statusFilter,
                    page: page,
                    limit: limit
                }
            });
            if (clientsRes.data.status === 'success') {
                const resData = clientsRes.data.data;
                if (resData && resData.data !== undefined) {
                    setClients(resData.data || []);
                    setTotalClients(resData.total || 0);
                } else {
                    setClients(resData || []);
                    setTotalClients(resData ? resData.length : 0);
                }
            }

            const routersRes = await api.get('/api/routers');
            if (routersRes.data.status === 'success') {
                setRouters(routersRes.data.data || []);
            }
        } catch (err: any) {
            console.error("Gagal memuat data pelanggan:", err);
            Swal.fire('Error', 'Gagal memuat data dari server.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Reset pagination to 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [searchQuery, selectedRouter, fatQuery, statusFilter, limit]);

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            loadData();
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [searchQuery, selectedRouter, fatQuery, statusFilter, page, limit]);

    // Handle Soft Delete (Putuskan Sambungan)
    const handleDelete = async (id: number, name: string) => {
        const result = await Swal.fire({
            title: 'Putus Layanan Pelanggan?',
            text: `Apakah Anda yakin ingin memutuskan sambungan internet pelanggan "${name}"? Status pelanggan akan menjadi "Terputus" (Soft Delete) dan dapat diaktifkan kembali nanti.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f43f5e',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Putuskan!',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            try {
                const res = await api.delete(`/api/clients/${id}`);
                if (res.data.status === 'success') {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: 'Sambungan Pelanggan Berhasil Diputus!',
                        showConfirmButton: false,
                        timer: 2000
                    });
                    loadData();
                } else {
                    Swal.fire('Gagal', res.data.message || 'Gagal memproses permintaan.', 'error');
                }
            } catch (err: any) {
                Swal.fire('Error', err.response?.data?.message || 'Terjadi kesalahan pada server.', 'error');
            }
        }
    };

    // Handle Restore (Pasang Sambungan Kembali)
    const handleRestore = async (id: number, name: string) => {
        const result = await Swal.fire({
            title: 'Pasang Sambungan Lagi?',
            text: `Aktifkan kembali sambungan internet untuk pelanggan "${name}"? Seluruh foto fisik rumah dan koordinat GPS pelanggan akan dipulihkan secara instan.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0ea5e9',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Aktifkan Kembali!',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            try {
                const res = await api.post(`/api/clients/${id}/restore`);
                if (res.data.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Layanan Aktif Kembali!',
                        text: `Selamat! Layanan pelanggan "${name}" telah aktif kembali dengan sukses.`,
                        confirmButtonColor: '#0ea5e9'
                    });
                    loadData();
                } else {
                    Swal.fire('Gagal', res.data.message || 'Gagal mengaktifkan kembali pelanggan.', 'error');
                }
            } catch (err: any) {
                Swal.fire('Error', err.response?.data?.message || 'Terjadi kesalahan pada server.', 'error');
            }
        }
    };

    // Handle Sync to Mikrotik
    const handleSyncMikrotik = async (id: number, name: string) => {
        const result = await Swal.fire({
            title: 'Sinkronisasi ke Mikrotik?',
            text: `Apakah Anda yakin ingin melakukan sinkronisasi/pembaruan konfigurasi PPPoE pelanggan "${name}" ke Router Mikrotik?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0ea5e9',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Sinkronisasikan!',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            try {
                const res = await api.post(`/api/clients/${id}/sync-mikrotik`);
                if (res.data.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Sinkronisasi Berhasil!',
                        text: res.data.message || `Konfigurasi PPPoE pelanggan "${name}" berhasil disinkronisasikan ke Router Mikrotik.`,
                        confirmButtonColor: '#0ea5e9'
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Gagal Sinkronisasi',
                        text: res.data.message || 'Gagal sinkronisasi data ke Router Mikrotik.',
                        confirmButtonColor: '#0ea5e9'
                    });
                }
            } catch (error: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal',
                    text: error.response?.data?.message || 'Terjadi kesalahan jaringan.',
                    confirmButtonColor: '#0ea5e9'
                });
            }
        }
    };

    // Handle Export to Excel
    const handleExport = () => {
        const baseUrl = api.defaults.baseURL || '';
        const token = localStorage.getItem('jwt_token') || '';
        const exportUrl = `${baseUrl}/api/clients/export?status=${statusFilter}&search=${searchQuery}&router_id=${selectedRouter}&fat=${fatQuery}&token=${encodeURIComponent(token)}`;
        window.open(exportUrl, '_blank');
    };

    // Handle Download Template
    const handleDownloadTemplate = () => {
        const baseUrl = api.defaults.baseURL || '';
        const token = localStorage.getItem('jwt_token') || '';
        const templateUrl = `${baseUrl}/api/clients/import/template?token=${encodeURIComponent(token)}`;
        window.open(templateUrl, '_blank');
    };

    // Handle Drag & Drop Excel Import
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setImportFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setImportFile(e.target.files[0]);
        }
    };

    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    // Submit Excel Import to REST API
    const handleImportSubmit = async (isExecute: boolean = false) => {
        if (!importFile) return;

        const formData = new FormData();
        formData.append('excel_file', importFile);
        if (importDefaultRouter) {
            formData.append('default_router_id', importDefaultRouter);
        }
        formData.append('force_sync_mikrotik', importForceSync.toString());
        
        if (!isExecute) {
            formData.append('preview', 'true');
        }

        setImporting(true);
        try {
            const res = await api.post('/api/clients/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.status === 'success') {
                if (!isExecute) {
                    setPreviewData(res.data.data);
                } else {
                    Swal.fire({
                        icon: 'success',
                        title: 'Impor Sukses!',
                        text: res.data.message || 'Data pelanggan massal berhasil diimpor.',
                        confirmButtonColor: '#0ea5e9'
                    });
                    setImportOpen(false);
                    setImportFile(null);
                    setPreviewData(null);
                    loadData();
                }
            } else {
                Swal.fire('Gagal Impor', res.data.message || 'Gagal memproses file.', 'error');
            }
        } catch (err: any) {
            console.error("Error Detail dari Server (Import):", err.response?.data || err);
            Swal.fire('Error', err.response?.data?.message || 'Terjadi kesalahan jaringan.', 'error');
        } finally {
            setImporting(false);
        }
    };

    const handleCheckGenieACS = async (identifier: string) => {
        Swal.fire({
            title: 'Mencari di GenieACS...',
            text: 'Mohon tunggu sebentar',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const res = await api.get(`/api/genie-acs/device?ip=${identifier}`);
            Swal.close();
            if (res.data && res.data.deviceId) {
                Swal.fire({
                    icon: 'success',
                    title: 'Modem Ditemukan!',
                    text: `Modem ditemukan dengan SN: ${res.data.deviceSN}.`,
                    confirmButtonText: 'Lihat Detail',
                    confirmButtonColor: '#0ea5e9',
                    showCancelButton: true,
                    cancelButtonText: 'Tutup'
                }).then((result) => {
                    if (result.isConfirmed) {
                        navigate(`/admin/genie-acs?ip=${identifier}`);
                    }
                });
            }
        } catch (err: any) {
            Swal.close();
            Swal.fire({
                icon: 'error',
                title: 'Tidak Ditemukan',
                text: 'Modem tidak ditemukan di GenieACS dengan identitas tersebut.',
            });
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
                <div>
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <Users size={28} weight="fill" className="text-sky-400" />
                        Manajemen Pelanggan FTTH
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">Kelola data pelanggan utama CRM, area kotak FAT (ODP), status pemutusan soft delete, serta paket internet secara instan.</p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button 
                        onClick={handleExport}
                        className="bg-white/10 hover:bg-white/20 border border-white/15 px-4 py-2.5 rounded-xl font-semibold transition text-xs flex items-center gap-1.5 active:scale-95 shadow-sm"
                    >
                        <DownloadSimple size={16} weight="bold" /> Ekspor Excel
                    </button>
                    {userRole === 1 && (
                        <>
                            <button 
                                onClick={() => setImportOpen(true)}
                                className="bg-white/10 hover:bg-white/20 border border-white/15 px-4 py-2.5 rounded-xl font-semibold transition text-xs flex items-center gap-1.5 active:scale-95 shadow-sm"
                            >
                                <UploadSimple size={16} weight="bold" /> Impor Excel
                            </button>
                            <button 
                                onClick={() => navigate('/admin/clients/add')}
                                className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition text-xs flex items-center gap-1.5 active:scale-95 shadow-md shadow-sky-500/10"
                            >
                                <Plus size={16} weight="bold" /> Tambah Pelanggan
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* TAB FILTER STATUS PELANGGAN */}
            <div className="flex flex-wrap border-b border-slate-200 gap-1 bg-slate-100/60 p-1.5 rounded-2xl w-fit">
                <button
                    onClick={() => setStatusFilter('active')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition duration-200 ${
                        statusFilter === 'active' 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    Pelanggan Aktif
                </button>
                <button
                    onClick={() => setStatusFilter('disconnected')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition duration-200 ${
                        statusFilter === 'disconnected' 
                            ? 'bg-white text-rose-600 shadow-sm border border-rose-100/50' 
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                    Terputus / Disconnected
                </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Cari Nama */}
                <div className="relative">
                    <MagnifyingGlass className="absolute inset-y-0 left-0 h-full w-5 text-slate-400 ml-3.5" />
                    <input 
                        type="text" 
                        placeholder="Cari nama pelanggan..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:bg-white transition-all font-semibold text-slate-700"
                    />
                </div>
                {/* Filter Router */}
                <div>
                    <select
                        value={selectedRouter}
                        onChange={(e) => setSelectedRouter(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer font-bold text-slate-600 bg-white"
                    >
                        <option value="">Semua Router</option>
                        {routers.map(r => (
                            <option key={r.router_id} value={r.router_id}>{r.router_name}</option>
                        ))}
                    </select>
                </div>
                {/* Cari Area FAT (Custom Combobox) */}
                <div className="relative" ref={fatDropdownRef}>
                    <FolderSimplePlus className="absolute inset-y-0 left-0 h-full w-5 text-slate-400 ml-3.5" />
                    <input
                        type="text"
                        value={fatQuery}
                        onChange={(e) => {
                            setFatQuery(e.target.value);
                            setIsFatDropdownOpen(true);
                        }}
                        onFocus={() => setIsFatDropdownOpen(true)}
                        placeholder="Semua Area FAT / Cari Area..."
                        className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-text font-bold text-slate-600 bg-white"
                    />
                    
                    {/* Dropdown Menu */}
                    {isFatDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto overflow-x-hidden animate-fade-in-up">
                            {/* Option for 'All' */}
                            <div 
                                onClick={() => {
                                    setFatQuery('');
                                    setIsFatDropdownOpen(false);
                                }}
                                className="px-4 py-2.5 text-xs text-slate-600 hover:bg-sky-50 hover:text-sky-700 cursor-pointer border-b border-slate-100 flex items-center justify-between transition-colors"
                            >
                                <span className="font-bold">Semua Area FAT</span>
                            </div>
                            
                            {/* Filtered Options */}
                            {fats.filter(f => f.fat.toLowerCase().includes(fatQuery.toLowerCase())).length > 0 ? (
                                fats.filter(f => f.fat.toLowerCase().includes(fatQuery.toLowerCase())).map(f => (
                                    <div 
                                        key={f.fat} 
                                        onClick={() => {
                                            setFatQuery(f.fat);
                                            setIsFatDropdownOpen(false);
                                        }}
                                        className="px-4 py-2.5 text-xs text-slate-600 hover:bg-sky-50 hover:text-sky-700 cursor-pointer border-b border-slate-50 last:border-0 flex items-center justify-between group transition-colors"
                                    >
                                        <span className="font-semibold group-hover:font-bold truncate pr-2">{f.fat}</span>
                                        <span className="text-[10px] bg-slate-100 group-hover:bg-sky-100 text-slate-500 group-hover:text-sky-600 px-2 py-0.5 rounded-full font-bold transition-colors shrink-0">
                                            {f.count} Klien
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-4 text-center text-xs text-slate-400 italic">
                                    FAT tidak ditemukan
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Total Clients Indicator */}
            <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-bold text-slate-700">Data Pelanggan</h3>
                <div className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm">
                    <Users size={16} weight="duotone" />
                    <span>Total: {totalClients} Pelanggan</span>
                </div>
            </div>

            {/* Main Client Table */}
            <div className="bg-white border border-slate-200 shadow-md rounded-2xl overflow-hidden transition-all duration-300">
                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                        <Spinner className="animate-spin text-sky-500 mb-3" size={32} />
                        <span className="font-semibold text-sm">Sedang memuat data pelanggan...</span>
                    </div>
                ) : clients.length === 0 ? (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-400 text-center px-4">
                        <Users size={48} className="text-slate-300 mb-3" weight="duotone" />
                        <h4 className="font-bold text-slate-700 text-base">
                            {statusFilter === 'active' ? 'Belum Ada Pelanggan Aktif' : 'Tidak Ada Pelanggan Terputus'}
                        </h4>
                        <p className="text-xs text-slate-400 max-w-sm mt-1">
                            {statusFilter === 'active' 
                                ? 'Daftar data pelanggan aktif kosong. Mulai dengan menambahkan pelanggan baru atau mengimpor file Excel.'
                                : 'Selamat! Saat ini tidak ada pelanggan yang diputus layanannya.'
                            }
                        </p>
                    </div>
                ) : (
                    <>
                        {/* --- DESKTOP TABLE VIEW --- */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-4 px-6">Pelanggan</th>
                                    <th className="py-4 px-6">Kontak & Rumah</th>
                                    <th className="py-4 px-6">Identitas ONT & PPPoE</th>
                                    <th className="py-4 px-6">Area FAT (ODP)</th>
                                    <th className="py-4 px-6">Paket Internet</th>
                                    <th className="py-4 px-6">Router Penampung</th>
                                    <th className="py-4 px-6">Koordinat Peta</th>
                                    <th className="py-4 px-6 text-center">Foto</th>
                                    <th className="py-4 px-6 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                                {clients.map(client => (
                                    <tr key={client.client_id} className="hover:bg-slate-50/70 transition-colors">
                                        {/* Name & Avatar */}
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-9 w-9 rounded-xl font-bold flex items-center justify-center text-sm shadow-inner uppercase ${
                                                    statusFilter === 'active' 
                                                        ? 'bg-sky-100 text-sky-700' 
                                                        : 'bg-rose-100 text-rose-700 border border-rose-200/50'
                                                }`}>
                                                    {client.name.substring(0, 2)}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-800 text-sm block leading-snug">{client.name}</span>
                                                    <span className="text-[10px] text-slate-400 block font-normal mt-0.5">ID: #{client.client_id}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Phone & Address */}
                                        <td className="py-4 px-6 space-y-1 whitespace-nowrap">
                                            {client.phone ? (
                                                <div className="flex items-center gap-1 text-slate-600 font-semibold">
                                                    <Phone size={14} className="text-slate-400" />
                                                    <span>{client.phone}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic">Tidak ada kontak</span>
                                            )}
                                            {client.address ? (
                                                <div className="flex items-start gap-1 text-slate-500 leading-snug font-normal text-[11px] max-w-xs">
                                                    <House size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                                    <span className="line-clamp-2">{client.address}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic block">Alamat kosong</span>
                                            )}
                                        </td>

                                        {/* Identitas ONT & PPPoE */}
                                        <td className="py-4 px-6 space-y-1">
                                            {client.onu_sn ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider w-8">SN:</span>
                                                    <span className="font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200/50 font-bold text-[10px]">{client.onu_sn}</span>
                                                </div>
                                            ) : null}
                                            {client.ip_address ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider w-8">IP:</span>
                                                    <span className="font-mono bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded border border-sky-200/50 font-bold text-[10px]">{client.ip_address}</span>
                                                    <a href={`http://${client.ip_address}`} target="_blank" rel="noopener noreferrer" className="ml-1 text-sky-600 hover:text-sky-800" title="Buka Web Router">
                                                        <House size={12} weight="bold" />
                                                    </a>
                                                </div>
                                            ) : null}
                                            {client.pppoe_username ? (
                                                <>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider w-8">User:</span>
                                                        <span className="font-bold text-slate-700 text-[10px] truncate max-w-[120px]">{client.pppoe_username}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider w-8">Pass:</span>
                                                        <span className="font-mono font-bold text-slate-700 text-[10px] truncate max-w-[120px] flex items-center gap-1">
                                                            {visiblePasswords.has(client.client_id) ? (client.pppoe_password || '-') : '••••••••'}
                                                            {client.pppoe_password && (
                                                                <button onClick={() => togglePasswordVisibility(client.client_id)} className="text-slate-400 hover:text-sky-600 focus:outline-none ml-1 transition-colors">
                                                                    {visiblePasswords.has(client.client_id) ? <EyeSlash size={12} weight="bold" /> : <Eye size={12} weight="bold" />}
                                                                </button>
                                                            )}
                                                        </span>
                                                    </div>
                                                </>
                                            ) : null}
                                            {client.rx_power ? (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider w-8">Sinyal:</span>
                                                    <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] border ${
                                                        parseFloat(client.rx_power || '0') < -25 ? 'bg-rose-50 text-rose-700 border-rose-200' : 
                                                        parseFloat(client.rx_power || '0') < -20 ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                                        'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    }`}>
                                                        {client.rx_power} dBm
                                                    </span>
                                                </div>
                                            ) : null}
                                            {!client.onu_sn && !client.ip_address && !client.pppoe_username && (
                                                <span className="text-[10px] text-slate-400 italic">Belum di-set</span>
                                            )}
                                        </td>

                                        {/* Area FAT */}
                                        <td className="py-4 px-6">
                                            {client.fat ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-[10px] shadow-sm uppercase tracking-wider">
                                                    📍 {client.fat}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic bg-slate-50 border border-slate-200/50 px-2 py-0.5 rounded">Belum diisi</span>
                                            )}
                                        </td>

                                        {/* Paket Internet */}
                                        <td className="py-4 px-6">
                                            {client.internet_package ? (
                                                <div className="space-y-0.5">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 font-extrabold text-[10px] uppercase shadow-sm">
                                                        <Tag size={12} weight="bold" />
                                                        {client.internet_package.package_name}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 block font-semibold mt-0.5">
                                                        Rp {client.internet_package.package_price.toLocaleString('id-ID')}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic bg-slate-50 border border-slate-200/50 px-2 py-0.5 rounded">Belum pilih paket</span>
                                            )}
                                        </td>

                                        {/* Connected Router */}
                                        <td className="py-4 px-6">
                                            {client.router ? (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200/50 text-sky-700 font-bold text-[11px]">
                                                    <div className={`h-1.5 w-1.5 rounded-full ${statusFilter === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                                    {client.router.router_name}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded italic">Belum terhubung</span>
                                            )}
                                        </td>

                                        {/* Map Coordinates */}
                                        <td className="py-4 px-6">
                                            {client.latitude && client.longitude ? (
                                                <a 
                                                    href={`https://www.google.com/maps/search/?api=1&query=${client.latitude},${client.longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline font-bold text-[11px]"
                                                >
                                                    <MapPin size={14} weight="fill" className="text-indigo-400" />
                                                    <span>{client.latitude.toFixed(6)}, {client.longitude.toFixed(6)}</span>
                                                </a>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic">Belum disetting</span>
                                            )}
                                        </td>

                                        {/* House Photo Trigger */}
                                        <td className="py-4 px-6 text-center">
                                            {client.house_photo ? (
                                                <button
                                                    onClick={() => setPreviewPhotoUrl(client.house_photo)}
                                                    className="inline-flex items-center justify-center p-1.5 rounded-xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50 text-slate-500 hover:text-sky-600 shadow-sm transition active:scale-95"
                                                    title="Lihat Foto Rumah"
                                                >
                                                    <House size={18} weight="duotone" />
                                                </button>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic">-</span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="py-4 px-6">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {statusFilter === 'active' ? (
                                                    <>
                                                        {userRole === 1 && (
                                                            <button
                                                                onClick={() => navigate(`/admin/clients/edit/${client.client_id}`)}
                                                                className="p-2 bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-500 hover:text-sky-600 rounded-xl transition active:scale-95"
                                                                title="Ubah Data"
                                                            >
                                                                <PencilLine size={16} />
                                                            </button>
                                                        )}
                                                        {(client.ip_address || client.onu_sn || client.pppoe_username) && (
                                                            <button
                                                                onClick={() => handleCheckGenieACS(client.ip_address || client.onu_sn || client.pppoe_username || '')}
                                                                className="p-2 bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-xl transition active:scale-95"
                                                                title="Cek Status Modem (GenieACS)"
                                                            >
                                                                <WifiHigh size={16} />
                                                            </button>
                                                        )}
                                                        {client.router && client.pppoe_username && client.pppoe_password && (
                                                            <button
                                                                onClick={() => handleSyncMikrotik(client.client_id, client.name)}
                                                                className="p-2 bg-slate-50 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 rounded-xl transition active:scale-95"
                                                                title="Sinkronisasi PPPoE ke Mikrotik (Buat/Update)"
                                                            >
                                                                <ArrowsClockwise size={16} />
                                                            </button>
                                                        )}
                                                        {userRole === 1 && (
                                                            <button
                                                                onClick={() => handleDelete(client.client_id, client.name)}
                                                                className="p-2 bg-slate-50 border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition active:scale-95"
                                                                title="Putuskan Sambungan (Soft Delete)"
                                                            >
                                                                <Trash size={16} />
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    userRole === 1 && (
                                                        <button
                                                            onClick={() => handleRestore(client.client_id, client.name)}
                                                            className="px-3 py-1.5 bg-sky-50 border border-sky-200 hover:bg-sky-500 hover:text-white text-sky-700 rounded-xl transition active:scale-95 font-extrabold text-[10px] flex items-center gap-1 shadow-sm"
                                                            title="Pasang Sambungan Baru (Restore)"
                                                        >
                                                            <ArrowCounterClockwise size={12} weight="bold" />
                                                            Pasang Lagi
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* --- MOBILE CARD VIEW --- */}
                    <div className="lg:hidden divide-y divide-slate-100">
                        {clients.map(client => (
                            <div key={client.client_id} className="p-4 space-y-3 hover:bg-slate-50/30 transition">
                                {/* Header: Name, Avatar, Status */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-10 w-10 rounded-xl font-bold flex items-center justify-center text-sm shadow-inner uppercase ${
                                            statusFilter === 'active' 
                                                ? 'bg-sky-100 text-sky-700' 
                                                : 'bg-rose-100 text-rose-700 border border-rose-200/50'
                                        }`}>
                                            {client.name.substring(0, 2)}
                                        </div>
                                        <div>
                                            <p className="font-extrabold text-slate-800 text-sm">{client.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <p className="text-[10px] text-slate-400 font-normal">ID: #{client.client_id}</p>
                                                {client.fat ? (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-[9px] uppercase">
                                                        📍 {client.fat}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Info Grid */}
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                    <div className="space-y-1">
                                        <div className="text-slate-500 font-semibold flex items-center gap-1">
                                            <Phone size={12} className="text-slate-400" />
                                            {client.phone || <span className="italic">Tidak ada kontak</span>}
                                        </div>
                                        <div className="text-slate-500 flex items-start gap-1">
                                            <House size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                            <span className="line-clamp-1">{client.address || <span className="italic">Alamat kosong</span>}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        {client.internet_package ? (
                                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 font-extrabold text-[9px] uppercase">
                                                <Tag size={10} weight="bold" />
                                                {client.internet_package.package_name}
                                            </div>
                                        ) : (
                                            <span className="italic text-slate-400">Belum pilih paket</span>
                                        )}
                                        <div className="text-slate-400 font-semibold mt-0.5">
                                            {client.internet_package ? `Rp ${client.internet_package.package_price.toLocaleString('id-ID')}` : '-'}
                                        </div>
                                    </div>
                                </div>

                                {/* Connectivity Grid */}
                                <div className="bg-slate-50 rounded-xl p-2 space-y-1.5 border border-slate-100">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-slate-400 font-bold">Router:</span>
                                        {client.router ? (
                                            <span className="font-bold text-sky-700 flex items-center gap-1">
                                                <div className={`h-1.5 w-1.5 rounded-full ${statusFilter === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                                {client.router.router_name}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 italic">Belum terhubung</span>
                                        )}
                                    </div>
                                    {client.onu_sn && (
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-400 font-bold">SN ONT:</span>
                                            <span className="font-mono font-bold text-slate-600">{client.onu_sn}</span>
                                        </div>
                                    )}
                                    {client.ip_address && (
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-400 font-bold">IP Address:</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono font-bold text-slate-600">{client.ip_address}</span>
                                                <a href={`http://${client.ip_address}`} target="_blank" rel="noopener noreferrer" className="p-1 text-sky-600 hover:text-sky-800 bg-sky-50 rounded" title="Masuk ke Router">
                                                    <House size={10} weight="bold" />
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                    {client.pppoe_username && (
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-400 font-bold">PPPoE User:</span>
                                            <span className="font-mono font-bold text-slate-600">{client.pppoe_username}</span>
                                        </div>
                                    )}
                                    {client.pppoe_password && (
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-400 font-bold">PPPoE Pass:</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono font-bold text-slate-600">
                                                    {visiblePasswords.has(client.client_id) ? client.pppoe_password : '••••••••'}
                                                </span>
                                                <button onClick={() => togglePasswordVisibility(client.client_id)} className="text-slate-400 hover:text-sky-600 focus:outline-none transition-colors">
                                                    {visiblePasswords.has(client.client_id) ? <EyeSlash size={14} weight="bold" /> : <Eye size={14} weight="bold" />}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {!client.onu_sn && !client.ip_address && !client.pppoe_username && (
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-400 font-bold">IP/SN/PPPoE:</span>
                                            <span className="text-slate-400 italic">Belum di-set</span>
                                        </div>
                                    )}
                                    {client.rx_power && (
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-400 font-bold">Sinyal:</span>
                                            <span className={`font-bold ${
                                                parseFloat(client.rx_power || '0') < -25 ? 'text-rose-600' : 
                                                parseFloat(client.rx_power || '0') < -20 ? 'text-amber-600' : 
                                                'text-emerald-600'
                                            }`}>
                                                {client.rx_power} dBm
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Actions Container */}
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                                    {client.house_photo && (
                                        <button
                                            onClick={() => setPreviewPhotoUrl(client.house_photo)}
                                            className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 flex items-center justify-center transition active:scale-95"
                                            title="Lihat Foto Rumah"
                                        >
                                            <House size={14} weight="duotone" />
                                        </button>
                                    )}
                                    {client.latitude && client.longitude ? (
                                        <a 
                                            href={`https://www.google.com/maps/search/?api=1&query=${client.latitude},${client.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-indigo-600 flex items-center justify-center transition active:scale-95"
                                        >
                                            <MapPin size={14} weight="fill" />
                                        </a>
                                    ) : null}
                                    
                                    <div className="flex-1 flex justify-end gap-1.5 flex-wrap">
                                        {statusFilter === 'active' ? (
                                            <>
                                                {userRole === 1 && (
                                                    <button
                                                        onClick={() => navigate(`/admin/clients/edit/${client.client_id}`)}
                                                        className="px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[10px] font-bold transition active:scale-95"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                                {(client.ip_address || client.onu_sn || client.pppoe_username) && (
                                                    <button
                                                        onClick={() => handleCheckGenieACS(client.ip_address || client.onu_sn || client.pppoe_username || '')}
                                                        className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold transition active:scale-95 flex items-center gap-1"
                                                    >
                                                        <WifiHigh size={12} /> Cek
                                                    </button>
                                                )}
                                                {client.router && client.pppoe_username && client.pppoe_password && (
                                                    <button
                                                        onClick={() => handleSyncMikrotik(client.client_id, client.name)}
                                                        className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold transition active:scale-95 flex items-center gap-1"
                                                    >
                                                        <ArrowsClockwise size={12} /> Sync
                                                    </button>
                                                )}
                                                {userRole === 1 && (
                                                    <button
                                                        onClick={() => handleDelete(client.client_id, client.name)}
                                                        className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold transition active:scale-95"
                                                    >
                                                        Putus
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            userRole === 1 && (
                                                <button
                                                    onClick={() => handleRestore(client.client_id, client.name)}
                                                    className="w-full px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-extrabold flex items-center justify-center gap-1 transition active:scale-95"
                                                >
                                                    <ArrowCounterClockwise size={12} weight="bold" /> Pasang Lagi
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    </>
                )}
            </div>

            {/* Pagination Controls */}
            {clients.length > 0 && totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="text-xs text-slate-500 font-semibold">
                        Menampilkan <span className="text-slate-800 font-bold">{clients.length}</span> dari <span className="text-slate-800 font-bold">{totalClients}</span> pelanggan
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <button 
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs transition"
                        >
                            Prev
                        </button>
                        
                        {/* Pagination Numbers */}
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            // Show around current page logic
                            let p = page;
                            if (totalPages <= 5) {
                                p = i + 1;
                            } else if (page <= 3) {
                                p = i + 1;
                            } else if (page >= totalPages - 2) {
                                p = totalPages - 4 + i;
                            } else {
                                p = page - 2 + i;
                            }

                            return (
                                <button 
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-bold transition ${
                                        page === p 
                                            ? 'bg-sky-500 border-sky-600 text-white shadow-sm' 
                                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    {p}
                                </button>
                            );
                        })}
                        
                        <button 
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs transition"
                        >
                            Next
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-semibold">Tampilkan:</span>
                        <select
                            value={limit}
                            onChange={(e) => setLimit(Number(e.target.value))}
                            className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        >
                            <option value={10}>10</option>
                            <option value={15}>15</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>
            )}


            {/* MODAL 1: PREVIEW FOTO RUMAH */}
            {previewPhotoUrl && (
                <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center z-[999] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-5 max-w-lg w-full relative shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in duration-200">
                        <button 
                            onClick={() => setPreviewPhotoUrl(null)}
                            className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-full transition"
                        >
                            <X size={16} weight="bold" />
                        </button>
                        <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                            <House size={18} className="text-emerald-500" /> Detail Foto Fisik Rumah Pelanggan
                        </h3>
                        <div className="w-full h-80 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                            <img 
                                src={`${api.defaults.baseURL || ''}${previewPhotoUrl}`} 
                                alt="Foto Rumah Pelanggan" 
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: IMPORT EXCEL */}
            {importOpen && (
                <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center z-[999] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full relative shadow-2xl space-y-6 border border-slate-100">
                        <button 
                            onClick={() => { setImportOpen(false); setImportFile(null); setPreviewData(null); setImportDefaultRouter(''); setImportForceSync(true); }}
                            className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-full transition"
                        >
                            <X size={16} weight="bold" />
                        </button>
                        
                        <div>
                            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                                <UploadSimple size={18} className="text-sky-500" /> Impor Pelanggan Massal (Excel)
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-1">Gunakan berkas spreadsheet Excel `.xlsx` untuk mendaftarkan ratusan pelanggan beserta areanya secara otomatis.</p>
                        </div>

                        {previewData ? (
                            <div className="space-y-4">
                                <div className="bg-sky-50 p-4 rounded-xl text-xs text-sky-800 border border-sky-100">
                                    <p className="font-bold flex items-center gap-1.5"><Info size={16}/> Pratinjau Data</p>
                                    <p className="mt-1 opacity-90">Terdapat <b>{previewData.length}</b> data yang berhasil dibaca. Pastikan data di bawah ini sudah benar sebelum diimpor.</p>
                                </div>
                                <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl text-[10px] bg-slate-50/30">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-100 sticky top-0 shadow-sm">
                                            <tr>
                                                <th className="p-2.5 font-bold text-slate-700">Nama</th>
                                                <th className="p-2.5 font-bold text-slate-700">Area FAT</th>
                                                <th className="p-2.5 font-bold text-slate-700">IP Address</th>
                                                <th className="p-2.5 font-bold text-slate-700">User PPPoE</th>
                                                <th className="p-2.5 font-bold text-slate-700">Password</th>
                                                <th className="p-2.5 font-bold text-slate-700">Profile PPPoE</th>
                                                <th className="p-2.5 font-bold text-slate-700">Sync</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {previewData.slice(0, 50).map((row, i) => (
                                                <tr key={i} className="hover:bg-white transition-colors bg-transparent">
                                                    <td className="p-2.5 font-medium text-slate-700">{row.name}</td>
                                                    <td className="p-2.5 text-slate-600">{row.fat}</td>
                                                    <td className="p-2.5 text-slate-600 font-mono text-[9px]">{row.ip_address || '-'}</td>
                                                    <td className="p-2.5 text-slate-600">{row.pppoe_username || '-'}</td>
                                                    <td className="p-2.5 text-emerald-600 font-mono font-bold">{row.pppoe_password}</td>
                                                    <td className="p-2.5 text-slate-600 font-bold">{row.pppoe_profile || 'default'}</td>
                                                    <td className="p-2.5 text-slate-600">{row.sync_mikrotik ? 'Ya' : 'Tidak'}</td>
                                                </tr>
                                            ))}
                                            {previewData.length > 50 && (
                                                <tr>
                                                    <td colSpan={5} className="p-4 text-center text-slate-400 font-bold bg-slate-50">
                                                        ... dan {previewData.length - 50} data lainnya
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setPreviewData(null)}
                                        className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-500 py-3 rounded-xl font-bold text-xs transition active:scale-95"
                                    >
                                        Batal Pratinjau
                                    </button>
                                    <button
                                        type="button"
                                        disabled={importing}
                                        onClick={() => handleImportSubmit(true)}
                                        className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white py-3 rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                                    >
                                        {importing ? <><Spinner className="animate-spin" size={14} /> Memproses...</> : <><CheckCircle size={14} weight="bold" /> Eksekusi {previewData.length} Data</>}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()} className="space-y-4">
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    className="hidden" 
                                    accept=".xlsx, .xls"
                                    onChange={handleFileChange}
                                />
                                
                                {/* Drag and drop zone */}
                                <div 
                                    onClick={triggerFileSelect}
                                    onDragOver={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDrop={handleDrop}
                                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                                        dragActive ? "border-sky-500 bg-sky-50/50" : "border-slate-350 border-slate-300 hover:border-sky-400 hover:bg-slate-50/50"
                                    }`}
                                >
                                    <div className="p-3 bg-slate-100 text-slate-400 rounded-full mb-3">
                                        <FileText size={24} />
                                    </div>
                                    {importFile ? (
                                        <div className="space-y-1">
                                            <span className="font-bold text-slate-700 text-xs block truncate max-w-[250px]">{importFile.name}</span>
                                            <span className="text-[10px] text-slate-400 block">Size: {(importFile.size / 1024).toFixed(2)} KB</span>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="font-bold text-slate-600 text-xs">Pilih atau seret file ke sini</span>
                                            <span className="text-[9px] text-slate-400 mt-1">Ekstensi file yang didukung: .xlsx, .xls</span>
                                        </>
                                    )}
                                </div>

                                {/* Default Router Selection */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 block">Router Utama (Opsional)</label>
                                    <p className="text-[10px] text-slate-400 leading-snug">Pilih router default jika kolom Router ID pada Excel kosong. Sangat berguna agar otomatis sinkron ke Mikrotik meskipun Anda tidak tahu Router ID-nya.</p>
                                    <select
                                        value={importDefaultRouter}
                                        onChange={(e) => setImportDefaultRouter(e.target.value)}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                                    >
                                        <option value="">-- Biarkan Kosong (Ambil dari Excel) --</option>
                                        {routers.map(r => (
                                            <option key={r.router_id} value={r.router_id}>{r.router_name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Force Sync Toggle */}
                                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={importForceSync}
                                            onChange={(e) => setImportForceSync(e.target.checked)}
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                                    </label>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-700">Sinkronisasi ke Mikrotik</h4>
                                        <p className="text-[10px] text-slate-500">Jika aktif, data PPPoE otomatis ditambahkan/diupdate ke Router Mikrotik (meskipun status sync di Excel kosong)</p>
                                    </div>
                                </div>

                                {/* Download template */}
                                <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-3 flex flex-col gap-2 text-sky-800 text-[10px] leading-relaxed">
                                    <div className="flex items-start gap-2">
                                        <Info size={18} className="flex-shrink-0 mt-0.5 text-sky-600" />
                                        <div>
                                            <span className="font-bold block">💡 Petunjuk Header Template Excel:</span>
                                            Header kolom memuat: <strong className="text-slate-800 font-bold">Nama Pelanggan, Nomor Telepon, Alamat Rumah, Area FAT, Paket Internet, Router ID, Latitude, Longitude, IP Address, SN ONT, Username PPPoE, Password PPPoE, Profile PPPoE, Sync Mikrotik</strong>.
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleDownloadTemplate}
                                        className="w-full mt-1 bg-white hover:bg-sky-100 border border-sky-200 text-sky-600 font-extrabold py-2 px-3 rounded-lg transition active:scale-95 text-center flex items-center justify-center gap-1.5"
                                    >
                                        📥 Unduh Template Excel Impor
                                    </button>
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setImportOpen(false); setImportFile(null); setPreviewData(null); setImportDefaultRouter(''); setImportForceSync(true); }}
                                        className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-500 py-3 rounded-xl font-bold text-xs transition active:scale-95"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!importFile || importing}
                                        onClick={() => handleImportSubmit(false)}
                                        className="flex-1 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 disabled:opacity-55 disabled:cursor-not-allowed text-white py-3 rounded-xl font-black text-xs shadow-md shadow-sky-500/10 transition flex items-center justify-center gap-1.5 active:scale-95"
                                    >
                                        {importing ? (
                                            <><Spinner className="animate-spin" size={14} /> Memproses...</>
                                        ) : (
                                            <><CheckCircle size={14} weight="bold" /> Tampilkan Pratinjau</>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientListScreen;
