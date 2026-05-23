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
    Tag
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
    router_id: string;
    fat: string;
    package_id?: number;
    latitude: number;
    longitude: number;
    ip_address?: string;
    onu_sn?: string;
    pppoe_username?: string;
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
    
    // Filters & Search
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedRouter, setSelectedRouter] = useState<string>('');
    const [fatQuery, setFatQuery] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<'active' | 'disconnected'>('active');
    
    // Import Modal & Dropzone
    const [importOpen, setImportOpen] = useState<boolean>(false);
    const [dragActive, setDragActive] = useState<boolean>(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // House Photo Modal Preview
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

    const navigate = useNavigate();

    // Load clients and routers
    const loadData = async () => {
        setLoading(true);
        try {
            const clientsRes = await api.get('/api/clients', {
                params: {
                    search: searchQuery,
                    router_id: selectedRouter,
                    fat: fatQuery,
                    status: statusFilter
                }
            });
            if (clientsRes.data.status === 'success') {
                setClients(clientsRes.data.data || []);
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

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            loadData();
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [searchQuery, selectedRouter, fatQuery, statusFilter]);

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
    const handleImportSubmit = async () => {
        if (!importFile) return;

        const formData = new FormData();
        formData.append('excel_file', importFile);

        setImporting(true);
        try {
            const res = await api.post('/api/clients/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'Impor Sukses!',
                    text: res.data.message || 'Data pelanggan massal berhasil diimpor.',
                    confirmButtonColor: '#0ea5e9'
                });
                setImportOpen(false);
                setImportFile(null);
                loadData();
            } else {
                Swal.fire('Gagal Impor', res.data.message || 'Gagal memproses file.', 'error');
            }
        } catch (err: any) {
            Swal.fire('Error', err.response?.data?.message || 'Format header Excel tidak sesuai atau terjadi kesalahan server.', 'error');
        } finally {
            setImporting(false);
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
                </div>
            </div>

            {/* TAB FILTER STATUS PELANGGAN */}
            <div className="flex border-b border-slate-200 gap-1 bg-slate-100/60 p-1.5 rounded-2xl w-fit">
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
                {/* Cari Area FAT */}
                <div className="relative">
                    <FolderSimplePlus className="absolute inset-y-0 left-0 h-full w-5 text-slate-400 ml-3.5" />
                    <input 
                        type="text" 
                        placeholder="Cari area FAT (misal: FAT-01)..." 
                        value={fatQuery}
                        onChange={(e) => setFatQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:bg-white transition-all font-semibold text-slate-700"
                    />
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
                    <div className="overflow-x-auto">
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
                                        <td className="py-4 px-6 space-y-1">
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
                                                </div>
                                            ) : null}
                                            {client.pppoe_username ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider w-8">PPPoE:</span>
                                                    <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-bold text-[10px] truncate max-w-[120px]">{client.pppoe_username}</span>
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
                                                        <button
                                                            onClick={() => navigate(`/admin/clients/edit/${client.client_id}`)}
                                                            className="p-2 bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-500 hover:text-sky-600 rounded-xl transition active:scale-95"
                                                            title="Ubah Data"
                                                        >
                                                            <PencilLine size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(client.client_id, client.name)}
                                                            className="p-2 bg-slate-50 border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition active:scale-95"
                                                            title="Putuskan Sambungan (Soft Delete)"
                                                        >
                                                            <Trash size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleRestore(client.client_id, client.name)}
                                                        className="px-3 py-1.5 bg-sky-50 border border-sky-200 hover:bg-sky-500 hover:text-white text-sky-700 rounded-xl transition active:scale-95 font-extrabold text-[10px] flex items-center gap-1 shadow-sm"
                                                        title="Pasang Sambungan Baru (Restore)"
                                                    >
                                                        <ArrowCounterClockwise size={12} weight="bold" />
                                                        Pasang Lagi
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

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
                            onClick={() => { setImportOpen(false); setImportFile(null); }}
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

                            {/* Download template */}
                            <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-3 flex flex-col gap-2 text-sky-800 text-[10px] leading-relaxed">
                                <div className="flex items-start gap-2">
                                    <Info size={18} className="flex-shrink-0 mt-0.5 text-sky-600" />
                                    <div>
                                        <span className="font-bold block">💡 Petunjuk Header Template Excel:</span>
                                        Header kolom memuat: <strong className="text-slate-800 font-bold">Nama Pelanggan, Nomor Telepon, Alamat Rumah, Area FAT, Paket Internet, Router ID, Latitude, Longitude, IP Address, SN ONT, PPPoE</strong>.
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
                                    onClick={() => { setImportOpen(false); setImportFile(null); }}
                                    className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-500 py-3 rounded-xl font-bold text-xs transition active:scale-95"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    disabled={!importFile || importing}
                                    onClick={handleImportSubmit}
                                    className="flex-1 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 disabled:opacity-55 disabled:cursor-not-allowed text-white py-3 rounded-xl font-black text-xs shadow-md shadow-sky-500/10 transition flex items-center justify-center gap-1.5 active:scale-95"
                                >
                                    {importing ? (
                                        <><Spinner className="animate-spin" size={14} /> Memproses...</>
                                    ) : (
                                        <><CheckCircle size={14} weight="bold" /> Mulai Impor</>
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

export default ClientListScreen;
