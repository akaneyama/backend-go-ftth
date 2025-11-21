import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/AxiosInstance';
import { 
    ArrowLeft, 
    FloppyDisk, 
    CircleNotch, 
    Lightning, 
    CheckCircle, 
    XCircle,
    Cpu,
    Tag,
    Hash
} from "@phosphor-icons/react";
import Swal from 'sweetalert2';

interface RouterSystemInfo {
    board_name?: string; 
    model?: string;
    version?: string;   
    cpu?: string;
    uptime?: string;
    identity?: string;   
}

const RouterFormScreen: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    const [formData, setFormData] = useState({
        router_name: '',
        router_address: '',
        router_port: 8728,
        router_status: 'Disable', 
        router_type: 'MikroTik',
        router_remote_type: 'API',
        router_username: '',
        router_password: '',
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isChecking, setIsChecking] = useState(false); 
    const [connectionInfo, setConnectionInfo] = useState<RouterSystemInfo | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isEditMode) {
            const fetchDetail = async () => {
                setIsLoading(true);
                try {
                    const response = await api.get(`/api/routers/${id}`);
                    if (response.data.status === 'success') {
                        const data = response.data.data;
                        setFormData({
                            router_name: data.router_name,
                            router_address: data.router_address,
                            router_port: data.router_port,
                            router_status: data.router_status,
                            router_type: data.router_type,
                            router_remote_type: data.router_remote_type,
                            router_username: data.router_username,
                            router_password: '', 
                        });
                    }
                } catch (err) {
                    setError('Gagal mengambil data router.');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchDetail();
        }
    }, [id, isEditMode]);

    const handleCheckConnection = async () => {
        if (!formData.router_address || !formData.router_username || (!isEditMode && !formData.router_password)) {
            Swal.fire('Peringatan', 'Mohon isi IP Address, Username, dan Password terlebih dahulu.', 'warning');
            return;
        }

        setIsChecking(true);
        setConnectionInfo(null); 

        try {
            const payload = {
                ...formData,
                router_port: Number(formData.router_port)
            };

            const response = await api.post('/api/routers/test-connection', payload);

if (response.data.status === 'success') {
        const info = response.data.data.system_info;
        setConnectionInfo(info);
        
        const detectedType = `${info.board_name || info.model || 'MikroTik'} ${info.version ? 'v'+info.version : ''}`;

        setFormData(prev => {
            const newName = prev.router_name === '' && info.identity ? info.identity : prev.router_name;
            
            return { 
                ...prev, 
                router_status: 'Enable', 
                router_type: detectedType, 
                
                router_name: newName
            };
        });
                
                Swal.fire({
                    icon: 'success',
                    title: 'Terkoneksi!',
                    html: `
                        <div class="text-left text-sm">
                            <p><b>Model:</b> ${info.board_name || info.model}</p>
                            <p><b>Versi:</b> ${info.version}</p>
                            <p class="mt-2 text-green-600">Status Router diaktifkan.</p>
                        </div>
                    `,
                    timer: 2500,
                    showConfirmButton: false
                });
            } else {
                throw new Error(response.data.message);
            }

        } catch (err: any) {
            console.error(err);
            setFormData(prev => ({ ...prev, router_status: 'Disable' }));
            
            Swal.fire({
                icon: 'error',
                title: 'Koneksi Gagal',
                text: err.response?.data?.remark || 'Tidak dapat menghubungi router. Periksa IP/User/Pass.'
            });
        } finally {
            setIsChecking(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const payload = {
                ...formData,
                router_port: Number(formData.router_port)
            };

            if (isEditMode) {
                await api.put(`/api/routers/${id}`, payload);
            } else {
                await api.post('/api/routers/add', payload);
            }
            
            Swal.fire('Sukses', 'Data router berhasil disimpan', 'success');
            navigate('/admin/routers');
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || 'Gagal menyimpan data.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    if (isLoading) return <div className="p-8 text-center text-slate-500">Memuat form...</div>;

    return (
        <div className="max-w-5xl mx-auto pb-10">
            <button 
                onClick={() => navigate('/admin/routers')}
                className="mb-4 flex items-center text-sm text-slate-500 hover:text-sky-600 transition-colors"
            >
                <ArrowLeft className="mr-1" /> Kembali ke Daftar
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">
                                    {isEditMode ? 'Edit Router' : 'Tambah Router Baru'}
                                </h2>
                                <p className="text-sm text-slate-500">Konfigurasi koneksi perangkat.</p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors duration-300
                                ${formData.router_status === 'Enable' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {formData.router_status === 'Enable' ? <CheckCircle weight="fill"/> : <XCircle weight="fill"/>}
                                {formData.router_status}
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {error && (
                                <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded">
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Identitas Router</label>
                                    <input type="text" name="router_name" value={formData.router_name} onChange={handleChange} required placeholder="Contoh: Mikrotik-Gedung-A" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all" />
                                    <p className="text-xs text-slate-400 mt-1">Nama pengenal untuk di dashboard.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">IP Address / Host</label>
                                    <input type="text" name="router_address" value={formData.router_address} onChange={handleChange} required placeholder="192.168.88.1" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all" />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Port API</label>
                                    <input type="number" name="router_port" value={formData.router_port} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all" />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                                    <input type="text" name="router_username" value={formData.router_username} onChange={handleChange} required autoComplete="off" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all" />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Password {isEditMode && <span className="text-slate-400 text-xs font-normal">(Opsional)</span>}
                                    </label>
                                    <input type="password" name="router_password" value={formData.router_password} onChange={handleChange} required={!isEditMode} autoComplete="new-password" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all" />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipe Router & Versi</label>
                                    
                                    <div className={`w-full px-3 py-2 border rounded-lg flex items-center justify-between transition-all duration-500
                                        ${connectionInfo 
                                            ? 'bg-green-50 border-green-200 shadow-sm' 
                                            : 'bg-slate-50 border-slate-300'
                                        }`}>
                                        
                                        <div className="flex items-center gap-2.5">
                                            <div className={`p-1 rounded ${connectionInfo ? 'bg-white text-green-600' : 'text-slate-400'}`}>
                                                <Cpu size={20} weight={connectionInfo ? "fill" : "duotone"} />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">MikroTik RouterOS</span>
                                        </div>

                                        {connectionInfo ? (
                                            <div className="flex items-center gap-2 animate-fade-in">
                                                <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-green-100 shadow-sm" title="Model Perangkat">
                                                    <Tag size={14} className="text-sky-600" weight="fill"/>
                                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                                        {connectionInfo.board_name || connectionInfo.model || 'Unknown'}
                                                    </span>
                                                </div>
                                                
                                                <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-green-100 shadow-sm" title="Versi RouterOS">
                                                    <Hash size={14} className="text-purple-600" weight="bold"/>
                                                    <span className="text-xs font-bold text-slate-800">
                                                        v{connectionInfo.version || '-'}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] italic text-slate-400">
                                                (Menunggu hasil cek koneksi...)
                                            </span>
                                        )}
                                    </div>

                                    <input type="hidden" name="router_type" value="MikroTik" />
                                </div>

                                <div>
                                     <label className="block text-sm font-medium text-slate-700 mb-1">Metode Remote</label>
                                     <div className="flex gap-4 mt-2">
                                        {['API', 'API-SSL'].map((type) => (
                                            <label key={type} className="flex items-center cursor-pointer group">
                                                <input type="radio" name="router_remote_type" value={type} checked={formData.router_remote_type === type} onChange={handleChange} className="w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer" />
                                                <span className="ml-2 text-sm text-slate-700 group-hover:text-sky-600 transition-colors">{type}</span>
                                            </label>
                                        ))}
                                     </div>
                                </div>

                                {/* Hidden Select for Status (Controlled by Check Connection) */}
                                <div className="hidden">
                                    <select name="router_status" value={formData.router_status} onChange={handleChange}>
                                        <option value="Enable">Enable</option>
                                        <option value="Disable">Disable</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-6 flex items-center justify-between border-t border-slate-100">
                                {/* TOMBOL CEK KONEKSI */}
                                <button
                                    type="button"
                                    onClick={handleCheckConnection}
                                    disabled={isChecking}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border
                                        ${isChecking 
                                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                                            : 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50 hover:border-sky-300 shadow-sm hover:shadow'
                                        }`}
                                >
                                    {isChecking ? <CircleNotch className="animate-spin" size={18}/> : <Lightning size={18} weight="fill"/>}
                                    {isChecking ? 'Menghubungkan...' : 'Cek Koneksi'}
                                </button>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-sm disabled:opacity-70 hover:shadow-md"
                                >
                                    {isSubmitting ? <CircleNotch className="animate-spin" size={20} /> : <FloppyDisk size={20} />}
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* --- KOLOM KANAN: PANEL INFO KONEKSI --- */}
                <div className="lg:col-span-1">
                    <div className={`rounded-xl border shadow-sm overflow-hidden transition-all duration-500 h-full
                        ${connectionInfo ? 'bg-white border-green-200 ring-1 ring-green-500/30' : 'bg-slate-50 border-slate-200 border-dashed'}`}>
                        
                        <div className={`p-4 border-b flex items-center gap-2 ${connectionInfo ? 'bg-green-50 border-green-100' : 'bg-slate-100 border-slate-200'}`}>
                            <Cpu size={20} className={connectionInfo ? "text-green-600" : "text-slate-400"} />
                            <h3 className={`font-semibold text-sm ${connectionInfo ? 'text-green-800' : 'text-slate-500'}`}>
                                Informasi Perangkat
                            </h3>
                        </div>

                        <div className="p-5">
                            {isChecking ? (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                    <CircleNotch size={32} className="animate-spin mb-3 text-sky-500"/>
                                    <p className="text-sm font-medium text-slate-600">Mengambil Data System...</p>
                                    <p className="text-xs">Mohon tunggu sebentar</p>
                                </div>
                            ) : connectionInfo ? (
                                <div className="space-y-5 animate-fade-in">
                                    <div className="text-center">
                                        <div className="w-14 h-14 mx-auto bg-gradient-to-br from-green-100 to-emerald-100 text-green-600 rounded-full flex items-center justify-center mb-3 shadow-sm">
                                            <CheckCircle size={32} weight="fill"/>
                                        </div>
                                        <p className="text-base font-bold text-slate-800">Koneksi Berhasil</p>
                                        <p className="text-xs text-slate-500 mt-1">Status diupdate ke <span className="font-bold text-green-600">Enable</span></p>
                                    </div>

                                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-3">
                                        {/* TIPE MIKROTIK (BOARD NAME) */}
                                        <div className="flex items-start gap-3">
                                            <Tag className="text-sky-500 mt-0.5" size={18} />
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Model Perangkat</p>
                                                <p className="text-sm font-bold text-slate-800">{connectionInfo.board_name || connectionInfo.model || 'Unknown'}</p>
                                            </div>
                                        </div>

                                        {/* VERSI MIKROTIK */}
                                        <div className="flex items-start gap-3 border-t border-slate-200 pt-3">
                                            <Hash className="text-purple-500 mt-0.5" size={18} />
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Versi RouterOS</p>
                                                <p className="text-sm font-bold text-slate-800">{connectionInfo.version || '-'}</p>
                                            </div>
                                        </div>

                                        {/* CPU */}
                                        <div className="flex items-start gap-3 border-t border-slate-200 pt-3">
                                            <Cpu className="text-orange-500 mt-0.5" size={18} />
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">CPU</p>
                                                <p className="text-sm font-medium text-slate-700">{connectionInfo.cpu || '-'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-400">
                                    <Lightning size={48} className="mx-auto mb-3 opacity-20" weight="duotone"/>
                                    <p className="text-sm font-medium text-slate-500">Belum ada data</p>
                                    <p className="text-xs mt-1 max-w-[200px] mx-auto">Klik tombol "Cek Koneksi" untuk menampilkan tipe & versi Mikrotik.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RouterFormScreen;