import React, { useState, useRef, useEffect } from 'react';
import api from '../../api/AxiosInstance'; // Path AxiosInstance yang benar
import Swal from 'sweetalert2';
import { 
    CloudArrowUp, 
    Prohibit, 
    CheckCircle, 
    DownloadSimple, 
    ArrowCounterClockwise, 
    ListBullets,
    Spinner,
    FileText,
    Play,
    Info
} from '@phosphor-icons/react';

interface LogResult {
	target: string;
	status: string; // SUCCESS, SKIP, FAILED
	message: string;
}

interface TaskData {
	task_id: string;
	status: string; // pending, running, completed, failed
	progress: number;
	total: number;
	results: LogResult[];
}

const IsolirScreen: React.FC = () => {
    const [dragActive, setDragActive] = useState<boolean>(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState<boolean>(false);
    
    // Router Selection States
    interface RouterOption {
        router_id: string;
        router_name: string;
    }
    const [routers, setRouters] = useState<RouterOption[]>([]);
    const [routerMode, setRouterMode] = useState<string>('auto'); // auto, selected, manual
    const [selectedRouterId, setSelectedRouterId] = useState<string>('');
    const [targetType, setTargetType] = useState<string>('auto'); // auto, hotspot, pppoe
    
    // Manual Router Fields
    const [manualHost, setManualHost] = useState<string>('');
    const [manualPort, setManualPort] = useState<string>('8728');
    const [manualUsername, setManualUsername] = useState<string>('');
    const [manualPassword, setManualPassword] = useState<string>('');
    const [manualUseSSL, setManualUseSSL] = useState<boolean>(false);

    // Prefix Rules
    const [prefixRules, setPrefixRules] = useState<Array<{prefix: string, router_id: string}>>([{prefix: '', router_id: ''}]);

    // Task States
    const [previewTargets, setPreviewTargets] = useState<string[] | null>(null);
    const [taskId, setTaskId] = useState<string | null>(null);
    const [taskData, setTaskData] = useState<TaskData | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollIntervalRef = useRef<any>(null);

    // Fetch routers & Stop polling on unmount
    useEffect(() => {
        const fetchRouters = async () => {
            try {
                const res = await api.get('/api/routers');
                if (res.data.status === 'success') {
                    const data = res.data.data || [];
                    setRouters(data);
                    if (data.length > 0) {
                        setSelectedRouterId(data[0].router_id.toString());
                        setPrefixRules([{prefix: '', router_id: data[0].router_id}]);
                    }
                }
            } catch (err) {
                console.error("Gagal memuat list router:", err);
            }
        };

        fetchRouters();

        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, []);

    // Drag-and-Drop Handlers
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
            setFile(e.dataTransfer.files[0]);
            setPreviewTargets(null);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setPreviewTargets(null);
        }
    };

    const handlePreview = async () => {
        if (!file) return;

        const formData = new FormData();
        formData.append('excel_file', file);

        setUploading(true);
        try {
            const res = await api.post('/api/tools/isolir/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.status === 'success') {
                setPreviewTargets(res.data.data.targets);
            } else {
                Swal.fire('Gagal', res.data.message || 'Gagal memproses file.', 'error');
            }
        } catch (err: any) {
            Swal.fire('Error', err.response?.data?.message || 'Terjadi kesalahan saat mengunggah file.', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleProcess = async () => {
        if (!previewTargets || previewTargets.length === 0) return;

        // Validasi input manual jika mode manual dipilih
        if (routerMode === 'manual') {
            if (!manualHost.trim()) {
                Swal.fire('Input Salah', 'IP/Host router manual wajib diisi.', 'warning');
                return;
            }
            if (!manualUsername.trim()) {
                Swal.fire('Input Salah', 'Username router manual wajib diisi.', 'warning');
                return;
            }
        }

        setUploading(true);
        try {
            const payload = {
                targets: previewTargets,
                router_mode: routerMode,
                router_id: selectedRouterId,
                manual_host: manualHost,
                manual_port: parseInt(manualPort) || 8728,
                manual_username: manualUsername,
                manual_password: manualPassword,
                manual_use_ssl: manualUseSSL,
                target_type: targetType,
                prefix_rules: routerMode === 'prefix' ? prefixRules.filter(r => r.prefix.trim() !== '' && r.router_id !== '') : []
            };

            const res = await api.post('/api/tools/isolir/process', payload);

            if (res.data.status === 'success') {
                const newTaskId = res.data.data.task_id;
                setTaskId(newTaskId);
                setTaskData({
                    task_id: newTaskId,
                    status: 'pending',
                    progress: 0,
                    total: res.data.data.total,
                    results: []
                });
                // Start status polling
                startPolling(newTaskId);
            } else {
                Swal.fire('Gagal', res.data.message || 'Gagal memulai isolir.', 'error');
            }
        } catch (err: any) {
            Swal.fire('Error', err.response?.data?.message || 'Terjadi kesalahan saat memulai proses.', 'error');
        } finally {
            setUploading(false);
        }
    };

    // Polling logic
    const startPolling = (tid: string) => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        
        pollIntervalRef.current = setInterval(async () => {
            try {
                const res = await api.get(`/api/tools/isolir/status/${tid}`);
                if (res.data.status === 'success') {
                    const data: TaskData = res.data.data;
                    setTaskData(data);
                    
                    if (data.status === 'completed' || data.status === 'failed') {
                        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            icon: data.status === 'completed' ? 'success' : 'error',
                            title: data.status === 'completed' ? 'Isolir batch selesai!' : 'Proses isolir gagal.',
                            showConfirmButton: false,
                            timer: 3000
                        });
                    }
                }
            } catch (err) {
                console.error("Polling error:", err);
            }
        }, 1000);
    };

    const handleReset = () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setFile(null);
        setTaskId(null);
        setTaskData(null);
        setPreviewTargets(null);
    };

    // Helper: Unduh Log Hasil
    const downloadCSV = () => {
        if (!taskData || !taskData.results.length) return;
        
        const headers = ["Target", "Status", "Keterangan"];
        const rows = taskData.results.map(r => [r.target, r.status, r.message]);
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
            
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `laporan_isolir_${taskData.task_id.substring(0,8)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Helper: Unduh Template Excel dari Backend
    const downloadTemplate = async () => {
        try {
            const response = await api.get('/api/tools/isolir/template', {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', 'template_isolir_batch.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            Swal.fire('Error', 'Gagal mengunduh template Excel.', 'error');
        }
    };

    // Stats calculations
    const successCount = taskData?.results.filter(r => r.status === 'SUCCESS').length || 0;
    const skipCount = taskData?.results.filter(r => r.status === 'SKIP').length || 0;
    const failedCount = taskData?.results.filter(r => r.status === 'FAILED').length || 0;
    const progressPercent = taskData && taskData.total > 0 ? Math.round((taskData.progress / taskData.total) * 100) : 0;

    return (
        <div className="space-y-8 animate-fade-in font-sans w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Prohibit size={28} className="animate-pulse" /> Tools Isolir Batch Pelanggan
                    </h1>
                    <p className="text-sky-100 text-sm mt-1">Isolir massal pengguna hotspot binding atau PPPoE di seluruh router Mikrotik secara instan & background thread.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button 
                        onClick={downloadTemplate}
                        className="bg-white text-sky-700 hover:bg-sky-50 px-4 py-2 rounded-xl font-bold transition text-sm flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                        <DownloadSimple size={18} weight="bold" /> Unduh Template Excel
                    </button>
                    <button 
                        onClick={() => {
                            Swal.fire({
                                title: 'Format Excel',
                                html: `
                                    <div class="text-left text-xs text-slate-600 leading-relaxed">
                                        <p class="mb-2">File Excel minimal berisi kolom <b>PPOE</b> atau <b>PPPOE</b> atau <b>IP</b> pada baris 1-2.</p>
                                        <p class="mb-2">Contoh isi kolom:</p>
                                        <ul class="list-disc pl-4 space-y-1 mb-3">
                                            <li>Username PPPoE (ex: <b>pelanggan_joko</b>)</li>
                                            <li>IP Hotspot Binding (ex: <b>10.20.30.40</b>)</li>
                                            <li>Static IP dengan prefiks (ex: <b>static@10.20.30.40</b>)</li>
                                        </ul>
                                        <p class="font-semibold text-slate-800">Proses akan berjalan di background, sehingga Anda bebas meninggalkan halaman ini tanpa mengganggu jalannya isolir.</p>
                                    </div>
                                `,
                                icon: 'info',
                                confirmButtonText: 'Mengerti',
                                confirmButtonColor: '#0284c7'
                            });
                        }}
                        className="bg-white/10 hover:bg-white/20 border border-white/25 px-4 py-2 rounded-xl font-semibold transition text-sm flex items-center gap-1.5"
                    >
                        <FileText size={18} /> Contoh Format
                    </button>
                </div>
            </div>

            {/* MAIN CARD WORKSPACE */}
            <div className="bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden transition-all duration-300">
                {!taskId ? (
                    /* STEP 1: UPLOAD */
                    <div className="p-8">
                        <div 
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                                dragActive 
                                    ? 'border-sky-500 bg-sky-50/50 scale-[0.99] shadow-inner' 
                                    : 'border-slate-300 hover:border-sky-400 hover:bg-slate-50/50'
                            }`}
                        >
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                className="hidden" 
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                            />
                            
                            <div className="bg-sky-100 p-4 rounded-full text-sky-600 mb-4 transition-transform group-hover:scale-110">
                                <CloudArrowUp size={36} weight="duotone" />
                            </div>
                            
                            <p className="font-semibold text-slate-800 text-lg mb-1">
                                {file ? file.name : "Seret & Letakkan file Excel Anda di sini"}
                            </p>
                            <p className="text-slate-400 text-sm text-center max-w-sm mb-4">
                                {file 
                                    ? `Ukuran file: ${(file.size / 1024).toFixed(1)} KB` 
                                    : "atau klik untuk menelusuri file dari komputer Anda (Mendukung .xlsx, .xls)"
                                }
                            </p>
                            
                            {file && (
                                <div className="bg-emerald-50 border border-emerald-200 px-4 py-1.5 rounded-full text-emerald-700 font-semibold text-xs flex items-center gap-1.5 animate-bounce">
                                    <CheckCircle size={14} weight="bold"/> Excel Terpilih!
                                </div>
                            )}
                        </div>

                        {/* 1.2 Router Target Selection Form (ONLY DISPLAYED IF FILE SELECTED) */}
                        {file && (
                            <div className="border-t border-slate-100 pt-6 animate-fade-in">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="p-1.5 bg-sky-50 text-sky-600 rounded-lg"><Info size={20} weight="bold" /></span>
                                    <h3 className="font-bold text-slate-800 text-sm">Sasaran Router Mikrotik</h3>
                                </div>
                                <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
                                    Pilih router Mikrotik tujuan. Sistem secara dinamis mendukung isolir untuk <b>Hotspot IP Binding</b> (bila baris berupa IP) dan <b>PPPoE Secret & Session</b> (bila baris berupa Username). Satu koneksi API untuk mengontrol keduanya!
                                </p>

                                {/* Mode Select Tabs */}
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-slate-100 p-1 rounded-2xl mb-6">
                                    <button
                                        type="button"
                                        onClick={() => setRouterMode('auto')}
                                        className={`py-2.5 px-3 rounded-xl text-[10px] sm:text-xs font-bold transition-all active:scale-95 ${
                                            routerMode === 'auto'
                                                ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50'
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                                        }`}
                                    >
                                        Semua Router
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRouterMode('selected')}
                                        className={`py-2.5 px-3 rounded-xl text-[10px] sm:text-xs font-bold transition-all active:scale-95 ${
                                            routerMode === 'selected'
                                                ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50'
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                                        }`}
                                    >
                                        Pilih Router
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRouterMode('prefix')}
                                        className={`py-2.5 px-3 rounded-xl text-[10px] sm:text-xs font-bold transition-all active:scale-95 ${
                                            routerMode === 'prefix'
                                                ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50'
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                                        }`}
                                    >
                                        Berdasarkan Prefix
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRouterMode('manual')}
                                        className={`py-2.5 px-3 rounded-xl text-[10px] sm:text-xs font-bold transition-all active:scale-95 ${
                                            routerMode === 'manual'
                                                ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50'
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                                        }`}
                                    >
                                        Input Manual
                                    </button>
                                </div>

                                {/* Mode Subpanels */}
                                {routerMode === 'auto' && (
                                    <div className="p-4 bg-sky-50/50 border border-sky-100 rounded-2xl text-xs text-sky-700 leading-relaxed animate-fade-in flex items-start gap-2">
                                        <Info size={16} className="text-sky-500 mt-0.5 flex-shrink-0" />
                                        <span>
                                            💡 <b>Mode Pindai Otomatis:</b> Sistem Go akan mengisolir daftar pelanggan dengan mencari secara cerdas di <b>seluruh router aktif</b> yang terdaftar di database.
                                        </span>
                                    </div>
                                )}

                                {routerMode === 'selected' && (
                                    <div className="p-4 border border-slate-200 rounded-2xl space-y-3 animate-fade-in">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Router Terdaftar</label>
                                        <select
                                            value={selectedRouterId}
                                            onChange={(e) => setSelectedRouterId(e.target.value)}
                                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer font-semibold text-slate-700"
                                        >
                                            {routers.length === 0 ? (
                                                <option value="">Tidak ada router terdaftar di database</option>
                                            ) : (
                                                routers.map(r => (
                                                    <option key={r.router_id} value={r.router_id}>{r.router_name}</option>
                                                ))
                                            )}
                                        </select>
                                    </div>
                                )}

                                {routerMode === 'prefix' && (
                                    <div className="p-4 border border-slate-200 rounded-2xl space-y-4 animate-fade-in">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="p-1.5 bg-sky-50 text-sky-600 rounded-lg"><Info size={20} weight="bold" /></span>
                                            <h3 className="font-bold text-slate-800 text-sm">Aturan Prefix IP</h3>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                                            Tentukan router mana yang akan memproses IP dengan awalan tertentu. Contoh: <b>192.168.</b> ke Router A. Jika target tidak cocok dengan prefix apapun, akan dipindai ke semua router.
                                        </p>
                                        
                                        {prefixRules.map((rule, index) => (
                                            <div key={index} className="flex flex-col sm:flex-row items-center gap-3">
                                                <input
                                                    type="text"
                                                    placeholder="Prefix (ex: 192.168.)"
                                                    value={rule.prefix}
                                                    onChange={(e) => {
                                                        const newRules = [...prefixRules];
                                                        newRules[index].prefix = e.target.value;
                                                        setPrefixRules(newRules);
                                                    }}
                                                    className="w-full sm:w-1/2 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold"
                                                />
                                                <div className="w-full sm:w-1/2 flex items-center gap-2">
                                                    <select
                                                        value={rule.router_id}
                                                        onChange={(e) => {
                                                            const newRules = [...prefixRules];
                                                            newRules[index].router_id = e.target.value;
                                                            setPrefixRules(newRules);
                                                        }}
                                                        className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer font-semibold text-slate-700"
                                                    >
                                                        <option value="" disabled>Pilih Router</option>
                                                        {routers.map(r => (
                                                            <option key={r.router_id} value={r.router_id}>{r.router_name}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newRules = prefixRules.filter((_, i) => i !== index);
                                                            setPrefixRules(newRules);
                                                        }}
                                                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition"
                                                    >
                                                        Hapus
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        
                                        <button
                                            type="button"
                                            onClick={() => setPrefixRules([...prefixRules, {prefix: '', router_id: routers.length > 0 ? routers[0].router_id.toString() : ''}])}
                                            className="text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg transition"
                                        >
                                            + Tambah Aturan Prefix
                                        </button>
                                    </div>
                                )}

                                {routerMode === 'manual' && (
                                    <div className="p-4 border border-slate-200 rounded-2xl space-y-4 animate-fade-in">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {/* IP / Host */}
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Host / IP Address Router</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="ex: 192.168.10.1 atau domain.net"
                                                    value={manualHost}
                                                    onChange={(e) => setManualHost(e.target.value)}
                                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold"
                                                />
                                            </div>

                                            {/* Port */}
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Port API / REST API</label>
                                                <input 
                                                    type="number" 
                                                    placeholder="Default: 8728"
                                                    value={manualPort}
                                                    onChange={(e) => setManualPort(e.target.value)}
                                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold"
                                                />
                                            </div>

                                            {/* Username */}
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Username Mikrotik API</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="ex: admin"
                                                    value={manualUsername}
                                                    onChange={(e) => setManualUsername(e.target.value)}
                                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold"
                                                />
                                            </div>

                                            {/* Password */}
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password Mikrotik API</label>
                                                <input 
                                                    type="password" 
                                                    placeholder="ex: password123"
                                                    value={manualPassword}
                                                    onChange={(e) => setManualPassword(e.target.value)}
                                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold"
                                                />
                                            </div>
                                        </div>

                                        {/* SSL TLS Switch */}
                                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                            <input 
                                                type="checkbox" 
                                                id="ssl_toggle"
                                                checked={manualUseSSL}
                                                onChange={(e) => setManualUseSSL(e.target.checked)}
                                                className="w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500 cursor-pointer"
                                            />
                                            <label htmlFor="ssl_toggle" className="text-xs font-bold text-slate-500 cursor-pointer select-none">
                                                Gunakan TLS / SSL API Secure (Port default: 8729)
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 1.3 Target Type Selection Form (ONLY DISPLAYED IF FILE SELECTED) */}
                        {file && (
                            <div className="border-t border-slate-100 pt-6 animate-fade-in">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="p-1.5 bg-sky-50 text-sky-600 rounded-lg"><ListBullets size={20} weight="bold" /></span>
                                    <h3 className="font-bold text-slate-800 text-sm">Jenis Layanan Pelanggan</h3>
                                </div>
                                <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
                                    Pilih jenis isolasi yang ingin dipaksakan ke target Excel.
                                </p>

                                {/* Target Type Select Tabs */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-100 p-1 rounded-2xl">
                                    <button
                                        type="button"
                                        onClick={() => setTargetType('auto')}
                                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                            targetType === 'auto'
                                                ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50'
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                                        }`}
                                    >
                                        Auto-Detect (Cerdas)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTargetType('hotspot')}
                                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                            targetType === 'hotspot'
                                                ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50'
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                                        }`}
                                    >
                                        Hotspot (IP Binding / User)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTargetType('pppoe')}
                                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                            targetType === 'pppoe'
                                                ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50'
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                                        }`}
                                    >
                                        PPPoE Secret & Session
                                    </button>
                                </div>

                                {/* Contextual Explanations */}
                                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-600 leading-relaxed animate-fade-in flex items-start gap-2 font-medium">
                                    <Info size={16} className="text-sky-500 mt-0.5 flex-shrink-0" />
                                    {targetType === 'auto' && (
                                        <span>
                                            💡 <b>Deteksi Otomatis:</b> Mikrotik API akan mendeteksi format isian. Target berupa alamat IP (misal: <code>10.0.0.5</code>) akan diisolir via <b>Hotspot IP Binding</b>, dan target berupa username (misal: <code>user1</code>) akan diisolir via <b>PPPoE Secret</b>.
                                        </span>
                                    )}
                                    {targetType === 'hotspot' && (
                                        <span>
                                            💡 <b>Paksa Hotspot:</b> Seluruh baris Excel akan dicari dan dinonaktifkan di menu <b>Hotspot</b>. Jika baris berupa IP, sistem menonaktifkan <b>IP Binding</b>-nya. Jika berupa username, sistem menonaktifkan <b>User Account</b> dan langsung memutus sesi aktifnya.
                                        </span>
                                    )}
                                    {targetType === 'pppoe' && (
                                        <span>
                                            💡 <b>Paksa PPPoE Secret:</b> Seluruh baris Excel akan dicari dan dinonaktifkan di menu <b>PPP Secrets</b>. Sistem mendukung pencarian secret berdasarkan username maupun IP static pelanggan PPPoE, serta langsung memutuskan sesi koneksi aktifnya.
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Preview Table */}
                        {previewTargets && (
                            <div className="border-t border-slate-100 pt-6 animate-fade-in">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="p-1.5 bg-sky-50 text-sky-600 rounded-lg"><ListBullets size={20} weight="bold" /></span>
                                    <h3 className="font-bold text-slate-800 text-sm">Pratinjau Data ({previewTargets.length} target)</h3>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto mt-4">
                                    <table className="w-full text-left text-xs text-slate-600">
                                        <thead className="bg-slate-200/50 sticky top-0 backdrop-blur-sm z-10 shadow-sm">
                                            <tr>
                                                <th className="py-2.5 px-4 font-bold text-slate-700 w-16 text-center">No</th>
                                                <th className="py-2.5 px-4 font-bold text-slate-700">Target IP / Username</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200/60">
                                            {previewTargets.map((t, idx) => (
                                                <tr key={idx} className="hover:bg-sky-50/50 transition-colors">
                                                    <td className="py-2.5 px-4 text-center font-medium">{idx + 1}</td>
                                                    <td className="py-2.5 px-4 font-semibold text-slate-800 font-mono">{t}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Submit Actions */}
                        {file && (
                            <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-6">
                                <button 
                                    onClick={() => {
                                        setFile(null);
                                        setPreviewTargets(null);
                                    }}
                                    className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition"
                                >
                                    Batal
                                </button>
                                {!previewTargets ? (
                                    <button 
                                        onClick={handlePreview}
                                        disabled={uploading}
                                        className="px-8 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-bold transition flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {uploading ? (
                                            <>
                                                <Spinner size={18} className="animate-spin" /> Memproses...
                                            </>
                                        ) : (
                                            <>
                                                Pratinjau Data <Play size={18} weight="fill" />
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <button 
                                        onClick={handleProcess}
                                        disabled={uploading}
                                        className="px-8 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold transition flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {uploading ? (
                                            <>
                                                <Spinner size={18} className="animate-spin" /> Memproses...
                                            </>
                                        ) : (
                                            <>
                                                Mulai Isolir Batch <Play size={18} weight="fill" />
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    /* STEP 2: PROGRESS MONITOR */
                    <div className="p-6 md:p-8">
                        {/* Stats Dashboard */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Target</span>
                                <span className="text-3xl font-extrabold text-slate-800 mt-2">{taskData?.total || 0}</span>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                                <span className="text-emerald-500 text-xs font-bold uppercase tracking-wider">Sukses Isolir</span>
                                <span className="text-3xl font-extrabold text-emerald-600 mt-2">{successCount}</span>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                                <span className="text-amber-500 text-xs font-bold uppercase tracking-wider">Terlewati (Skip)</span>
                                <span className="text-3xl font-extrabold text-amber-600 mt-2">{skipCount}</span>
                            </div>
                            <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                                <span className="text-rose-500 text-xs font-bold uppercase tracking-wider">Gagal</span>
                                <span className="text-3xl font-extrabold text-rose-600 mt-2">{failedCount}</span>
                            </div>
                        </div>

                        {/* Progress Bar & Status Tag */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-8">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-700">Progress Pemrosesan:</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        taskData?.status === 'running' ? 'bg-sky-100 text-sky-700 animate-pulse' :
                                        taskData?.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                        {taskData?.status === 'running' ? '⏳ Sedang Berjalan' :
                                         taskData?.status === 'completed' ? '✅ Selesai' : 'Pending'}
                                    </span>
                                </div>
                                <span className="font-bold text-sky-600 text-lg">{progressPercent}%</span>
                            </div>
                            
                            <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden shadow-inner">
                                <div 
                                    className={`h-full rounded-full transition-all duration-300 bg-gradient-to-r from-sky-500 to-indigo-600 ${
                                        taskData?.status === 'running' ? 'bg-[length:20px_20px] animate-[shimmer_1s_linear_infinite] bg-opacity-95 bg-stripes' : ''
                                    }`}
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                                <span>{taskData?.progress || 0} diproses</span>
                                <span>Dari {taskData?.total || 0} total data</span>
                            </div>
                        </div>

                        {/* Console Log Panel */}
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="font-bold text-slate-700 flex items-center gap-1.5"><ListBullets size={20}/> Log Pemrosesan Real-time</h3>
                            <div className="flex gap-2">
                                {taskData?.status === 'completed' && (
                                    <button 
                                        onClick={downloadCSV}
                                        className="bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition"
                                    >
                                        <DownloadSimple size={16} /> Unduh Laporan (.csv)
                                    </button>
                                )}
                                <button 
                                    onClick={handleReset}
                                    className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition"
                                >
                                    <ArrowCounterClockwise size={16} /> {taskData?.status === 'completed' ? 'Kembali' : 'Batal & Reset'}
                                </button>
                            </div>
                        </div>

                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-inner">
                            <div className="bg-slate-900 text-slate-300 font-mono text-xs p-4 h-64 overflow-y-auto space-y-1.5 flex flex-col-reverse">
                                {taskData?.results && taskData.results.length > 0 ? (
                                    [...taskData.results].reverse().map((res, idx) => (
                                        <div key={idx} className={`p-1.5 rounded flex items-start gap-2 ${
                                            res.status === 'SUCCESS' ? 'bg-emerald-950/60 text-emerald-400 border-l-4 border-emerald-500' :
                                            res.status === 'SKIP' ? 'bg-amber-950/40 text-amber-300 border-l-4 border-amber-500' :
                                            'bg-rose-950/60 text-rose-400 border-l-4 border-rose-500'
                                        }`}>
                                            <span className="font-bold font-mono">[{res.status}]</span>
                                            <span className="flex-1">{res.message}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-slate-500 text-center py-12">
                                        <Spinner className="animate-spin mx-auto mb-2 text-slate-600" size={24} />
                                        <span>Menunggu tugas dimulai...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IsolirScreen;
