import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/AxiosInstance';
import Swal from 'sweetalert2';
import { 
    MapContainer, 
    TileLayer, 
    Marker, 
    useMapEvents,
    useMap
} from 'react-leaflet';
import L from 'leaflet';
import { 
    ArrowLeft, 
    User, 
    Phone, 
    House, 
    Cpu as RouterIcon, 
    MapPin, 
    Camera, 
    Spinner,
    CheckCircle,
    MapTrifold,
    Tag,
    PencilLine,
    Globe,
    Barcode,
    Key
} from '@phosphor-icons/react';

// Perbaikan bug icon leaflet yang hilang saat production bundle
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface RouterOption {
    router_id: string;
    router_name: string;
}

interface InternetPackage {
    package_id: number;
    package_name: string;
    package_limit: string;
    package_price: number;
    package_desc: string;
}

interface MapOdpNode {
    node_id: number;
    name: string;
    type: string;
}

// Map Click Listener Component
const MapClickListener: React.FC<{ onSelect: (lat: number, lng: number) => void }> = ({ onSelect }) => {
    useMapEvents({
        click(e) {
            onSelect(e.latlng.lat, e.latlng.lng);
        }
    });
    return null;
};

// Map View Reset Component
const ChangeMapView: React.FC<{ center: [number, number] }> = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
};

const ClientFormScreen: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;

    // Form States
    const [name, setName] = useState<string>('');
    const [phone, setPhone] = useState<string>('');
    const [address, setAddress] = useState<string>('');
    const [routerId, setRouterId] = useState<string>('');
    
    // Area FAT (ODP) selection
    const [fat, setFat] = useState<string>('');
    const [fatMode, setFatMode] = useState<'select' | 'manual'>('select');
    const [odpNodes, setOdpNodes] = useState<MapOdpNode[]>([]);

    // Internet Package
    const [packageId, setPackageId] = useState<string>('');
    const [packages, setPackages] = useState<InternetPackage[]>([]);

    // Network & ONT parameters
    const [ipAddress, setIpAddress] = useState<string>('');
    const [onuSN, setOnuSN] = useState<string>('');
    const [pppoeUsername, setPppoeUsername] = useState<string>('');

    // Geolocation coordinates
    const [latitude, setLatitude] = useState<number>(0);
    const [longitude, setLongitude] = useState<number>(0);
    const [hasSetLocation, setHasSetLocation] = useState<boolean>(false);
    
    // Default center untuk map display saja (tidak dikirim ke server jika belum diset)
    const mapCenter: [number, number] = hasSetLocation && latitude !== 0 && longitude !== 0
        ? [latitude, longitude]
        : [-7.98, 112.63]; // Default center peta (Sidoarjo/Surabaya area)
    
    // File upload
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string>('');
    
    const [routers, setRouters] = useState<RouterOption[]>([]);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [loadingData, setLoadingData] = useState<boolean>(false);

    // Fetch Routers, Internet Packages, ODP Nodes & Client details (if Edit Mode)
    useEffect(() => {
        const fetchInitialData = async () => {
            if (isEdit) {
                setLoadingData(true);
            }
            try {
                // 1. Fetch Routers
                const routersRes = await api.get('/api/routers');
                if (routersRes.data.status === 'success') {
                    setRouters(routersRes.data.data || []);
                }

                // 2. Fetch Internet Packages
                const packagesRes = await api.get('/api/internetpackages');
                if (packagesRes.data.status === 'success') {
                    setPackages(packagesRes.data.data || []);
                }

                // 3. Fetch Map Nodes to get ODP/FAT lists automatically
                const nodesRes = await api.get('/api/topology');
                if (nodesRes.data.status === 'success') {
                    const allNodes: any[] = nodesRes.data.data.nodes || [];
                    const filteredOdps = allNodes
                        .filter(node => node.type === 'ODP')
                        .map(node => ({
                            node_id: node.node_id,
                            name: node.name,
                            type: node.type
                        }));
                    setOdpNodes(filteredOdps);
                }

                // 4. If edit mode, fetch Client details
                if (isEdit) {
                    const clientRes = await api.get(`/api/clients/${id}`);
                    if (clientRes.data.status === 'success') {
                        const data = clientRes.data.data;
                        setName(data.name || '');
                        setPhone(data.phone || '');
                        setAddress(data.address || '');
                        setRouterId(data.router_id || '');
                        setFat(data.fat || '');
                        setPackageId(data.package_id ? data.package_id.toString() : '');
                        setIpAddress(data.ip_address || '');
                        setOnuSN(data.onu_sn || '');
                        setPppoeUsername(data.pppoe_username || '');
                        if (data.latitude && data.latitude !== 0) {
                            setLatitude(data.latitude);
                            setHasSetLocation(true);
                        }
                        if (data.longitude && data.longitude !== 0) {
                            setLongitude(data.longitude);
                        }
                        if (data.house_photo) {
                            const baseUrl = api.defaults.baseURL || '';
                            setPhotoPreview(`${baseUrl}${data.house_photo}`);
                        }

                        // Jika fat diisi tetapi tidak ada di daftar node ODP, set mode ke manual
                        const matchedOdp = odpNodes.some(o => o.name === data.fat);
                        if (data.fat && !matchedOdp) {
                            setFatMode('manual');
                        }
                    }
                }
            } catch (err) {
                console.error("Gagal inisialisasi form:", err);
                Swal.fire('Error', 'Gagal memuat data dari server.', 'error');
            } finally {
                setLoadingData(false);
            }
        };

        fetchInitialData();
    }, [id, isEdit]);

    // Auto-map router based on fat (ODP) selection
    useEffect(() => {
        if (!fat) return;
        const fetchRouterFromMapping = async () => {
            try {
                const res = await api.get(`/api/mappings/by-odp-name/${encodeURIComponent(fat)}`);
                if (res.data.status === 'success' && res.data.data.router_id) {
                    setRouterId(res.data.data.router_id);
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: `Router otomatis terpetakan untuk area ODP ${fat}!`,
                        showConfirmButton: false,
                        timer: 2000
                    });
                }
            } catch (err) {
                console.log("No routing mapping defined for ODP:", fat);
            }
        };
        fetchRouterFromMapping();
    }, [fat]);

    // Handle Location Click on Map
    const handleLocationSelect = (lat: number, lng: number) => {
        setLatitude(lat);
        setLongitude(lng);
        setHasSetLocation(true);
    };

    // Trigger Geolocation API to lock current position
    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            Swal.fire('Opsi Tidak Didukung', 'Browser Anda tidak mendukung layanan Geolocation.', 'warning');
            return;
        }

        Swal.fire({
            title: 'Mencari Lokasi GPS...',
            html: 'Sedang menghubungi satelit GPS perangkat Anda.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        navigator.geolocation.getCurrentPosition(
            (position) => {
                Swal.close();
                setLatitude(position.coords.latitude);
                setLongitude(position.coords.longitude);
                setHasSetLocation(true);
                
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Lokasi berhasil terkunci!',
                    showConfirmButton: false,
                    timer: 2000
                });
            },
            () => {
                Swal.close();
                Swal.fire('Gagal Mengunci Lokasi', 'Pastikan izin akses lokasi aktif pada browser Anda.', 'error');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // Handle Photo Change
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    // Form Submit Action
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name.trim()) {
            Swal.fire('Validasi Gagal', 'Nama pelanggan wajib diisi.', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        formData.append('phone', phone);
        formData.append('address', address);
        formData.append('router_id', routerId);
        formData.append('fat', fat);
        formData.append('package_id', packageId);
        formData.append('latitude', latitude.toString());
        formData.append('longitude', longitude.toString());
        formData.append('ip_address', ipAddress);
        formData.append('onu_sn', onuSN);
        formData.append('pppoe_username', pppoeUsername);
        
        if (photoFile) {
            formData.append('house_photo', photoFile);
        }

        setSubmitting(true);
        try {
            let res;
            if (isEdit) {
                res = await api.put(`/api/clients/${id}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                res = await api.post('/api/clients', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            if (res.data.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: isEdit ? 'Pelanggan Diperbarui!' : 'Pelanggan Ditambahkan!',
                    text: res.data.message || 'Operasi berhasil disimpan.',
                    confirmButtonColor: '#0ea5e9'
                });
                navigate('/admin/clients');
            } else {
                Swal.fire('Gagal', res.data.message || 'Gagal menyimpan data.', 'error');
            }
        } catch (err: any) {
            Swal.fire('Error', err.response?.data?.message || 'Terjadi kesalahan pada server.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingData) {
        return (
            <div className="py-32 flex flex-col items-center justify-center text-slate-400">
                <Spinner className="animate-spin text-sky-500 mb-3" size={32} />
                <span className="font-semibold text-sm">Memuat detail pelanggan...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Title with Back Action */}
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => navigate('/admin/clients')}
                    className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-sky-600 rounded-xl shadow-sm hover:shadow-md transition active:scale-95"
                >
                    <ArrowLeft size={18} weight="bold" />
                </button>
                <div>
                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                        {isEdit ? 'Ubah Data Pelanggan' : 'Tambah Pelanggan Baru'}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Isi seluruh informasi pelanggan, hubungkan ke area ODP (FAT), tentukan paket internet, serta petakan titik koordinat rumahnya.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. KIRI: Form Fields Utama */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                        <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-1.5 text-sm">
                            <User size={18} className="text-sky-500" /> Informasi Pribadi Pelanggan
                        </h3>

                        {/* Input Nama */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap Pelanggan *</label>
                            <div className="relative">
                                <User className="absolute inset-y-0 left-0 h-full w-5 text-slate-400 ml-3.5" />
                                <input 
                                    type="text" 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Masukkan nama lengkap pelanggan..." 
                                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-700 transition"
                                    required
                                />
                            </div>
                        </div>

                        {/* Input Nomor Telepon */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nomor Telepon / Kontak</label>
                            <div className="relative">
                                <Phone className="absolute inset-y-0 left-0 h-full w-5 text-slate-400 ml-3.5" />
                                <input 
                                    type="tel" 
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Contoh: 08123456789" 
                                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-700 transition"
                                />
                            </div>
                        </div>

                        {/* Input Alamat Rumah */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alamat Rumah Lengkap</label>
                            <div className="relative">
                                <House className="absolute left-0 top-3 h-5 w-5 text-slate-400 ml-3.5" />
                                <textarea 
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Masukkan alamat rumah lengkap, blok, nomor rumah..." 
                                    rows={3}
                                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-700 transition"
                                />
                            </div>
                        </div>

                        {/* Dropdown Router */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Router Penampung</label>
                            <div className="relative">
                                <RouterIcon className="absolute inset-y-0 left-0 h-full w-5 text-slate-400 ml-3.5" />
                                <select
                                    value={routerId}
                                    onChange={(e) => setRouterId(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer font-semibold text-slate-650 text-slate-600 bg-white"
                                >
                                    <option value="">-- Hubungkan ke Router Mana (Opsional) --</option>
                                    {routers.map(r => (
                                        <option key={r.router_id} value={r.router_id}>{r.router_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Pilihan Area FAT (ODP) - Hubungkan Dinamis dari ODP Peta */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Area FAT (ODP / Optical Distribution Point)</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFatMode(fatMode === 'select' ? 'manual' : 'select');
                                        setFat('');
                                    }}
                                    className="text-[10px] text-sky-600 hover:text-sky-800 font-bold transition flex items-center gap-1 active:scale-95"
                                >
                                    <PencilLine size={12} />
                                    {fatMode === 'select' ? 'Ketik Manual Area FAT' : 'Pilih dari ODP Peta'}
                                </button>
                            </div>
                            
                            <div className="relative">
                                <MapTrifold className="absolute inset-y-0 left-0 h-full w-5 text-slate-400 ml-3.5" />
                                {fatMode === 'select' ? (
                                    <select
                                        value={fat}
                                        onChange={(e) => setFat(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer font-semibold text-slate-650 text-slate-600 bg-white"
                                    >
                                        <option value="">-- Pilih Kotak ODP dari Peta --</option>
                                        {odpNodes.map(odp => (
                                            <option key={odp.node_id} value={odp.name}>📍 {odp.name} (ODP Map Node)</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input 
                                        type="text" 
                                        value={fat}
                                        onChange={(e) => setFat(e.target.value)}
                                        placeholder="Ketik manual Area FAT (Contoh: FAT-01, ODP-PONDOK-INDAH)" 
                                        className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-700 transition"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Pilihan Paket Internet */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Paket Layanan Internet</label>
                            <div className="relative">
                                <Tag className="absolute inset-y-0 left-0 h-full w-5 text-slate-400 ml-3.5" />
                                <select
                                    value={packageId}
                                    onChange={(e) => setPackageId(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer font-semibold text-slate-650 text-slate-600 bg-white"
                                >
                                    <option value="">-- Pilih Paket Internet (Kecepatan / Harga) --</option>
                                    {packages.map(p => (
                                        <option key={p.package_id} value={p.package_id.toString()}>
                                            ⚡ {p.package_name} ({p.package_limit}) - Rp {p.package_price.toLocaleString('id-ID')} / bulan
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Alamat IP ONT */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alamat IP ONT (IP Address)</label>
                            <div className="relative">
                                <Globe className="absolute inset-y-0 left-0 h-full w-5 text-slate-400 ml-3.5" />
                                <input 
                                    type="text" 
                                    value={ipAddress}
                                    onChange={(e) => setIpAddress(e.target.value)}
                                    placeholder="ex: 192.168.100.15 (Opsional)" 
                                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-700 transition"
                                />
                            </div>
                        </div>

                        {/* Serial Number ONT */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Serial Number ONT (SN ONT)</label>
                            <div className="relative">
                                <Barcode className="absolute inset-y-0 left-0 h-full w-5 text-slate-400 ml-3.5" />
                                <input 
                                    type="text" 
                                    value={onuSN}
                                    onChange={(e) => setOnuSN(e.target.value)}
                                    placeholder="ex: ZTEGC1234567 / HWTC12345678" 
                                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-700 transition"
                                />
                            </div>
                        </div>

                        {/* PPPoE Username */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username PPPoE (Opsional)</label>
                            <div className="relative">
                                <Key className="absolute inset-y-0 left-0 h-full w-5 text-slate-400 ml-3.5" />
                                <input 
                                    type="text" 
                                    value={pppoeUsername}
                                    onChange={(e) => setPppoeUsername(e.target.value)}
                                    placeholder="ex: budi@net (Opsional)" 
                                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-700 transition"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Geolocation Peta Map Container */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                                <MapPin size={18} className="text-indigo-500" /> Koordinat Geografis & Peta
                            </h3>
                            <button
                                type="button"
                                onClick={handleGetLocation}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition active:scale-95 animate-pulse"
                            >
                                <MapPin size={14} weight="fill" /> Gunakan Lokasi GPS Saya Saat Ini
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Latitude (Garis Lintang)</label>
                                <input 
                                    type="number" 
                                    step="any"
                                    value={latitude}
                                    onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-700"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Longitude (Garis Bujur)</label>
                                <input 
                                    type="number" 
                                    step="any"
                                    value={longitude}
                                    onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-semibold text-slate-700"
                                />
                            </div>
                        </div>

                        {/* Interactive Leaflet Map */}
                        <div className="h-64 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner z-10 relative">
                            <MapContainer 
                                center={mapCenter} 
                                zoom={hasSetLocation ? 15 : 13} 
                                style={{ height: '100%', width: '100%' }}
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                />
                                {hasSetLocation && latitude !== 0 && longitude !== 0 && (
                                    <Marker position={[latitude, longitude]} />
                                )}
                                <MapClickListener onSelect={handleLocationSelect} />
                                <ChangeMapView center={mapCenter} />
                            </MapContainer>
                            <div className="absolute bottom-2 left-2 z-[400] bg-slate-900/80 text-white text-[9px] px-2 py-1 rounded backdrop-blur-sm pointer-events-none font-bold">
                                {hasSetLocation 
                                    ? `📍 Koordinat: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                                    : '💡 Klik sembarang titik di peta untuk menentukan lokasi rumah pelanggan'}
                            </div>
                        </div>
                        {!hasSetLocation && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-semibold flex items-center gap-2">
                                <span>⚠️</span> Lokasi belum ditentukan. Klik peta atau gunakan GPS untuk memetakan lokasi rumah. Jika dibiarkan kosong, pelanggan tidak akan muncul di peta jaringan.
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. KANAN: Upload Foto Rumah & Simpan */}
                <div className="space-y-6">
                    {/* Panel Foto */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-1.5 text-sm">
                            <Camera size={18} className="text-emerald-500" /> Foto Fisik Rumah (Opsional)
                        </h3>

                        {/* Preview Dropzone */}
                        <div className="flex flex-col items-center justify-center">
                            {photoPreview ? (
                                <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-slate-200 group">
                                    <img 
                                        src={photoPreview} 
                                        alt="Pratinjau Rumah" 
                                        className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-300">
                                        <label 
                                            htmlFor="house-photo-upload" 
                                            className="bg-white/95 text-slate-800 px-3.5 py-2 rounded-xl text-[10px] font-bold cursor-pointer hover:bg-white active:scale-95 shadow transition"
                                        >
                                            Ganti Foto
                                        </label>
                                    </div>
                                </div>
                            ) : (
                                <label 
                                    htmlFor="house-photo-upload"
                                    className="w-full h-44 border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-2xl flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition"
                                >
                                    <div className="p-3 bg-slate-100 text-slate-400 rounded-full mb-2">
                                        <Camera size={22} />
                                    </div>
                                    <span className="font-bold text-slate-600 text-xs">Pilih Berkas Foto</span>
                                    <span className="text-[9px] text-slate-400 mt-1">Format: JPG, PNG, WEBP (Maks 3MB)</span>
                                </label>
                            )}

                            <input 
                                id="house-photo-upload"
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={handlePhotoChange}
                            />
                        </div>
                    </div>

                    {/* Simpan & Cancel Actions */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 active:scale-98 text-white py-3 rounded-xl font-extrabold text-xs shadow-md shadow-sky-500/10 transition flex items-center justify-center gap-1.5 disabled:opacity-55"
                        >
                            {submitting ? (
                                <><Spinner className="animate-spin" size={16} /> Menyimpan...</>
                            ) : (
                                <><CheckCircle size={16} weight="bold" /> Simpan Data Pelanggan</>
                            )}
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => navigate('/admin/clients')}
                            className="w-full border border-slate-200 hover:bg-slate-50 text-slate-500 py-3 rounded-xl font-bold text-xs transition active:scale-98"
                        >
                            Batal
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default ClientFormScreen;
