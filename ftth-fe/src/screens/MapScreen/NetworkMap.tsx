import React, { useState, useEffect } from 'react';
import { 
    MapContainer, 
    TileLayer, 
    Marker, 
    Popup, 
    Polyline, 
    Tooltip, 
    useMap,
    useMapEvents 
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../api/AxiosInstance';
import Swal from 'sweetalert2';
import { 
    Broadcast, 
    ShareNetwork, 
    Trash, 
    PlugsConnected, 
    Info, 
    PencilSimple, 
    FloppyDisk, 
    X,
    MagnifyingGlass,
    Crosshair,
    RoadHorizonIcon as RouterIcon,
    HardDrives,
    Gear,
    NavigationArrow
} from "@phosphor-icons/react";

// --- 1. LEAFLET ICON FIX ---
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
    iconRetinaUrl, iconUrl, shadowUrl,
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = defaultIcon;

// --- 2. CUSTOM ICONS GENERATOR ---
const createCustomIcon = (color: string, shape: string = 'circle', isFull: boolean = false, isHighlighted: boolean = false) => new L.DivIcon({
    className: 'custom-node-icon',
    html: `<div style="
        background-color: ${color}; 
        width: ${isHighlighted ? (shape === 'square' ? '20px' : '18px') : (shape === 'square' ? '16px' : '14px')}; 
        height: ${isHighlighted ? (shape === 'square' ? '20px' : '18px') : (shape === 'square' ? '16px' : '14px')}; 
        border-radius: ${shape === 'square' ? '4px' : '50%'}; 
        border: ${isHighlighted ? '3px solid white' : '2px solid white'}; 
        box-shadow: 0 0 0 ${isHighlighted ? '4px #f59e0b' : (isFull ? '3px #dc2626' : `2px ${color}`)}, 0 4px 6px rgba(0,0,0,0.3);
        ${isFull ? 'animation: pulse-red 2s infinite;' : ''}
        ${isHighlighted ? 'animation: pulse-gold 1.5s infinite;' : ''}
    "></div>`,
    iconSize: isHighlighted ? [20, 20] : [16, 16], 
    iconAnchor: isHighlighted ? [10, 10] : [8, 8], 
    popupAnchor: [0, -10]
});

// Icon untuk Handle Edit Jalur
const editHandleIcon = new L.DivIcon({
    className: 'edit-handle',
    html: `<div style="background-color: white; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #0ea5e9; cursor: grab; box-shadow: 0 1px 2px rgba(0,0,0,0.4);"></div>`,
    iconSize: [12, 12], iconAnchor: [6, 6]
});

// --- 3. TYPES (Updated dengan Detail Aset) ---
interface NodeData {
    node_id: number;
    name: string;
    type: 'OLT' | 'ODC' | 'ODP' | 'CLIENT' | 'ROUTER' | 'TB';
    lat: number;
    lng: number;
    description: string;
    linked_router_id?: string;
    
    // Detail Aset dari Backend (Preload)
    odp_detail?: { odp_id: number; total_ports: number; used_ports: number };
    olt_detail?: { olt_id: number; brand: string; uplink_type: string; ip_address: string };
    odc_detail?: { odc_id: number; capacity: number };
    client_detail?: { client_id: number; subscriber_id: string; packet_name: string; ip_address?: string; onu_sn?: string; pppoe_username?: string };
}

interface CableData {
    cable_id: number;
    source_node: NodeData;
    target_node: NodeData;
    cable_type: string;
    description: string;
    coordinates: string;
}

// --- 4. SUB-COMPONENTS ---

// FlyTo Helper
const FlyToLocation = ({ coords }: { coords: L.LatLngExpression | null }) => {
    const map = useMap();
    useEffect(() => {
        if (coords) map.flyTo(coords, 18, { duration: 1.5 });
    }, [coords, map]);
    return null;
};

// Helper: Warna kabel berdasarkan tipe
const getCableColor = (type: string) => {
    if (!type) return '#475569';
    const t = type.toLowerCase();
    if (t.includes('backbone') || t.includes('core') || t.includes('uplink')) return '#ef4444';
    if (t.includes('distribusi') || t.includes('feeder') || t.includes('odc')) return '#f97316';
    if (t.includes('drop') || t.includes('client')) return '#22c55e';
    return '#475569';
};

// Editable Cable Component
const EditableCable = ({ 
    cable, isEditing, currentPath, onPathChange, onStartEdit, onDeleteCable, onEditDetails 
}: { 
    cable: CableData, 
    isEditing: boolean, 
    currentPath: L.LatLngExpression[], 
    onPathChange: (p: L.LatLngExpression[]) => void, 
    onStartEdit: () => void, 
    onDeleteCable: (id: number) => void,
    onEditDetails: () => void
}) => {
    const getDisplayPath = () => {
        if (isEditing) return currentPath;
        if (cable.coordinates && cable.coordinates !== "[]") {
            try { return JSON.parse(cable.coordinates); } catch (e) {}
        }
        return [[cable.source_node.lat, cable.source_node.lng], [cable.target_node.lat, cable.target_node.lng]];
    };

    const handleLineClick = (e: any) => {
        if (!isEditing) return;
        const { lat, lng } = e.latlng;
        const updated = [...currentPath];
        if (updated.length >= 2) updated.splice(updated.length - 1, 0, [lat, lng]);
        else updated.push([lat, lng]);
        onPathChange(updated);
    };

    const handleDrag = (idx: number, e: any) => {
        const { lat, lng } = e.target.getLatLng();
        const updated = [...currentPath];
        updated[idx] = [lat, lng];
        onPathChange(updated);
    };

    const handleRightClick = (idx: number) => {
        if (!isEditing || idx === 0 || idx === currentPath.length - 1) return;
        onPathChange(currentPath.filter((_, i) => i !== idx));
    };

    const cableColor = getCableColor(cable.cable_type);

    return (
        <>
            <Polyline 
                positions={getDisplayPath()}
                pathOptions={{ 
                    color: isEditing ? '#0ea5e9' : cableColor, 
                    weight: isEditing ? 4 : 3, opacity: 0.8,
                    dashArray: cable.cable_type?.toLowerCase().includes('drop') ? '5, 10' : undefined 
                }}
                eventHandlers={{ click: handleLineClick }}
            >
                {!isEditing && (
                    <Popup>
                        <div className="text-xs p-1 min-w-[170px]">
                            <div className="font-bold text-slate-700 mb-1 flex justify-between">
                                <span>Kabel #{cable.cable_id}</span><PlugsConnected className="text-sky-600"/>
                            </div>
                            <hr className="my-2 border-slate-200"/>
                            <p><span className="text-slate-400">Dari:</span> {cable.source_node?.name}</p>
                            <p><span className="text-slate-400">Ke:</span> {cable.target_node?.name}</p>
                            <p><span className="text-slate-400">Tipe:</span> <span style={{color: cableColor, fontWeight: 700}}>{cable.cable_type || '-'}</span></p>
                            <p className="mb-3"><span className="text-slate-400">Ket:</span> {cable.description || '-'}</p>
                            <div className="flex gap-1.5">
                                <button onClick={onEditDetails} className="bg-amber-500 hover:bg-amber-600 text-white p-1.5 rounded flex items-center justify-center font-bold shadow-sm" title="Edit Detail Info Kabel"><Gear size={14} weight="bold"/></button>
                                <button onClick={onStartEdit} className="flex-1 bg-sky-500 hover:bg-sky-600 text-white py-1.5 rounded flex items-center justify-center gap-1 font-bold shadow-sm" title="Edit Rute Jalur"><PencilSimple size={13}/> Rute</button>
                                <button onClick={() => onDeleteCable(cable.cable_id)} className="bg-red-500 hover:bg-red-600 text-white py-1.5 px-3 rounded flex items-center justify-center font-bold shadow-sm" title="Hapus Kabel"><Trash size={14}/></button>
                            </div>
                        </div>
                    </Popup>
                )}
            </Polyline>
            {isEditing && currentPath.map((pos, idx) => (
                <Marker key={idx} position={pos} icon={editHandleIcon} draggable={idx !== 0 && idx !== currentPath.length - 1} 
                    eventHandlers={{ drag: (e) => handleDrag(idx, e), contextmenu: () => handleRightClick(idx) }} zIndexOffset={1000} />
            ))}
        </>
    );
};

// Add Node Handler (Klik Kanan & Mode Sentuh) — Dynamic per-type fields + improved UI
const AddNodeHandler = ({ 
    refreshMap, 
    isMapAddingMode, 
    setIsMapAddingMode,
    internetPackages
}: { 
    refreshMap: () => void; 
    isMapAddingMode: boolean; 
    setIsMapAddingMode: (v: boolean) => void;
    internetPackages: any[];
}) => {

    const triggerAddNode = async (lat: number, lng: number) => {
        // Load router list for ROUTER type
        let routerOptionsHtml = '<option value="">-- Pilih Router (Optional) --</option>';
        try {
            const res = await api.get('/api/routers');
            const routers = res.data?.data || [];
            routerOptionsHtml += routers.map((r: any) =>
                `<option value="${r.router_id}">${r.router_name} — ${r.router_address}</option>`
            ).join('');
        } catch (_) {}

        const NODE_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
            ODP:    { label: 'ODP – Optical Distribution Point', icon: '📡', color: '#3b82f6' },
            ODC:    { label: 'ODC – Optical Distribution Cabinet', icon: '🗄️', color: '#f97316' },
            OLT:    { label: 'OLT – Optical Line Terminal', icon: '🔴', color: '#ef4444' },
            ROUTER: { label: 'Router / Mikrotik', icon: '🔀', color: '#8b5cf6' },
            TB:     { label: 'TB – Terminal Box', icon: '📦', color: '#64748b' },
            CLIENT: { label: 'Rumah / Pelanggan', icon: '🏠', color: '#22c55e' },
        };

        await Swal.fire({
            title: '➕ Tambah Node Baru',
            html: `
                <style>
                    .fn-form { text-align:left; }
                    .fn-label { display:block; font-size:11px; font-weight:600; color:#475569; margin-bottom:4px; margin-top:10px; }
                    .fn-input { width:100%; padding:8px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; outline:none; box-sizing:border-box; transition:border-color .2s; }
                    .fn-input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
                    .fn-select { width:100%; padding:8px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; background:#fff; outline:none; box-sizing:border-box; cursor:pointer; }
                    .fn-section { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; margin-top:10px; }
                    .fn-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; margin-bottom:8px; }
                    .fn-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
                    .fn-coords { font-size:10px; color:#94a3b8; margin-top:8px; padding:6px 10px; background:#f1f5f9; border-radius:6px; }
                    .fn-type-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; color:#fff; margin-left:6px; vertical-align:middle; }
                    .type-fields { display:none; }
                    .type-fields.active { display:block; }
                    select option { padding: 4px; }
                </style>
                <div class="fn-form">
                    <label class="fn-label">Jenis Node</label>
                    <select id="swal-node-type" class="fn-select">
                        <option value="ODP">📡 ODP – Optical Distribution Point</option>
                        <option value="ODC">🗄️ ODC – Optical Distribution Cabinet</option>
                        <option value="OLT">🔴 OLT – Optical Line Terminal</option>
                        <option value="ROUTER">🔀 Router / Mikrotik</option>
                        <option value="TB">📦 TB – Terminal Box</option>
                        <option value="CLIENT">🏠 Rumah / Pelanggan</option>
                    </select>

                    <label class="fn-label" style="margin-top:12px">Nama Node <span id="node-type-badge" class="fn-type-badge" style="background-color:#3b82f6">ODP</span></label>
                    <input id="swal-node-name" class="fn-input" placeholder="Contoh: ODP-001-SUKODONO">

                    <!-- ODP Fields -->
                    <div id="fields-odp" class="fn-section type-fields active">
                        <div class="fn-section-title">📡 Detail ODP</div>
                        <label class="fn-label">Total Kapasitas Port</label>
                        <input id="swal-ports" type="number" class="fn-input" placeholder="Default: 8 port" value="8">
                    </div>

                    <!-- OLT Fields -->
                    <div id="fields-olt" class="fn-section type-fields">
                        <div class="fn-section-title">🔴 Detail OLT</div>
                        <label class="fn-label">Brand / Merek OLT</label>
                        <input id="swal-brand" class="fn-input" placeholder="ZTE, Huawei, Hioso, dll.">
                        <div class="fn-row" style="margin-top:6px">
                            <div>
                                <label class="fn-label">Tipe Uplink</label>
                                <input id="swal-uplink" class="fn-input" placeholder="ex: 1G, 10G">
                            </div>
                            <div>
                                <label class="fn-label">IP Address</label>
                                <input id="swal-ip" class="fn-input" placeholder="192.168.1.x">
                            </div>
                        </div>
                    </div>

                    <!-- ODC Fields -->
                    <div id="fields-odc" class="fn-section type-fields">
                        <div class="fn-section-title">🗄️ Detail ODC</div>
                        <label class="fn-label">Kapasitas Core</label>
                        <input id="swal-capacity" type="number" class="fn-input" placeholder="Contoh: 144, 288" value="144">
                    </div>

                    <!-- Client Fields -->
                    <div id="fields-client" class="fn-section type-fields">
                        <div class="fn-section-title">🏠 Detail Pelanggan</div>
                        <div class="fn-row">
                            <div>
                                <label class="fn-label">ID Pelanggan (PPPoE)</label>
                                <input id="swal-subscriber" class="fn-input" placeholder="ex: CUST-01">
                            </div>
                            <div>
                                <label class="fn-label">Paket Layanan</label>
                                <select id="swal-packet" class="fn-select">
                                    <option value="">-- Pilih Paket --</option>
                                    ${internetPackages.map(p => `<option value="${p.package_name}">${p.package_name} - Rp ${p.package_price.toLocaleString('id-ID')}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <label class="fn-label" style="margin-top:8px">Router Penampung (Opsional)</label>
                        <select id="swal-client-router" class="fn-select">
                            ${routerOptionsHtml}
                        </select>
                    </div>

                    <!-- Router Fields -->
                    <div id="fields-router" class="fn-section type-fields">
                        <div class="fn-section-title">🔀 Hubungkan ke Router Mikrotik</div>
                        <label class="fn-label">Pilih Router Aktif</label>
                        <select id="swal-linked-router" class="fn-select">
                            ${routerOptionsHtml}
                        </select>
                        <p style="font-size:10px; color:#64748b; margin-top:4px">Koneksi ini digunakan untuk monitoring traffic interface di dashboard.</p>
                    </div>

                    <label class="fn-label">Keterangan / Deskripsi</label>
                    <input id="swal-desc" class="fn-input" placeholder="Lokasi tiang, detail alamat, dll.">

                    <div class="fn-coords">
                        📍 Koordinat: <b>${lat.toFixed(6)}, ${lng.toFixed(6)}</b>
                    </div>
                </div>
            `,
            width: '26rem',
            customClass: {
                popup: 'swal-wide-popup'
            },
            showCancelButton: true,
            confirmButtonText: 'Simpan',
            cancelButtonText: 'Batal',
            focusConfirm: false,
            didOpen: () => {
                const typeSelect = document.getElementById('swal-node-type') as HTMLSelectElement;
                const badge = document.getElementById('node-type-badge');
                
                typeSelect?.addEventListener('change', (ev) => {
                    const selected = (ev.target as HTMLSelectElement).value;
                    const meta = NODE_TYPE_META[selected];
                    
                    if (badge && meta) {
                        badge.innerText = selected;
                        badge.style.backgroundColor = meta.color;
                    }

                    // Tampilkan field khusus tipe
                    document.querySelectorAll('.type-fields').forEach(el => el.classList.remove('active'));
                    const targetField = document.getElementById(`fields-${selected.toLowerCase()}`);
                    if (targetField) targetField.classList.add('active');
                });
            },
            preConfirm: () => {
                const type = (document.getElementById('swal-node-type') as HTMLSelectElement).value;
                const name = (document.getElementById('swal-node-name') as HTMLInputElement).value.trim();
                
                if (!name) {
                    Swal.showValidationMessage('Nama node wajib diisi!');
                    return false;
                }

                return {
                    name,
                    type,
                    lat,
                    lng,
                    description: (document.getElementById('swal-desc') as HTMLInputElement).value.trim(),
                    status: 'ONLINE',
                    total_ports: type === 'ODP' 
                        ? parseInt((document.getElementById('swal-ports') as HTMLInputElement)?.value) || 8 
                        : 0,
                    used_ports: type === 'ODP'
                        ? 0 
                        : 0,
                    brand: type === 'OLT'
                        ? (document.getElementById('swal-brand') as HTMLInputElement)?.value || ''
                        : '',
                    uplink_type: type === 'OLT'
                        ? (document.getElementById('swal-uplink') as HTMLInputElement)?.value || ''
                        : '',
                    ip_address: type === 'OLT'
                        ? (document.getElementById('swal-ip') as HTMLInputElement)?.value || ''
                        : '',
                    capacity: type === 'ODC'
                        ? parseInt((document.getElementById('swal-capacity') as HTMLInputElement)?.value) || 144
                        : 0,
                    subscriber_id: type === 'CLIENT'
                        ? (document.getElementById('swal-subscriber') as HTMLInputElement)?.value || ''
                        : '',
                    packet_name: type === 'CLIENT'
                        ? (document.getElementById('swal-packet') as HTMLSelectElement)?.value || ''
                        : '',
                    linked_router_id: type === 'ROUTER'
                        ? (document.getElementById('swal-linked-router') as HTMLSelectElement)?.value || ''
                        : type === 'CLIENT'
                        ? (document.getElementById('swal-client-router') as HTMLSelectElement)?.value || ''
                        : '',
                };
            }
        }).then(async (res) => {
            if (res.isConfirmed && res.value) {
                await api.post('/api/nodes', res.value);
                refreshMap();
                const meta = NODE_TYPE_META[res.value.type];
                Swal.fire({
                    toast: true,
                    icon: 'success',
                    title: `${meta?.icon || '✅'} ${res.value.name} ditambahkan`,
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false,
                });
            }
        });
    };

    useMapEvents({
        contextmenu(e) {
            // Selalu izinkan klik kanan di desktop langsung
            triggerAddNode(e.latlng.lat, e.latlng.lng);
        },
        click(e) {
            // Jika mode sentuh/tambah di HP aktif, klik/sentuh peta akan menambahkan node
            if (isMapAddingMode) {
                setIsMapAddingMode(false);
                triggerAddNode(e.latlng.lat, e.latlng.lng);
            }
        }
    });

    return null;
};

// ==========================================
// MAIN COMPONENT
// ==========================================
const NetworkMap: React.FC = () => {
    const [nodes, setNodes] = useState<NodeData[]>([]);
    const [cables, setCables] = useState<CableData[]>([]);
    const [internetPackages, setInternetPackages] = useState<any[]>([]);
    
    // UI State
    const [isConnecting, setIsConnecting] = useState(false);
    const [sourceNode, setSourceNode] = useState<NodeData | null>(null);
    const [editingCableId, setEditingCableId] = useState<number | null>(null);
    const [tempPath, setTempPath] = useState<L.LatLngExpression[]>([]); 
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<NodeData[]>([]);
    const [showSearchPanel, setShowSearchPanel] = useState(false);
    const [highlightedNodeId, setHighlightedNodeId] = useState<number | null>(null);
    const searchRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const [flyToCoords, setFlyToCoords] = useState<L.LatLngExpression | null>(null);
    const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(['OLT','ODC','ODP','CLIENT','ROUTER','TB']));
    const [showLayerPanel, setShowLayerPanel] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showToolbar, setShowToolbar] = useState(false);
    const [isMapAddingMode, setIsMapAddingMode] = useState(false);

    const toggleLayer = (type: string) => {
        setVisibleTypes(prev => {
            const next = new Set(prev);
            next.has(type) ? next.delete(type) : next.add(type);
            return next;
        });
    };

    // --- HELPER: GET ICON COLOR BASED ON CAPACITY ---
    const getNodeIcon = (node: NodeData) => {
        let color = '#64748b'; // Default Grey
        let shape = 'circle';
        let isFull = false;
        const isHighlighted = highlightedNodeId === node.node_id;

        if (node.type === 'OLT') color = '#ef4444'; // Merah
        if (node.type === 'ODC') color = '#f97316'; // Orange
        if (node.type === 'CLIENT') color = '#22c55e'; // Hijau
        if (node.type === 'ROUTER' || node.type === 'TB') {
            color = node.type === 'ROUTER' ? '#8b5cf6' : '#64748b';
            shape = 'square';
        }

        // LOGIC CAPACITY PLANNING UNTUK ODP
        if (node.type === 'ODP' && node.odp_detail) {
            const { used_ports, total_ports } = node.odp_detail;
            const percentage = (used_ports / total_ports) * 100;

            if (used_ports >= total_ports) {
                color = '#dc2626'; // Merah Tua (PENUH)
                isFull = true;
            } else if (percentage >= 75) {
                color = '#eab308'; // Kuning (Hampir Penuh)
            } else {
                color = '#3b82f6'; // Biru (Aman)
            }
        } else if (node.type === 'ODP') {
            color = '#3b82f6'; // Default Biru jika detail belum load
        }

        return createCustomIcon(color, shape, isFull, isHighlighted);
    };

    // --- API CALLS ---
    const fetchTopology = async () => {
        try {
            const res = await api.get('/api/topology');
            if (res.data.status === 'success') {
                setNodes(res.data.data.nodes || []);
                setCables(res.data.data.cables || []);
            }
        } catch (err) { console.error(err); }
    };

    const fetchInternetPackages = async () => {
        try {
            const res = await api.get('/api/internetpackages');
            if (res.data.status === 'success') {
                setInternetPackages(res.data.data || []);
            }
        } catch (err) {
            console.error("Gagal load packages di map:", err);
        }
    };

    useEffect(() => { 
        fetchTopology(); 
        fetchInternetPackages();
    }, []);

    // Click-outside handler untuk menutup panel search
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSearchPanel(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- ACTIONS ---
    const handleSavePath = async () => {
        if (!editingCableId) return;
        try {
            await api.put(`/api/cables/${editingCableId}/path`, { coordinates: JSON.stringify(tempPath), length_meter: 0 });
            setEditingCableId(null); fetchTopology();
            Swal.fire({ toast: true, icon: 'success', title: 'Jalur tersimpan', position: 'top-end', timer: 1500 });
        } catch (e) { Swal.fire('Error', 'Gagal simpan', 'error'); }
    };

    const handleStartEdit = (cable: CableData) => {
        setEditingCableId(cable.cable_id);
        let path: L.LatLngExpression[] = [];
        try { path = JSON.parse(cable.coordinates); } catch {}
        if (!path.length) path = [[cable.source_node.lat, cable.source_node.lng], [cable.target_node.lat, cable.target_node.lng]];
        setTempPath(path);
    };

    const handleEditCableDetails = async (cable: CableData) => {
        // Pre-determine standard value vs custom
        const stdTypes = ['BACKBONE', 'DISTRIBUSI', 'DROP CLIENT'];
        const isCustom = cable.cable_type && !stdTypes.includes(cable.cable_type.toUpperCase());
        const initialDropdown = isCustom ? 'KUSTOM' : (cable.cable_type || 'BACKBONE').toUpperCase();
        const CSS = `
            <style>
                .fn-form { text-align:left; }
                .fn-label { display:block; font-size:11px; font-weight:600; color:#475569; margin-bottom:4px; margin-top:12px; }
                .fn-input { width:100%; padding:8px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; outline:none; box-sizing:border-box; transition:border-color .2s; }
                .fn-input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
                .fn-select { width:100%; padding:8px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; background:#fff; outline:none; box-sizing:border-box; cursor:pointer; }
                .fn-select:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
                .fn-hint { font-size:10px; color:#94a3b8; margin-top:6px; padding:6px 10px; background:#f1f5f9; border-radius:6px; line-height:1.5; }
                .fn-badge { display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; color:#fff; }
                .fn-path-container { background:#f8fafc; border:1.5px dashed #cbd5e1; border-radius:10px; padding:10px 12px; font-size:11px; margin-top:6px; color:#475569; }
                .fn-row-arrow { display:flex; align-items:center; justify-content:space-between; margin:4px 0; }
                #custom-type-wrapper { display:none; }
                #custom-type-wrapper.active { display:block; }
            </style>
        `;

        await Swal.fire({
            title: '⚙️ Edit Detail Kabel',
            html: CSS + `
                <div class="fn-form">
                    <div class="fn-path-container">
                        <div class="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-2">Jalur Koneksi</div>
                        <div class="fn-row-arrow">
                            <div>📍 <b>${cable.source_node?.name}</b> <span class="text-[9px] text-slate-400">(${cable.source_node?.type})</span></div>
                            <div class="text-slate-400 font-bold px-2">➡️</div>
                            <div>📍 <b>${cable.target_node?.name}</b> <span class="text-[9px] text-slate-400">(${cable.target_node?.type})</span></div>
                        </div>
                    </div>

                    <label class="fn-label">Tipe / Kategori Kabel</label>
                    <select id="swal-cable-dropdown" class="fn-select">
                        <option value="BACKBONE" ${initialDropdown === 'BACKBONE' ? 'selected' : ''}>🔴 Backbone / Core Link</option>
                        <option value="DISTRIBUSI" ${initialDropdown === 'DISTRIBUSI' ? 'selected' : ''}>🟠 Distribusi / Feeder Link</option>
                        <option value="DROP CLIENT" ${initialDropdown === 'DROP CLIENT' ? 'selected' : ''}>🟢 Drop / Client Core</option>
                        <option value="KUSTOM" ${initialDropdown === 'KUSTOM' ? 'selected' : ''}>⚫ Tipe Lain (Kustom)</option>
                    </select>

                    <div id="custom-type-wrapper" class="${isCustom ? 'active' : ''}">
                        <label class="fn-label">Nama Tipe Kabel Kustom</label>
                        <input id="swal-cable-custom-input" class="fn-input" placeholder="ex: Dropcore 2 Core, Precon 150m" value="${isCustom ? cable.cable_type : ''}">
                    </div>

                    <label class="fn-label">Keterangan / Rincian</label>
                    <input id="swal-cable-desc" class="fn-input" placeholder="ex: Tiang PLN A1 ke Tiang A5" value="${cable.description || ''}">
                </div>
            `,
            width: '26rem',
            customClass: { popup: 'swal-wide-popup' },
            showCancelButton: true,
            confirmButtonText: 'Simpan',
            cancelButtonText: 'Batal',
            focusConfirm: false,
            didOpen: () => {
                const dropdown = document.getElementById('swal-cable-dropdown') as HTMLSelectElement;
                const wrapper = document.getElementById('custom-type-wrapper');
                
                dropdown?.addEventListener('change', (ev) => {
                    const val = (ev.target as HTMLSelectElement).value;
                    if (val === 'KUSTOM') {
                        wrapper?.classList.add('active');
                    } else {
                        wrapper?.classList.remove('active');
                    }
                });
            },
            preConfirm: () => {
                const dropdownVal = (document.getElementById('swal-cable-dropdown') as HTMLSelectElement).value;
                const desc = (document.getElementById('swal-cable-desc') as HTMLInputElement).value.trim();
                
                let finalType = dropdownVal;
                if (dropdownVal === 'KUSTOM') {
                    finalType = (document.getElementById('swal-cable-custom-input') as HTMLInputElement).value.trim();
                    if (!finalType) {
                        Swal.showValidationMessage('Nama tipe kustom wajib diisi!');
                        return false;
                    }
                }

                return {
                    cable_type: finalType,
                    description: desc
                };
            }
        }).then(async (res) => {
            if (res.isConfirmed && res.value) {
                try {
                    await api.put(`/api/cables/${cable.cable_id}`, res.value);
                    fetchTopology();
                    Swal.fire({
                        toast: true,
                        icon: 'success',
                        title: 'Detail kabel berhasil diperbarui',
                        position: 'top-end',
                        timer: 2000,
                        showConfirmButton: false,
                    });
                } catch {
                    Swal.fire('Error', 'Gagal memperbarui detail kabel', 'error');
                }
            }
        });
    };

    const handleDeleteNode = async (id: number, name: string) => {
        const res = await Swal.fire({ title: `Hapus ${name}?`, html: 'Node & semua kabel yang terhubung akan dihapus!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Hapus' });
        if (res.isConfirmed) { await api.delete(`/api/nodes/${id}`); fetchTopology(); }
    };

    const handleDeleteCable = async (id: number) => {
        const res = await Swal.fire({ title: 'Hapus kabel ini?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Hapus' });
        if (res.isConfirmed) { await api.delete(`/api/cables/${id}`); fetchTopology(); }
    };

    // Update Detail Aset per tipe node
    const handleEditDetails = async (node: NodeData) => {
        // Pre-load router list always (needed only for ROUTER type, but harmless otherwise)
        let routerOptionsHtml = '<option value="">-- Pilih Router (Optional) --</option>';
        try {
            const res = await api.get('/api/routers');
            const routers = res.data?.data || [];
            routerOptionsHtml += routers.map((r: any) =>
                `<option value="${r.router_id}" ${node.linked_router_id === r.router_id ? 'selected' : ''}>${r.router_name} — ${r.router_address}</option>`
            ).join('');
        } catch (e) {
            console.error('Gagal mengambil router:', e);
        }

        const NODE_ICONS: Record<string, string> = {
            ODP: '📡', OLT: '🔴', ODC: '🗄️', CLIENT: '🏠', ROUTER: '🔀', TB: '📦'
        };

        const CSS = `
            <style>
                .fn-form { text-align:left; }
                .fn-label { display:block; font-size:11px; font-weight:600; color:#475569; margin-bottom:4px; margin-top:12px; }
                .fn-input { width:100%; padding:8px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; outline:none; box-sizing:border-box; transition:border-color .2s; }
                .fn-input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
                .fn-input:disabled { background:#f8fafc; color:#94a3b8; cursor:not-allowed; }
                .fn-select { width:100%; padding:8px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; background:#fff; outline:none; box-sizing:border-box; cursor:pointer; }
                .fn-select:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
                .fn-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
                .fn-hint { font-size:10px; color:#94a3b8; margin-top:6px; padding:6px 10px; background:#f1f5f9; border-radius:6px; line-height:1.5; }
                .fn-node-badge { display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:700; background:#f1f5f9; color:#475569; margin-bottom:12px; }
            </style>`;

        let htmlContent = '';

        if (node.type === 'ODP') {
            htmlContent = CSS + `
                <div class="fn-form">
                    <div class="fn-node-badge">📡 ODP – Optical Distribution Point</div>
                    <label class="fn-label">Total Kapasitas Port</label>
                    <input id="edit-total-ports" type="number" class="fn-input" value="${node.odp_detail?.total_ports || 8}">
                    <label class="fn-label">Port Terpakai <span style="color:#94a3b8;font-weight:400">(dihitung otomatis dari kabel)</span></label>
                    <input id="edit-used-ports" type="number" class="fn-input" value="${node.odp_detail?.used_ports || 0}" disabled>
                    <div class="fn-hint">💡 Port terpakai dihitung dari jumlah kabel yang terhubung ke ODP ini di peta. Tidak bisa diubah manual.</div>
                </div>`;
        } else if (node.type === 'OLT') {
            htmlContent = CSS + `
                <div class="fn-form">
                    <div class="fn-node-badge">🔴 OLT – Optical Line Terminal</div>
                    <label class="fn-label">Brand / Merek OLT</label>
                    <input id="edit-brand" class="fn-input" value="${node.olt_detail?.brand || ''}" placeholder="ZTE, Huawei, Hioso, dll.">
                    <div class="fn-row">
                        <div>
                            <label class="fn-label">Tipe Uplink</label>
                            <input id="edit-uplink-type" class="fn-input" value="${node.olt_detail?.uplink_type || ''}" placeholder="ex: 1G, 10G">
                        </div>
                        <div>
                            <label class="fn-label">IP Address</label>
                            <input id="edit-ip-address" class="fn-input" value="${node.olt_detail?.ip_address || ''}" placeholder="192.168.x.x">
                        </div>
                    </div>
                </div>`;
        } else if (node.type === 'ODC') {
            htmlContent = CSS + `
                <div class="fn-form">
                    <div class="fn-node-badge">🗄️ ODC – Optical Distribution Cabinet</div>
                    <label class="fn-label">Kapasitas Core</label>
                    <input id="edit-capacity" type="number" class="fn-input" value="${node.odc_detail?.capacity || 144}" placeholder="48, 96, 144, 288 core">
                    <div class="fn-hint">💡 Umumnya ODC tersedia dalam kapasitas 48, 96, 144, atau 288 core.</div>
                </div>`;
        } else if (node.type === 'CLIENT') {
            const packageOptionsHtml = internetPackages.map(p => {
                const isSelected = (node.client_detail?.packet_name === p.package_name) ? 'selected' : '';
                return `<option value="${p.package_name}" ${isSelected}>⚡ ${p.package_name} - Rp ${p.package_price.toLocaleString('id-ID')}</option>`;
            }).join('');

            htmlContent = CSS + `
                <div class="fn-form">
                    <div class="fn-node-badge">🏠 Rumah / Pelanggan</div>
                    
                    <label class="fn-label">ID Pelanggan (System ID)</label>
                    <input id="edit-subscriber-id" class="fn-input" value="${node.client_detail?.subscriber_id || ''}" readonly style="background-color: #f1f5f9; cursor: not-allowed;">
                    
                    <label class="fn-label">Alamat IP ONT (IP Address)</label>
                    <input id="edit-ip-address" class="fn-input" value="${node.client_detail?.ip_address || ''}" placeholder="ex: 192.168.100.15">
                    
                    <label class="fn-label">Serial Number ONT (SN ONT)</label>
                    <input id="edit-onu-sn" class="fn-input" value="${node.client_detail?.onu_sn || ''}" placeholder="ex: ZTEGC1234567 / HWTC12345678">

                    <label class="fn-label">Username PPPoE (Opsional)</label>
                    <input id="edit-pppoe-username" class="fn-input" value="${node.client_detail?.pppoe_username || ''}" placeholder="ex: budi@net">

                    <label class="fn-label">Paket Internet</label>
                    <select id="edit-packet-name" class="fn-select">
                        <option value="">-- Pilih Paket Internet --</option>
                        ${packageOptionsHtml}
                    </select>
                </div>`;
        } else if (node.type === 'ROUTER') {
            htmlContent = CSS + `
                <div class="fn-form">
                    <div class="fn-node-badge">🔀 Router / Mikrotik</div>
                    <label class="fn-label">Hubungkan ke Router Mikrotik</label>
                    <select id="edit-linked-router" class="fn-select">${routerOptionsHtml}</select>
                    <div class="fn-hint">💡 Menghubungkan node peta ini dengan perangkat router Mikrotik agar dapat dipantau traffic-nya secara real-time.</div>
                </div>`;
        } else {
            return Swal.fire({
                icon: 'info',
                title: '📦 Terminal Box',
                text: 'Terminal Box tidak memiliki pengaturan detail khusus selain nama dan deskripsi.'
            });
        }

        const { value: form } = await Swal.fire({
            title: `${NODE_ICONS[node.type] || '⚙️'} Edit Detail — ${node.name}`,
            html: htmlContent,
            showCancelButton: true,
            confirmButtonText: '💾 Simpan',
            confirmButtonColor: '#3b82f6',
            cancelButtonText: 'Batal',
            customClass: { popup: 'swal-wide-popup' },
            preConfirm: () => {
                const totalPorts = document.getElementById('edit-total-ports') as HTMLInputElement;
                const usedPorts = document.getElementById('edit-used-ports') as HTMLInputElement;
                const brand = document.getElementById('edit-brand') as HTMLInputElement;
                const uplinkType = document.getElementById('edit-uplink-type') as HTMLInputElement;
                const ipAddress = document.getElementById('edit-ip-address') as HTMLInputElement;
                const onuSn = document.getElementById('edit-onu-sn') as HTMLInputElement;
                const pppoeUsername = document.getElementById('edit-pppoe-username') as HTMLInputElement;
                const capacity = document.getElementById('edit-capacity') as HTMLInputElement;
                const subscriberId = document.getElementById('edit-subscriber-id') as HTMLInputElement;
                const packetName = document.getElementById('edit-packet-name') as HTMLInputElement;
                const linkedRouterId = document.getElementById('edit-linked-router') as HTMLSelectElement;
                return {
                    type: node.type,
                    total_ports: totalPorts ? parseInt(totalPorts.value) : 0,
                    used_ports: usedPorts ? parseInt(usedPorts.value) : 0,
                    brand: brand ? brand.value : '',
                    uplink_type: uplinkType ? uplinkType.value : '',
                    ip_address: ipAddress ? ipAddress.value : '',
                    onu_sn: onuSn ? onuSn.value : '',
                    pppoe_username: pppoeUsername ? pppoeUsername.value : '',
                    capacity: capacity ? parseInt(capacity.value) : 0,
                    subscriber_id: subscriberId ? subscriberId.value : '',
                    packet_name: packetName ? packetName.value : '',
                    linked_router_id: linkedRouterId ? linkedRouterId.value : '',
                };
            }
        });

        if (form) {
            try {
                await api.put(`/api/nodes/${node.node_id}/details`, form);
                fetchTopology();
                Swal.fire({ toast: true, icon: 'success', title: '✅ Detail berhasil diupdate', position: 'top-end', timer: 2000, showConfirmButton: false });
            } catch (e) {
                Swal.fire('Gagal', 'Gagal memperbarui detail aset', 'error');
            }
        }
    };

    // Live search: filter semua node yang match dengan query
    const handleSearchInput = (value: string) => {
        setSearchQuery(value);
        // Hitung posisi dropdown berdasarkan input element (fixed positioning)
        if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
        }
        if (value.trim().length < 1) {
            setSearchResults([]);
            setShowSearchPanel(false);
            return;
        }
        const q = value.toLowerCase();
        const results = nodes.filter(n => {
            if (n.name.toLowerCase().includes(q)) return true;
            if (n.description?.toLowerCase().includes(q)) return true;
            if (n.type.toLowerCase().includes(q)) return true;
            if (n.client_detail?.subscriber_id?.toLowerCase().includes(q)) return true;
            if (n.client_detail?.packet_name?.toLowerCase().includes(q)) return true;
            if (n.olt_detail?.brand?.toLowerCase().includes(q)) return true;
            if (n.olt_detail?.ip_address?.toLowerCase().includes(q)) return true;
            return false;
        });
        setSearchResults(results);
        setShowSearchPanel(true);
    };

    const handleSelectSearchResult = (node: NodeData) => {
        setFlyToCoords([node.lat, node.lng]);
        setHighlightedNodeId(node.node_id);
        setShowSearchPanel(false);
        setSearchQuery(node.name);
        // Hapus highlight setelah 4 detik
        setTimeout(() => setHighlightedNodeId(null), 4000);
    };

    const handleSearch = () => {
        if (!searchQuery.trim()) return;
        const q = searchQuery.toLowerCase();
        const results = nodes.filter(n =>
            n.name.toLowerCase().includes(q) ||
            n.description?.toLowerCase().includes(q) ||
            n.client_detail?.subscriber_id?.toLowerCase().includes(q)
        );
        if (results.length > 0) {
            setSearchResults(results);
            setShowSearchPanel(true);
            setFlyToCoords([results[0].lat, results[0].lng]);
        } else {
            Swal.fire({ toast: true, icon: 'error', title: 'Node tidak ditemukan', position: 'top-end', timer: 2000, showConfirmButton: false });
        }
    };

    const handleManualInput = async () => {
        // Pre-load router list before opening popup
        let routerOptionsHtml = '<option value="">-- Pilih Router (Optional) --</option>';
        try {
            const res = await api.get('/api/routers');
            const routers = res.data?.data || [];
            routerOptionsHtml += routers.map((r: any) =>
                `<option value="${r.router_id}">${r.router_name} — ${r.router_address}</option>`
            ).join('');
        } catch (e) {
            console.error('Gagal mengambil daftar router:', e);
        }

        const { value: form } = await Swal.fire({
            title: '📍 Input Manual Koordinat',
            html: `
                <style>
                    .fn-form { text-align:left; }
                    .fn-label { display:block; font-size:11px; font-weight:600; color:#475569; margin-bottom:4px; margin-top:10px; }
                    .fn-input { width:100%; padding:8px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; outline:none; box-sizing:border-box; transition:border-color .2s; }
                    .fn-input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
                    .fn-select { width:100%; padding:8px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; background:#fff; outline:none; box-sizing:border-box; cursor:pointer; }
                    .fn-section { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; margin-top:10px; }
                    .fn-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; margin-bottom:8px; }
                    .fn-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
                    .fn-hint { font-size:10px; color:#94a3b8; margin-top:6px; padding:6px 10px; background:#f1f5f9; border-radius:6px; }
                    .fn-type-section { display:none; }
                    .fn-type-section.active { display:block; }
                </style>
                <div class="fn-form">
                    <label class="fn-label">Jenis Node</label>
                    <select id="m-type" class="fn-select">
                        <option value="ODP">📡 ODP – Optical Distribution Point</option>
                        <option value="ODC">🗄️ ODC – Optical Distribution Cabinet</option>
                        <option value="OLT">🔴 OLT – Optical Line Terminal</option>
                        <option value="ROUTER">🔀 Router / Mikrotik</option>
                        <option value="TB">📦 TB – Terminal Box</option>
                        <option value="CLIENT">🏠 Rumah / Pelanggan</option>
                    </select>

                    <label class="fn-label">Nama Node <span style="color:#ef4444">*</span></label>
                    <input id="m-name" class="fn-input" placeholder="Contoh: ODP-001-SUKODONO">

                    <label class="fn-label">Koordinat <span style="color:#ef4444">*</span></label>
                    <div class="fn-row">
                        <input id="m-lat" type="number" step="any" class="fn-input" placeholder="Latitude (-7.xxx)">
                        <input id="m-lng" type="number" step="any" class="fn-input" placeholder="Longitude (112.xxx)">
                    </div>
                    <div class="fn-hint">💡 Paste koordinat Google Maps langsung ke kolom Latitude (format: -7.123, 112.456 akan otomatis terisi)</div>

                    <!-- ODP Fields -->
                    <div id="m-fields-odp" class="fn-section fn-type-section">
                        <div class="fn-section-title">📡 Detail ODP</div>
                        <label class="fn-label">Total Kapasitas Port</label>
                        <input id="m-ports" type="number" class="fn-input" placeholder="Default: 8 port" value="8">
                    </div>

                    <!-- OLT Fields -->
                    <div id="m-fields-olt" class="fn-section fn-type-section">
                        <div class="fn-section-title">🔴 Detail OLT</div>
                        <label class="fn-label">Brand / Merek OLT</label>
                        <input id="m-brand" class="fn-input" placeholder="ZTE, Huawei, Hioso, dll.">
                        <div class="fn-row" style="margin-top:6px">
                            <div>
                                <label class="fn-label">Tipe Uplink</label>
                                <input id="m-uplink" class="fn-input" placeholder="ex: 1G, 10G">
                            </div>
                            <div>
                                <label class="fn-label">IP Address</label>
                                <input id="m-ip" class="fn-input" placeholder="192.168.1.x">
                            </div>
                        </div>
                    </div>

                    <!-- ODC Fields -->
                    <div id="m-fields-odc" class="fn-section fn-type-section">
                        <div class="fn-section-title">🗄️ Detail ODC</div>
                        <label class="fn-label">Kapasitas Core</label>
                        <input id="m-capacity" type="number" class="fn-input" placeholder="48, 96, 144, 288 core" value="144">
                    </div>

                    <!-- CLIENT Fields -->
                    <div id="m-fields-client" class="fn-section fn-type-section">
                        <div class="fn-section-title">🏠 Detail Pelanggan</div>
                        <label class="fn-label">ID Pelanggan / PPPoE Username</label>
                        <input id="m-subscriber" class="fn-input" placeholder="ex: user001@pelanggan">
                        <label class="fn-label" style="margin-top:6px">Paket Internet</label>
                        <select id="m-packet" class="fn-select">
                            <option value="">-- Pilih Paket --</option>
                            ${internetPackages.map(p => `<option value="${p.package_name}">${p.package_name} - Rp ${p.package_price.toLocaleString('id-ID')}</option>`).join('')}
                        </select>
                        <label class="fn-label" style="margin-top:6px">Router Penampung (Opsional)</label>
                        <select id="m-client-router" class="fn-select">${routerOptionsHtml}</select>
                    </div>

                    <!-- ROUTER Fields -->
                    <div id="m-fields-router" class="fn-section fn-type-section">
                        <div class="fn-section-title">🔀 Detail Router</div>
                        <label class="fn-label">Hubungkan ke Router Mikrotik</label>
                        <select id="m-linked-router" class="fn-select">${routerOptionsHtml}</select>
                    </div>

                    <!-- TB: no extra fields -->

                    <label class="fn-label">Deskripsi <span style="color:#94a3b8">(opsional)</span></label>
                    <input id="m-desc" class="fn-input" placeholder="Catatan tambahan...">
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '💾 Simpan Node',
            confirmButtonColor: '#3b82f6',
            cancelButtonText: 'Batal',
            customClass: { popup: 'swal-wide-popup' },
            didOpen: () => {
                // Auto-parse paste koordinat Google Maps
                const latEl = document.getElementById('m-lat') as HTMLInputElement;
                const lngEl = document.getElementById('m-lng') as HTMLInputElement;
                latEl?.addEventListener('paste', (e) => {
                    const text = e.clipboardData?.getData('text') || '';
                    const match = text.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
                    if (match) {
                        e.preventDefault();
                        const val1 = parseFloat(match[1]);
                        const val2 = parseFloat(match[2]);
                        
                        // Auto-swap if longitude was pasted first (e.g. 112.xx, -7.xx)
                        if (Math.abs(val1) > 90 && Math.abs(val2) <= 90) {
                            latEl.value = match[2];
                            lngEl.value = match[1];
                        } else {
                            latEl.value = match[1];
                            lngEl.value = match[2];
                        }
                    }
                });

                // Toggle section visibility — using fn-type-section class (inline CSS, not Tailwind)
                const typeEl = document.getElementById('m-type') as HTMLSelectElement;
                const toggle = () => {
                    document.querySelectorAll('.fn-type-section').forEach(el => {
                        (el as HTMLElement).style.display = 'none';
                    });
                    const sel = typeEl.value.toLowerCase();
                    if (sel !== 'tb') {
                        const section = document.getElementById(`m-fields-${sel}`);
                        if (section) section.style.display = 'block';
                    }
                };
                typeEl.addEventListener('change', toggle);
                toggle(); // run immediately on open
            },
            preConfirm: () => {
                const name = (document.getElementById('m-name') as HTMLInputElement).value.trim();
                if (!name) { Swal.showValidationMessage('⚠️ Nama node wajib diisi'); return false; }
                const lat = parseFloat((document.getElementById('m-lat') as HTMLInputElement).value);
                const lng = parseFloat((document.getElementById('m-lng') as HTMLInputElement).value);
                if (isNaN(lat) || isNaN(lng)) { Swal.showValidationMessage('⚠️ Koordinat tidak valid'); return false; }

                const type = (document.getElementById('m-type') as HTMLSelectElement).value;
                return {
                    type,
                    name,
                    lat,
                    lng,
                    description: (document.getElementById('m-desc') as HTMLInputElement)?.value || '',
                    total_ports: type === 'ODP'
                        ? parseInt((document.getElementById('m-ports') as HTMLInputElement)?.value) || 8
                        : 0,
                    brand: type === 'OLT'
                        ? (document.getElementById('m-brand') as HTMLInputElement)?.value || ''
                        : '',
                    uplink_type: type === 'OLT'
                        ? (document.getElementById('m-uplink') as HTMLInputElement)?.value || ''
                        : '',
                    ip_address: type === 'OLT'
                        ? (document.getElementById('m-ip') as HTMLInputElement)?.value || ''
                        : '',
                    capacity: type === 'ODC'
                        ? parseInt((document.getElementById('m-capacity') as HTMLInputElement)?.value) || 144
                        : 0,
                    subscriber_id: type === 'CLIENT'
                        ? (document.getElementById('m-subscriber') as HTMLInputElement)?.value || ''
                        : '',
                    packet_name: type === 'CLIENT'
                        ? (document.getElementById('m-packet') as HTMLSelectElement)?.value || ''
                        : '',
                    linked_router_id: type === 'ROUTER'
                        ? (document.getElementById('m-linked-router') as HTMLSelectElement)?.value || ''
                        : type === 'CLIENT'
                        ? (document.getElementById('m-client-router') as HTMLSelectElement)?.value || ''
                        : '',
                };
            }
        });

        if (form) {
            await api.post('/api/nodes', form);
            fetchTopology();
            setFlyToCoords([form.lat, form.lng]);
            Swal.fire({ toast: true, icon: 'success', title: `✅ ${form.name} ditambahkan!`, position: 'top-end', timer: 1500, showConfirmButton: false });
        }
    };

    const handleNodeClick = async (node: NodeData) => {
        if (!isConnecting) return;
        if (!sourceNode) {
            setSourceNode(node);
            Swal.fire({ toast: true, icon: 'info', title: `Mulai dari: ${node.name}`, position: 'top-end', timer: 2000, showConfirmButton: false });
        } else {
            if (sourceNode.node_id === node.node_id) return;

            const CSS = `
                <style>
                    .fn-form { text-align:left; }
                    .fn-label { display:block; font-size:11px; font-weight:600; color:#475569; margin-bottom:4px; margin-top:12px; }
                    .fn-input { width:100%; padding:8px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; outline:none; box-sizing:border-box; transition:border-color .2s; }
                    .fn-input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
                    .fn-select { width:100%; padding:8px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px; background:#fff; outline:none; box-sizing:border-box; cursor:pointer; }
                    .fn-select:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
                    .fn-path-container { background:#f8fafc; border:1.5px dashed #cbd5e1; border-radius:10px; padding:10px 12px; font-size:11px; margin-top:6px; color:#475569; }
                    .fn-row-arrow { display:flex; align-items:center; justify-content:space-between; margin:4px 0; }
                    #connect-custom-type-wrapper { display:none; }
                    #connect-custom-type-wrapper.active { display:block; }
                </style>
            `;

            const { value: form } = await Swal.fire({
                title: '🔌 Hubungkan Kabel',
                html: CSS + `
                    <div class="fn-form">
                        <div class="fn-path-container">
                            <div class="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-2">Hubungan Aset</div>
                            <div class="fn-row-arrow">
                                <div>📍 <b>${sourceNode.name}</b> <span class="text-[9px] text-slate-400">(${sourceNode.type})</span></div>
                                <div class="text-slate-400 font-bold px-2">➡️</div>
                                <div>📍 <b>${node.name}</b> <span class="text-[9px] text-slate-400">(${node.type})</span></div>
                            </div>
                        </div>

                        <label class="fn-label">Tipe / Kategori Kabel</label>
                        <select id="conn-cable-dropdown" class="fn-select">
                            <option value="BACKBONE" selected>🔴 Backbone / Core Link</option>
                            <option value="DISTRIBUSI">🟠 Distribusi / Feeder Link</option>
                            <option value="DROP CLIENT">🟢 Drop / Client Core</option>
                            <option value="KUSTOM">⚫ Tipe Lain (Kustom)</option>
                        </select>

                        <div id="connect-custom-type-wrapper">
                            <label class="fn-label">Nama Tipe Kabel Kustom</label>
                            <input id="conn-cable-custom-input" class="fn-input" placeholder="ex: Dropcore 2 Core, Precon 150m">
                        </div>

                        <label class="fn-label">Keterangan / Rincian</label>
                        <input id="conn-cable-desc" class="fn-input" placeholder="ex: Tiang PLN A1 ke Tiang A5">
                    </div>
                `,
                width: '26rem',
                customClass: { popup: 'swal-wide-popup' },
                showCancelButton: true,
                confirmButtonText: 'Hubungkan',
                cancelButtonText: 'Batal',
                focusConfirm: false,
                didOpen: () => {
                    const dropdown = document.getElementById('conn-cable-dropdown') as HTMLSelectElement;
                    const wrapper = document.getElementById('connect-custom-type-wrapper');
                    
                    dropdown?.addEventListener('change', (ev) => {
                        const val = (ev.target as HTMLSelectElement).value;
                        if (val === 'KUSTOM') {
                            wrapper?.classList.add('active');
                        } else {
                            wrapper?.classList.remove('active');
                        }
                    });
                },
                preConfirm: () => {
                    const dropdownVal = (document.getElementById('conn-cable-dropdown') as HTMLSelectElement).value;
                    const desc = (document.getElementById('conn-cable-desc') as HTMLInputElement).value.trim();
                    
                    let finalType = dropdownVal;
                    if (dropdownVal === 'KUSTOM') {
                        finalType = (document.getElementById('conn-cable-custom-input') as HTMLInputElement).value.trim();
                        if (!finalType) {
                            Swal.showValidationMessage('Nama tipe kustom wajib diisi!');
                            return false;
                        }
                    }

                    return {
                        cable_type: finalType,
                        description: desc
                    };
                }
            });

            if (form) {
                await api.post('/api/cables', { 
                    source_node_id: sourceNode.node_id, 
                    target_node_id: node.node_id, 
                    cable_type: form.cable_type, 
                    description: form.description, 
                    coordinates: "[]" 
                });
                fetchTopology();
                Swal.fire({
                    toast: true,
                    icon: 'success',
                    title: 'Kabel berhasil terhubung',
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false,
                });
            }
            setSourceNode(null); 
            setIsConnecting(false);
        }
    };

    return (
        <div className={`flex flex-col bg-slate-100 transition-all duration-300 ${
            isFullscreen
                ? 'fixed inset-0 z-[9999] rounded-none'
                : 'relative h-[85vh] w-full rounded-xl border border-slate-300 shadow-md'
        }`}>

            {/* ===== TOP BAR ===== */}
            <div className="bg-white border-b border-slate-200 shadow-sm relative z-[1002] overflow-visible">

                {/* MAIN ROW */}
                <div className="flex items-center gap-2 px-3 py-2">

                    {/* Search box with dropdown results */}
                    <div className="relative flex-1 min-w-0" ref={searchRef}>
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Cari nama, ID pelanggan, tipe, deskripsi..."
                            className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 bg-slate-50"
                            value={searchQuery}
                            onChange={(e) => handleSearchInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            onFocus={() => {
                                if (inputRef.current) {
                                    const rect = inputRef.current.getBoundingClientRect();
                                    setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
                                }
                                if (searchResults.length > 0) setShowSearchPanel(true);
                            }}
                        />
                        <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        {searchQuery && (
                            <button
                                onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearchPanel(false); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                            >
                                <X size={14} weight="bold" />
                            </button>
                        )}

                    </div>
                    <button
                        onClick={handleSearch}
                        className="bg-sky-500 hover:bg-sky-600 active:scale-95 text-white p-1.5 rounded-lg transition-all shrink-0"
                        title="Cari"
                    >
                        <MagnifyingGlass weight="bold" size={16} />
                    </button>

                    {/* Search Dropdown — rendered as fixed portal to escape overflow/z-index issues */}
                    {showSearchPanel && dropdownPos && searchResults.length > 0 && (
                        <div
                            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 99999 }}
                            className="bg-white border border-slate-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl sticky top-0">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    {searchResults.length} hasil ditemukan
                                </span>
                                <button
                                    onClick={() => setShowSearchPanel(false)}
                                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition"
                                >
                                    <X size={13} weight="bold" />
                                </button>
                            </div>
                            {searchResults.map((node) => {
                                const typeColors: Record<string, string> = {
                                    OLT: 'bg-red-100 text-red-700',
                                    ODC: 'bg-orange-100 text-orange-700',
                                    ODP: 'bg-blue-100 text-blue-700',
                                    CLIENT: 'bg-green-100 text-green-700',
                                    ROUTER: 'bg-purple-100 text-purple-700',
                                    TB: 'bg-slate-100 text-slate-600',
                                };
                                const typeIcons: Record<string, string> = {
                                    OLT: '🔴', ODC: '🗄️', ODP: '📡',
                                    CLIENT: '🏠', ROUTER: '🔀', TB: '📦'
                                };
                                return (
                                    <button
                                        key={node.node_id}
                                        onClick={() => handleSelectSearchResult(node)}
                                        className="w-full text-left px-3 py-2.5 hover:bg-sky-50 border-b border-slate-50 last:border-b-0 flex items-center gap-3 transition-all group"
                                    >
                                        <span className="text-base flex-shrink-0">{typeIcons[node.type] || '📍'}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-slate-800 text-xs truncate">{node.name}</span>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${typeColors[node.type] || 'bg-slate-100 text-slate-600'}`}>
                                                    {node.type}
                                                </span>
                                            </div>
                                            {node.client_detail?.subscriber_id && (
                                                <div className="text-[10px] text-slate-500 mt-0.5">ID: {node.client_detail.subscriber_id}{node.client_detail.packet_name && ` · ${node.client_detail.packet_name}`}</div>
                                            )}
                                            {node.description && (
                                                <div className="text-[10px] text-slate-400 truncate mt-0.5">{node.description}</div>
                                            )}
                                        </div>
                                        <NavigationArrow size={14} className="text-slate-300 group-hover:text-sky-500 flex-shrink-0 transition" />
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* No Results — juga fixed */}
                    {showSearchPanel && dropdownPos && searchQuery.trim().length > 0 && searchResults.length === 0 && (
                        <div
                            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 99999 }}
                            className="bg-white border border-slate-200 rounded-xl shadow-2xl px-4 py-6 text-center"
                        >
                            <MagnifyingGlass className="mx-auto text-slate-300 mb-2" size={24} />
                            <p className="text-xs text-slate-400 font-semibold">Tidak ada node ditemukan untuk</p>
                            <p className="text-xs font-bold text-slate-600 mt-0.5">"{searchQuery}"</p>
                        </div>
                    )}

                    {/* Mobile toolbar toggle */}
                    <button
                        onClick={() => setShowToolbar(v => !v)}
                        className="sm:hidden shrink-0 border border-slate-300 bg-white p-1.5 rounded-lg text-slate-600 hover:bg-slate-50 active:scale-95"
                        title="Tools"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                            <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"/>
                        </svg>
                    </button>

                    {/* Desktop action buttons */}
                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                        <button
                            onClick={() => { setIsConnecting(!isConnecting); setSourceNode(null); }}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold whitespace-nowrap border transition-all active:scale-95 ${
                                isConnecting ? 'bg-orange-500 text-white border-orange-500 animate-pulse' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300'
                            }`}
                        >
                            <ShareNetwork size={15} weight={isConnecting ? 'fill' : 'bold'} />
                            {isConnecting ? (sourceNode ? 'Pilih Tujuan...' : 'Pilih Sumber...') : 'Hubungkan'}
                        </button>
                        <button
                            onClick={handleManualInput}
                            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg flex items-center gap-1.5 text-xs font-bold whitespace-nowrap active:scale-95 transition-all"
                        >
                            <Crosshair size={15} className="text-purple-600" /> Input Manual
                        </button>
                        <button
                            onClick={() => {
                                setIsMapAddingMode(!isMapAddingMode);
                                if (!isMapAddingMode) {
                                    Swal.fire({
                                        toast: true,
                                        icon: 'info',
                                        title: '👉 Silakan ketuk/klik di mana saja pada peta untuk menambah node',
                                        position: 'top',
                                        showConfirmButton: false,
                                        timer: 3500
                                    });
                                }
                            }}
                            className={`px-3 py-1.5 border rounded-lg flex items-center gap-1.5 text-xs font-bold whitespace-nowrap active:scale-95 transition-all ${
                                isMapAddingMode 
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500 animate-pulse' 
                                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                            }`}
                        >
                            <Broadcast size={15} className={isMapAddingMode ? "text-white" : "text-red-500"} /> 
                            {isMapAddingMode ? 'Sentuh Peta...' : '+ Klik Peta'}
                        </button>
                    </div>
                </div>

                {/* MOBILE COLLAPSIBLE TOOLBAR */}
                {showToolbar && (
                    <div className="sm:hidden border-t border-slate-100 px-3 py-2 flex flex-col gap-2">
                        <button
                            onClick={() => { setIsConnecting(!isConnecting); setSourceNode(null); setShowToolbar(false); }}
                            className={`w-full py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-bold border transition-all ${
                                isConnecting ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300'
                            }`}
                        >
                            <ShareNetwork size={16} weight={isConnecting ? 'fill' : 'bold'} />
                            {isConnecting ? (sourceNode ? 'Pilih Tujuan...' : 'Pilih Sumber...') : 'Hubungkan Kabel'}
                        </button>
                        <button
                            onClick={() => { setShowToolbar(false); handleManualInput(); }}
                            className="w-full py-2 bg-white text-slate-700 border border-slate-300 rounded-lg flex items-center justify-center gap-2 text-sm font-bold hover:bg-slate-50"
                        >
                            <Crosshair size={16} className="text-purple-600" /> Input Manual Koordinat
                        </button>
                        <button
                            onClick={() => { 
                                setShowToolbar(false); 
                                setIsMapAddingMode(!isMapAddingMode);
                                if (!isMapAddingMode) {
                                    Swal.fire({
                                        toast: true,
                                        icon: 'info',
                                        title: '👉 Silakan sentuh di mana saja pada peta untuk menambah node',
                                        position: 'top',
                                        showConfirmButton: false,
                                        timer: 3500
                                    });
                                }
                            }}
                            className={`w-full py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-bold border transition-all ${
                                isMapAddingMode 
                                    ? 'bg-amber-500 text-white border-amber-500 animate-pulse' 
                                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300'
                            }`}
                        >
                            <Broadcast size={16} className={isMapAddingMode ? "text-white" : "text-red-500"} /> 
                            {isMapAddingMode ? 'Sentuh Peta...' : 'Tambah via Klik Peta'}
                        </button>
                    </div>
                )}
            </div>

            {/* ===== MAP AREA ===== */}
            <div className={`flex-1 relative overflow-hidden ${isMapAddingMode ? 'leaflet-crosshair' : ''}`}>

                {/* Edit mode floating bar */}
                {editingCableId && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-white px-4 py-2 rounded-full shadow-2xl border border-slate-200 flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500 uppercase mr-2 border-r pr-3">Edit Mode</span>
                        <button onClick={handleSavePath} className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 active:scale-95">
                            <FloppyDisk weight="fill" /> Simpan
                        </button>
                        <button onClick={() => { setEditingCableId(null); setTempPath([]); }} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 active:scale-95">
                            <X weight="bold" /> Batal
                        </button>
                    </div>
                )}

                {/* LEGEND — hidden on mobile, shown on md+ */}
                <div className="hidden md:block absolute bottom-6 left-4 z-[999] bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-md border border-slate-200 text-[10px] text-slate-600 space-y-1 w-36">
                    <div className="font-bold border-b pb-1 mb-1 text-slate-700">Legenda Node</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-purple-500 border border-white shrink-0"></div> Router</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-slate-500 border border-white shrink-0"></div> TB (Box)</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white shrink-0"></div> OLT</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-white shrink-0"></div> ODC</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white shrink-0"></div> ODP (Aman)</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-600 border border-white animate-pulse shrink-0"></div> ODP (Penuh)</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-white shrink-0"></div> Client</div>
                    <div className="font-bold border-b border-t py-1 my-1 text-slate-700">Legenda Kabel</div>
                    <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-red-500 shrink-0"></div> Backbone</div>
                    <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-orange-500 shrink-0"></div> Distribusi</div>
                    <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-green-500 shrink-0"></div> Drop</div>
                    <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-slate-500 shrink-0"></div> Lainnya</div>
                </div>

                {/* TOP-RIGHT CONTROLS: Layer filter + Fullscreen */}
                <div className="absolute top-3 right-3 z-[999] flex flex-col items-end gap-2">

                    {/* Fullscreen toggle */}
                    <button
                        onClick={() => setIsFullscreen(v => !v)}
                        title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
                        className="bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow border border-slate-200 text-slate-600 hover:text-sky-600 hover:bg-white transition-all active:scale-95"
                    >
                        {isFullscreen ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                                <path d="M216,48a8,8,0,0,1,0,16H184V96a8,8,0,0,1-16,0V56a8,8,0,0,1,8-8ZM72,160H40a8,8,0,0,0,0,16H72v32a8,8,0,0,0,16,0V168A8,8,0,0,0,72,160Zm144,0H184a8,8,0,0,0-8,8v32a8,8,0,0,0,16,0V176h24a8,8,0,0,0,0-16ZM88,96V56a8,8,0,0,0-8-8H40a8,8,0,0,0,0,16H72V96a8,8,0,0,0,16,0Z"/>
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                                <path d="M216,48H168a8,8,0,0,0,0,16h28.69L146.34,114.34a8,8,0,1,0,11.32,11.32L208,75.31V104a8,8,0,0,0,16,0V56A8,8,0,0,0,216,48ZM109.66,141.66a8,8,0,0,0-11.32,0L48,192H48V163.31a8,8,0,0,0-16,0V208a8,8,0,0,0,8,8H88a8,8,0,0,0,0-16H59.31l50.35-50.34A8,8,0,0,0,109.66,141.66Z"/>
                            </svg>
                        )}
                    </button>

                    {/* Layer filter */}
                    <div>
                        <button
                            onClick={() => setShowLayerPanel(!showLayerPanel)}
                            className="bg-white/90 backdrop-blur-sm px-2.5 py-1.5 rounded-lg shadow border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white transition-all active:scale-95 flex items-center gap-1.5"
                        >
                            🗂️ <span className="hidden sm:inline">Layer</span>
                        </button>
                        {showLayerPanel && (
                            <div className="mt-2 bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-slate-200 text-xs space-y-1.5 min-w-[140px]">
                                <div className="font-bold text-slate-700 border-b pb-1 mb-1">Tampilkan</div>
                                {['OLT','ODC','ODP','ROUTER','TB','CLIENT'].map(type => (
                                    <label key={type} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-0.5 rounded">
                                        <input type="checkbox" checked={visibleTypes.has(type)} onChange={() => toggleLayer(type)} className="rounded border-slate-300 text-sky-500 focus:ring-sky-500" />
                                        <span className="text-slate-600">{type}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <MapContainer center={[-7.98, 112.63]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                    <FlyToLocation coords={flyToCoords} />

                    {cables.map((cable) => (
                        <EditableCable 
                            key={cable.cable_id} 
                            cable={cable} 
                            isEditing={editingCableId === cable.cable_id} 
                            currentPath={tempPath} 
                            onPathChange={setTempPath} 
                            onStartEdit={() => handleStartEdit(cable)} 
                            onDeleteCable={handleDeleteCable} 
                            onEditDetails={() => handleEditCableDetails(cable)}
                        />
                    ))}

                    {nodes.filter(n => visibleTypes.has(n.type)).map((node) => (
                        <Marker
                            key={node.node_id}
                            position={[node.lat, node.lng]}
                            icon={getNodeIcon(node)}
                            draggable={!isConnecting}
                            eventHandlers={{
                                click: () => handleNodeClick(node),
                                dragend: async (e: any) => {
                                    const { lat, lng } = e.target.getLatLng();
                                    try {
                                        await api.put(`/api/nodes/${node.node_id}`, { ...node, lat, lng });
                                        fetchTopology();
                                        Swal.fire({ toast: true, icon: 'success', title: 'Posisi diperbarui', position: 'top-end', timer: 1200, showConfirmButton: false });
                                    } catch { Swal.fire({ toast: true, icon: 'error', title: 'Gagal update posisi', position: 'top-end' }); }
                                }
                            }}
                        >
                            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                                <div className="text-center">
                                    <div className="font-bold text-slate-800 text-xs">{node.name}</div>
                                    <div className="text-[10px] text-slate-500">{node.type}</div>
                                </div>
                            </Tooltip>

                            <Popup>
                                <div className="min-w-[180px] max-w-[240px]">
                                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm ${
                                            node.type==='ROUTER'?'bg-purple-500':
                                            node.type==='TB'?'bg-slate-500':
                                            node.type==='OLT'?'bg-red-500':
                                            node.type==='ODC'?'bg-orange-500':
                                            node.type==='ODP'?'bg-blue-500':
                                            'bg-green-500'
                                        }`}>
                                            {node.type}
                                        </span>
                                        <div className="flex gap-0.5">
                                            <a
                                                href={`https://www.google.com/maps?q=${node.lat},${node.lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Buka di Google Maps"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-slate-400 hover:text-emerald-600 p-1 rounded hover:bg-emerald-50 inline-flex items-center"
                                            >
                                                <NavigationArrow size={15} weight="bold" />
                                            </a>
                                            {node.type !== 'TB' && (
                                                <button onClick={(e) => { e.stopPropagation(); handleEditDetails(node); }} className="text-slate-400 hover:text-sky-600 p-1 rounded hover:bg-sky-50" title="Edit Detail">
                                                    <Gear size={15} weight="bold" />
                                                </button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.node_id, node.name); }} className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50" title="Hapus">
                                                <Trash size={15} weight="bold" />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1 mb-1">
                                        {node.type === 'ROUTER' && <RouterIcon weight="fill" className="text-purple-600" size={14}/>}
                                        {node.type === 'TB' && <HardDrives weight="fill" className="text-slate-600" size={14}/>}
                                        {node.name}
                                    </h3>

                                    {node.type === 'ODP' && node.odp_detail && (
                                        <div className="mt-1.5 mb-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                                <span>Port Terpakai</span>
                                                <span className="font-bold text-slate-700">{node.odp_detail.used_ports} / {node.odp_detail.total_ports}</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-1.5">
                                                <div
                                                    className={`h-1.5 rounded-full transition-all ${
                                                        node.odp_detail.used_ports >= node.odp_detail.total_ports ? 'bg-red-500' : 'bg-blue-500'
                                                    }`}
                                                    style={{ width: `${Math.min((node.odp_detail.used_ports / node.odp_detail.total_ports) * 100, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {node.type === 'OLT' && node.olt_detail?.brand && (
                                        <p className="text-xs text-slate-600 mt-1">Brand: <b>{node.olt_detail.brand}</b></p>
                                    )}
                                    {node.type === 'CLIENT' && node.client_detail && (
                                        <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                                            <p>ID: <b>{node.client_detail.subscriber_id}</b></p>
                                            {node.client_detail.onu_sn && <p className="mt-0.5">SN: <span className="font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200/50 text-[10px] font-bold">{node.client_detail.onu_sn}</span></p>}
                                            {node.client_detail.ip_address && <p className="mt-0.5">IP: <span className="font-mono bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded border border-sky-200/50 text-[10px] font-bold">{node.client_detail.ip_address}</span></p>}
                                            {node.client_detail.pppoe_username && <p className="mt-0.5">PPPoE: <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-bold">{node.client_detail.pppoe_username}</span></p>}
                                            {node.client_detail.packet_name && <p className="mt-0.5">Paket: <span className="font-bold text-emerald-700">{node.client_detail.packet_name}</span></p>}
                                        </div>
                                    )}

                                    <p className="text-xs text-slate-500 mt-1.5 flex items-start gap-1">
                                        <Info size={13} className="shrink-0 mt-0.5"/> {node.description || '-'}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1">📍 {node.lat.toFixed(5)}, {node.lng.toFixed(5)}</p>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    <AddNodeHandler 
                        refreshMap={fetchTopology} 
                        isMapAddingMode={isMapAddingMode} 
                        setIsMapAddingMode={setIsMapAddingMode} 
                        internetPackages={internetPackages}
                    />
                </MapContainer>
            </div>
        </div>
    );
};

export default NetworkMap;
