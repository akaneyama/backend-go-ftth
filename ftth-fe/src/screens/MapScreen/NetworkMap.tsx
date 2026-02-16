import React, { useState, useEffect, useMemo } from 'react';
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
    Gear
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
const createCustomIcon = (color: string, shape: string = 'circle', isFull: boolean = false) => new L.DivIcon({
    className: 'custom-node-icon',
    html: `<div style="
        background-color: ${color}; 
        width: ${shape === 'square' ? '16px' : '14px'}; 
        height: ${shape === 'square' ? '16px' : '14px'}; 
        border-radius: ${shape === 'square' ? '4px' : '50%'}; 
        border: 2px solid white; 
        box-shadow: 0 0 0 ${isFull ? '3px' : '2px'} ${isFull ? '#dc2626' : color}, 0 4px 6px rgba(0,0,0,0.3);
        ${isFull ? 'animation: pulse-red 2s infinite;' : ''}
    "></div>`,
    iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -10]
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
    
    // Detail Aset dari Backend (Preload)
    odp_detail?: { odp_id: number; total_ports: number; used_ports: number };
    olt_detail?: { olt_id: number; brand: string };
    client_detail?: { client_id: number; subscriber_id: string };
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

// Editable Cable Component
const EditableCable = ({ 
    cable, isEditing, currentPath, onPathChange, onStartEdit 
}: { 
    cable: CableData, isEditing: boolean, currentPath: L.LatLngExpression[], onPathChange: (p: L.LatLngExpression[]) => void, onStartEdit: () => void 
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

    return (
        <>
            <Polyline 
                positions={getDisplayPath()}
                pathOptions={{ 
                    color: isEditing ? '#0ea5e9' : '#475569', 
                    weight: isEditing ? 4 : 3, opacity: 0.8,
                    dashArray: cable.cable_type.toLowerCase().includes('drop') ? '5, 10' : undefined 
                }}
                eventHandlers={{ click: handleLineClick }}
            >
                {!isEditing && (
                    <Popup>
                        <div className="text-xs p-1 min-w-[160px]">
                            <div className="font-bold text-slate-700 mb-1 flex justify-between">
                                <span>Kabel #{cable.cable_id}</span><PlugsConnected className="text-sky-600"/>
                            </div>
                            <hr className="my-2 border-slate-200"/>
                            <p><span className="text-slate-400">Tipe:</span> {cable.cable_type}</p>
                            <p className="mb-3"><span className="text-slate-400">Ket:</span> {cable.description || '-'}</p>
                            <button onClick={onStartEdit} className="w-full bg-sky-500 hover:bg-sky-600 text-white py-1.5 rounded flex items-center justify-center gap-1 font-bold shadow-sm"><PencilSimple/> Edit Jalur</button>
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

// Add Node Handler (Klik Kanan)
const AddNodeHandler = ({ refreshMap }: { refreshMap: () => void }) => {
    useMapEvents({
        contextmenu(e) {
            const { lat, lng } = e.latlng;
            Swal.fire({
                title: 'Tambah Node Baru',
                html: `
                    <div class="text-left space-y-2">
                        <select id="swal-node-type" class="swal2-select w-full m-0 text-sm">
                            <option value="ODP">ODP (Tiang)</option>
                            <option value="ODC">ODC (Distribusi)</option>
                            <option value="OLT">OLT (Pusat)</option>
                            <option value="ROUTER">Router / Mikrotik</option>
                            <option value="TB">TB (Terminal Box)</option>
                            <option value="CLIENT">Rumah Client</option>
                        </select>
                        <input id="swal-node-name" class="swal2-input w-full m-0 text-sm" placeholder="Nama Node">
                        
                        <div class="grid grid-cols-2 gap-2">
                            <input id="swal-ports" type="number" class="swal2-input w-full m-0 text-sm" placeholder="Jml Port (ODP)">
                            <input id="swal-brand" class="swal2-input w-full m-0 text-sm" placeholder="Brand (OLT)">
                        </div>

                        <input id="swal-node-desc" class="swal2-input w-full m-0 text-sm" placeholder="Deskripsi">
                    </div>
                `,
                showCancelButton: true, confirmButtonText: 'Simpan',
                preConfirm: () => ({
                    type: (document.getElementById('swal-node-type') as HTMLSelectElement).value,
                    name: (document.getElementById('swal-node-name') as HTMLInputElement).value,
                    description: (document.getElementById('swal-node-desc') as HTMLInputElement).value,
                    total_ports: parseInt((document.getElementById('swal-ports') as HTMLInputElement).value) || 0,
                    brand: (document.getElementById('swal-brand') as HTMLInputElement).value,
                    lat, lng
                })
            }).then(async (res) => {
                if (res.isConfirmed) {
                    await api.post('/api/nodes', res.value);
                    refreshMap();
                    Swal.fire({ toast: true, icon: 'success', title: 'Node ditambahkan', position: 'top-end', timer: 1500 });
                }
            });
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
    
    // UI State
    const [isConnecting, setIsConnecting] = useState(false);
    const [sourceNode, setSourceNode] = useState<NodeData | null>(null);
    const [editingCableId, setEditingCableId] = useState<number | null>(null);
    const [tempPath, setTempPath] = useState<L.LatLngExpression[]>([]); 
    const [searchQuery, setSearchQuery] = useState('');
    const [flyToCoords, setFlyToCoords] = useState<L.LatLngExpression | null>(null);

    // --- HELPER: GET ICON COLOR BASED ON CAPACITY ---
    const getNodeIcon = (node: NodeData) => {
        let color = '#64748b'; // Default Grey
        let shape = 'circle';
        let isFull = false;

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

        return createCustomIcon(color, shape, isFull);
    };

    // --- API CALLS ---
    const fetchTopology = async () => {
        try {
            const res = await api.get('/api/topology');
            if (res.data.status === 'success') {
                setNodes(res.data.data.nodes);
                setCables(res.data.data.cables);
            }
        } catch (err) { console.error(err); }
    };

    useEffect(() => { fetchTopology(); }, []);

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

    const handleDeleteNode = async (id: number, name: string) => {
        const res = await Swal.fire({ title: `Hapus ${name}?`, html: 'Node & kabel terkait akan dihapus!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Hapus' });
        if (res.isConfirmed) { await api.delete(`/api/nodes/${id}`); fetchTopology(); }
    };

    // [BARU] Update Detail Aset (Misal edit kapasitas ODP)
    const handleEditDetails = async (node: NodeData) => {
        let htmlContent = '';
        if (node.type === 'ODP') {
            htmlContent = `
                <label class="block text-left text-xs mb-1">Total Port</label>
                <input id="edit-ports" type="number" class="swal2-input w-full m-0" value="${node.odp_detail?.total_ports || 8}">
            `;
        } else if (node.type === 'OLT') {
            htmlContent = `
                <label class="block text-left text-xs mb-1">Brand</label>
                <input id="edit-brand" class="swal2-input w-full m-0" value="${node.olt_detail?.brand || ''}">
            `;
        } else {
            return Swal.fire('Info', 'Tidak ada detail khusus untuk tipe ini', 'info');
        }

        const { value: form } = await Swal.fire({
            title: `Edit Detail ${node.name}`,
            html: htmlContent,
            showCancelButton: true, confirmButtonText: 'Update',
            preConfirm: () => {
                const ports = document.getElementById('edit-ports') as HTMLInputElement;
                const brand = document.getElementById('edit-brand') as HTMLInputElement;
                return {
                    type: node.type,
                    total_ports: ports ? parseInt(ports.value) : 0,
                    brand: brand ? brand.value : ''
                }
            }
        });

        if (form) {
            try {
                await api.put(`/api/nodes/${node.node_id}/details`, form);
                fetchTopology();
                Swal.fire({ toast: true, icon: 'success', title: 'Updated', position: 'top-end' });
            } catch (e) { Swal.fire('Gagal', 'Update gagal', 'error'); }
        }
    };

    const handleSearch = () => {
        const found = nodes.find(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()));
        if (found) { setFlyToCoords([found.lat, found.lng]); Swal.fire({ toast: true, icon: 'success', title: `Ditemukan: ${found.name}`, position: 'top-end', timer: 2000 }); }
        else Swal.fire({ toast: true, icon: 'error', title: 'Node tidak ditemukan', position: 'top-end' });
    };

    const handleManualInput = async () => {
        const { value: form } = await Swal.fire({
            title: 'Input Manual Koordinat',
            html: `
                <div class="text-left space-y-2">
                    <select id="m-type" class="swal2-select w-full m-0 text-sm">
                         <option value="ODP">ODP (Tiang)</option>
                            <option value="ODC">ODC (Distribusi)</option>
                            <option value="OLT">OLT (Pusat)</option>
                            <option value="ROUTER">Router / Mikrotik</option>
                            <option value="TB">TB (Terminal Box)</option>
                            <option value="CLIENT">Rumah Client</option>
                    </select>
                    <input id="m-name" class="swal2-input w-full m-0 text-sm" placeholder="Nama Perangkat">
                    <div class="flex gap-2">
                        <input id="m-lat" type="number" step="any" class="swal2-input w-full m-0 text-sm" placeholder="Lat (-7.xxx)">
                        <input id="m-lng" type="number" step="any" class="swal2-input w-full m-0 text-sm" placeholder="Lng (112.xxx)">
                    </div>
                </div>
            `,
            showCancelButton: true, confirmButtonText: 'Simpan',
            preConfirm: () => ({
                type: (document.getElementById('m-type') as HTMLSelectElement).value,
                name: (document.getElementById('m-name') as HTMLInputElement).value,
                lat: parseFloat((document.getElementById('m-lat') as HTMLInputElement).value),
                lng: parseFloat((document.getElementById('m-lng') as HTMLInputElement).value),
                description: 'Input Manual'
            })
        });

        if (form) {
            if (!form.lat || !form.lng) return Swal.fire('Error', 'Koordinat wajib diisi', 'error');
            await api.post('/api/nodes', form);
            fetchTopology();
            setFlyToCoords([form.lat, form.lng]);
        }
    };

    const handleNodeClick = async (node: NodeData) => {
        if (!isConnecting) return;
        if (!sourceNode) {
            setSourceNode(node);
            Swal.fire({ toast: true, icon: 'info', title: `Start: ${node.name}`, position: 'top-end' });
        } else {
            if (sourceNode.node_id === node.node_id) return;
            const { value: form } = await Swal.fire({
                title: 'Hubungkan Kabel',
                html: `<input id="c-type" class="swal2-input" placeholder="Tipe (ex: 24 Core)"><input id="c-desc" class="swal2-input" placeholder="Ket">`,
                preConfirm: () => [(document.getElementById('c-type') as HTMLInputElement).value, (document.getElementById('c-desc') as HTMLInputElement).value]
            });
            if (form) {
                await api.post('/api/cables', { source_node_id: sourceNode.node_id, target_node_id: node.node_id, cable_type: form[0], description: form[1], coordinates: "[]" });
                fetchTopology();
            }
            setSourceNode(null); setIsConnecting(false);
        }
    };

    return (
        <div className="relative h-[85vh] w-full rounded-xl overflow-hidden border border-slate-300 shadow-md bg-slate-100 flex flex-col">
            
            {/* TOP BAR: SEARCH & TOOLS */}
            <div className="bg-white p-3 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between z-10 shadow-sm">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <input type="text" placeholder="Cari Node..." className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                    </div>
                    <button onClick={handleSearch} className="bg-sky-500 hover:bg-sky-600 text-white p-1.5 rounded-md"><MagnifyingGlass weight="bold"/></button>
                </div>
                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                    <button onClick={() => { setIsConnecting(!isConnecting); setSourceNode(null); }} className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold whitespace-nowrap border transition-all ${isConnecting ? 'bg-orange-500 text-white animate-pulse' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300'}`}>
                        <ShareNetwork size={16} weight={isConnecting ? "fill" : "bold"}/> {isConnecting ? (sourceNode ? 'Pilih Tujuan...' : 'Pilih Sumber...') : 'Hubungkan'}
                    </button>
                    <button onClick={handleManualInput} className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md flex items-center gap-2 text-xs font-bold whitespace-nowrap">
                        <Crosshair size={16} className="text-purple-600"/> Input Manual
                    </button>
                    <button onClick={() => Swal.fire('Info', 'Klik kanan peta untuk tambah cepat.', 'info')} className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md flex items-center gap-2 text-xs font-bold whitespace-nowrap">
                        <Broadcast size={16} className="text-red-500"/> + Klik Peta
                    </button>
                </div>
            </div>

            {/* MAP AREA */}
            <div className="flex-1 relative">
                {editingCableId && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-white px-4 py-2 rounded-full shadow-2xl border border-slate-200 flex items-center gap-3 animate-fade-in-up">
                        <span className="text-xs font-bold text-slate-500 uppercase mr-2 border-r pr-3">Edit Mode</span>
                        <button onClick={handleSavePath} className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><FloppyDisk weight="fill"/> Simpan</button>
                        <button onClick={() => { setEditingCableId(null); setTempPath([]); }} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><X weight="bold"/> Batal</button>
                    </div>
                )}

                <div className="absolute bottom-6 left-6 z-[999] bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow border border-slate-200 text-[10px] text-slate-600 space-y-1 w-32">
                    <div className="font-bold border-b pb-1 mb-1">Legenda</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-purple-500 border border-white"></div> Router</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-slate-500 border border-white"></div> TB (Box)</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white"></div> OLT</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-white"></div> ODC</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white"></div> ODP (Aman)</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-600 border border-white animate-pulse"></div> ODP (Penuh)</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-white"></div> Client</div>
                </div>

                <MapContainer center={[-7.98, 112.63]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                    <FlyToLocation coords={flyToCoords} />

                    {cables.map((cable) => (
                        <EditableCable key={cable.cable_id} cable={cable} isEditing={editingCableId === cable.cable_id} currentPath={tempPath} onPathChange={setTempPath} onStartEdit={() => handleStartEdit(cable)} />
                    ))}

                    {nodes.map((node) => (
                        <Marker key={node.node_id} position={[node.lat, node.lng]} icon={getNodeIcon(node)} eventHandlers={{ click: () => handleNodeClick(node) }}>
                            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                                <div className="text-center">
                                    <div className="font-bold text-slate-800">{node.name}</div>
                                    <div className="text-[10px] text-slate-500">{node.type}</div>
                                </div>
                            </Tooltip>

                            <Popup>
                                <div className="min-w-[180px]">
                                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm ${node.type==='ROUTER'?'bg-purple-500':node.type==='TB'?'bg-slate-500':node.type==='OLT'?'bg-red-500':node.type==='ODC'?'bg-orange-500':'bg-slate-400'}`} 
                                              style={{backgroundColor: node.type === 'ODP' ? '#3b82f6' : undefined}}>
                                            {node.type}
                                        </span>
                                        <div className="flex gap-1">
                                            {(node.type === 'ODP' || node.type === 'OLT') && (
                                                <button onClick={(e) => { e.stopPropagation(); handleEditDetails(node); }} className="text-slate-400 hover:text-sky-600 p-1 rounded hover:bg-sky-50" title="Edit Detail">
                                                    <Gear size={16} weight="bold" />
                                                </button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.node_id, node.name); }} className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50" title="Hapus Node">
                                                <Trash size={16} weight="bold" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1">
                                        {node.type === 'ROUTER' && <RouterIcon weight="fill" className="text-purple-600"/>}
                                        {node.type === 'TB' && <HardDrives weight="fill" className="text-slate-600"/>}
                                        {node.name}
                                    </h3>
                                    
                                    {/* INFO CAPACITY PLANNING */}
                                    {node.type === 'ODP' && node.odp_detail && (
                                        <div className="mt-2 mb-2 p-2 bg-slate-50 rounded border border-slate-100">
                                            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                                <span>Port Terpakai</span>
                                                <span className="font-bold text-slate-700">{node.odp_detail.used_ports} / {node.odp_detail.total_ports}</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-1.5">
                                                <div 
                                                    className={`h-1.5 rounded-full ${node.odp_detail.used_ports >= node.odp_detail.total_ports ? 'bg-red-500' : 'bg-blue-500'}`} 
                                                    style={{ width: `${Math.min((node.odp_detail.used_ports / node.odp_detail.total_ports) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}

                                    {node.type === 'OLT' && node.olt_detail && (
                                        <p className="text-xs text-slate-600 mt-1">Brand: <b>{node.olt_detail.brand}</b></p>
                                    )}

                                    <p className="text-xs text-slate-500 mt-1 flex items-start gap-1"><Info size={14}/> {node.description || '-'}</p>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    <AddNodeHandler refreshMap={fetchTopology} />
                </MapContainer>
            </div>
        </div>
    );
};

export default NetworkMap;