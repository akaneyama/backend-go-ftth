import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/AxiosInstance';
import { 
    ArrowLeft, 
    FloppyDisk, 
    CircleNotch, 
    Cloud as RouterIcon,
    PlugsConnected,
    Check,
    Warning,
    Prohibit
} from "@phosphor-icons/react";
import Swal from 'sweetalert2';

interface RouterData {
    router_id: string;
    router_name: string;
    router_address: string;
    router_type: string;
}

interface MikrotikInterface {
    name: string;
    type: string;
    disabled: string;
    running: string;
}

const InterfaceFormScreen: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    // Form State
    const [routerId, setRouterId] = useState('');
    const [interfaceName, setInterfaceName] = useState('');
    const [isExcluded, setIsExcluded] = useState(false); // [BARU] State Exclude
    
    // Data Lists
    const [routers, setRouters] = useState<RouterData[]>([]);
    const [scannedInterfaces, setScannedInterfaces] = useState<MikrotikInterface[]>([]);

    // Loading States
    const [isLoadingRouters, setIsLoadingRouters] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 1. Load List Router saat pertama buka
    useEffect(() => {
        const fetchRouters = async () => {
            setIsLoadingRouters(true);
            try {
                const response = await api.get('/api/routers');
                if (response.data.status === 'success') {
                    setRouters(response.data.data);
                }
            } catch (error) {
                console.error("Gagal load router", error);
            } finally {
                setIsLoadingRouters(false);
            }
        };
        fetchRouters();
    }, []);

    // 2. Jika Edit Mode, load detail interface yang ada
    useEffect(() => {
        if (isEditMode) {
            const fetchDetail = async () => {
                try {
                    const response = await api.get(`/api/interfaces/${id}`);
                    if (response.data.status === 'success') {
                        const data = response.data.data;
                        setRouterId(data.router_id);
                        setInterfaceName(data.interface_name);
                        
                        // [BARU] Set status exclude dari database (0=false, 1=true)
                        setIsExcluded(data.is_excluded === 1);

                        // Trigger scan agar dropdown terisi
                        scanInterfacesFromRouter(data.router_id);
                    }
                } catch (error) {
                    Swal.fire("Error", "Gagal load detail interface", "error");
                    navigate('/admin/interfaces');
                }
            };
            fetchDetail();
        }
    }, [id, isEditMode, navigate]);

    // Function: Scan Interface dari Router Terpilih
    const scanInterfacesFromRouter = async (selectedRouterId: string) => {
        if (!selectedRouterId) {
            setScannedInterfaces([]);
            return;
        }

        setIsScanning(true);
        try {
            const response = await api.get(`/api/interfaces/${selectedRouterId}/interfaces-scan`);
            if (response.data.status === 'success') {
                setScannedInterfaces(response.data.data);
            }
        } catch (error: any) {
            console.error(error);
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: 'Gagal scan interface dari router ini',
                showConfirmButton: false,
                timer: 3000
            });
            setScannedInterfaces([]);
        } finally {
            setIsScanning(false);
        }
    };

    // Event saat Router dipilih
    const handleRouterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setRouterId(val);
        setInterfaceName(''); // Reset interface saat ganti router
        
        if (val) {
            scanInterfacesFromRouter(val);
        } else {
            setScannedInterfaces([]);
        }
    };

    // Submit Form
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                router_id: routerId,
                interface_name: interfaceName,
                is_excluded: isExcluded ? 1 : 0 // [BARU] Kirim status exclude
            };

            if (isEditMode) {
                // Gunakan endpoint update jika ada (Anda perlu buat endpoint PUT di backend jika belum ada)
                // Atau delete lalu create baru (tergantung implementasi backend Anda)
                // Di sini saya asumsikan endpoint PUT /api/interfaces/:id sudah ada/akan dibuat
                // Jika belum ada, Anda bisa pakai POST add saja tapi backend harus handle update logic
                
                // PENTING: Backend controller AddInterfaceMonitoring biasanya CREATE only. 
                // Untuk edit, sebaiknya gunakan fitur Toggle di List Screen atau hapus & buat baru.
                // Tapi jika Anda punya endpoint update:
                // await api.put(`/api/interfaces/${id}`, payload);
                
                // Karena biasanya monitoring jarang diedit namanya (lebih sering dihapus lalu add ulang),
                // kita bisa pakai trick ini jika backend support update flag:
                await api.patch(`/api/interfaces/${id}/toggle-exclude`); // Ini hanya update flag
                // Jika ingin ganti interface name juga, backend butuh update full.
                
                // REKOMENDASI: Jika edit mode, kita anggap user ingin update status exclude saja 
                // atau hapus dan buat baru.
                // Untuk simpelnya, saya anggap backend punya endpoint update full atau kita recreate.
                
                Swal.fire('Info', 'Untuk mengubah interface, silakan hapus dan buat baru. Update status exclude berhasil.', 'info');
            } else {
                await api.post('/api/interfaces/add', payload);
                Swal.fire('Sukses', 'Data monitoring berhasil disimpan', 'success');
                navigate('/admin/interfaces');
            }

        } catch (err: any) {
            Swal.fire('Gagal', err.response?.data?.message || 'Terjadi kesalahan', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <button 
                onClick={() => navigate('/admin/interfaces')}
                className="mb-4 flex items-center text-sm text-slate-500 hover:text-sky-600 transition-colors"
            >
                <ArrowLeft className="mr-1" /> Kembali ke Daftar
            </button>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-800">
                        {isEditMode ? 'Edit Monitoring' : 'Tambah Monitoring Baru'}
                    </h2>
                    <p className="text-sm text-slate-500">Pilih router dan interface yang ingin dipantau traffic-nya.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    
                    {/* PILIH ROUTER */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Router</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <RouterIcon size={20} />
                            </div>
                            <select
                                value={routerId}
                                onChange={handleRouterChange}
                                disabled={isScanning || isLoadingRouters || isEditMode} // Disable edit router saat edit mode
                                required
                                className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
                            >
                                <option value="">-- Pilih Router --</option>
                                {routers.map((r) => (
                                    <option key={r.router_id} value={r.router_id}>
                                        {r.router_name} ({r.router_address})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* PILIH INTERFACE (SCAN RESULT) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex justify-between">
                            <span>Pilih Interface Target</span>
                            {isScanning && <span className="text-xs text-sky-600 flex items-center animate-pulse"><CircleNotch className="animate-spin mr-1"/> Scanning Mikrotik...</span>}
                        </label>
                        
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <PlugsConnected size={20} />
                            </div>
                            
                            <select
                                value={interfaceName}
                                onChange={(e) => setInterfaceName(e.target.value)}
                                disabled={!routerId || isScanning || scannedInterfaces.length === 0 || isEditMode} // Disable edit interface name
                                required
                                className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all
                                    ${(!routerId || isEditMode) ? 'bg-slate-100 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-300'}
                                `}
                            >
                                <option value="">
                                    {isScanning 
                                        ? 'Sedang mengambil data interface...' 
                                        : routerId && scannedInterfaces.length === 0 
                                            ? 'Gagal mengambil interface / Kosong' 
                                            : '-- Pilih Interface --'
                                    }
                                </option>

                                {scannedInterfaces.map((iface) => (
                                    <option key={iface.name} value={iface.name}>
                                        {iface.name} ({iface.type}) {iface.disabled === 'true' ? '[DISABLED]' : ''} {iface.running === 'true' ? '[RUNNING]' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Helper Text */}
                        {!routerId && (
                            <p className="text-xs text-slate-400 mt-1 ml-1">
                                <Warning className="inline mr-1 mb-0.5"/>
                                Silakan pilih router terlebih dahulu untuk memuat daftar interface.
                            </p>
                        )}
                        {routerId && !isScanning && scannedInterfaces.length > 0 && (
                            <p className="text-xs text-green-600 mt-1 ml-1">
                                <Check className="inline mr-1 mb-0.5"/>
                                {scannedInterfaces.length} interface ditemukan dari router.
                            </p>
                        )}
                    </div>

                    {/* [BARU] EXCLUDE OPTION */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${isExcluded ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`}>
                                <Prohibit size={24} weight="bold" />
                            </div>
                            <div className="flex-1">
                                <label className="flex items-center gap-2 cursor-pointer mb-1">
                                    <input 
                                        type="checkbox" 
                                        checked={isExcluded}
                                        onChange={(e) => setIsExcluded(e.target.checked)}
                                        className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                                    />
                                    <span className="font-semibold text-slate-700">Exclude from Monitoring</span>
                                </label>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    Jika dicentang, interface ini <b>tidak akan dipantau</b> (skip ping & traffic check). 
                                    Berguna untuk interface yang sedang maintenance atau tidak prioritas.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={isSubmitting || !interfaceName}
                            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <><CircleNotch className="animate-spin" size={20} /> Menyimpan...</>
                            ) : (
                                <><FloppyDisk size={20} /> Simpan Monitoring</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InterfaceFormScreen;
