import React, { useState, useEffect, useMemo } from 'react';
import { 
    MapContainer, 
    TileLayer, 
    Marker, 
    Popup, 
    Polyline, 
    Tooltip, // [PENTING] Untuk fitur Hover Nama Node
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
    Warning
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

// --- 2. CUSTOM ICONS (OLT, ODC, ODP, CLIENT) ---
const createCustomIcon = (color: string) => new L.DivIcon({
    className: 'custom-node-icon',
    html: `<div style="
        background-color: ${color}; 
        width: 14px; height: 14px; 
        border-radius: 50%; 
        border: 2px solid white; 
        box-shadow: 0 0 0 2px ${color}, 0 4px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -10]
});

const icons: Record<string, L.DivIcon> = {
    OLT: createCustomIcon('#ef4444'),    // Merah
    ODC: createCustomIcon('#f97316'),    // Orange
    ODP: createCustomIcon('#3b82f6'),    // Biru
    CLIENT: createCustomIcon('#22c55e'), // Hijau
};

// Icon Kecil untuk Handle Edit Jalur Kabel
const editHandleIcon = new L.DivIcon({
    className: 'edit-handle',
    html: `<div style="
        background-color: white; 
        width: 12px; height: 12px; 
        border-radius: 50%; 
        border: 2px solid #0ea5e9; 
        cursor: grab;
        box-shadow: 0 1px 2px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [12, 12], iconAnchor: [6, 6]
});

// --- 3. TYPES ---
interface NodeData {
    node_id: number;
    name: string;
    type: 'OLT' | 'ODC' | 'ODP' | 'CLIENT';
    lat: number;
    lng: number;
    description: string;
    status: string;
}

interface CableData {
    cable_id: number;
    source_node: NodeData;
    target_node: NodeData;
    cable_type: string;
    description: string;
    coordinates: string; // JSON String "[[lat,lng], ...]"
}

// ==========================================
// SUB-COMPONENT: EDITABLE CABLE
// ==========================================
// Menangani logika tampilan kabel (View & Edit Mode)
const EditableCable = ({ 
    cable, 
    isEditing, 
    currentPath, 
    onPathChange, 
    onStartEdit 
}: { 
    cable: CableData, 
    isEditing: boolean, 
    currentPath: L.LatLngExpression[],
    onPathChange: (newPath: L.LatLngExpression[]) => void,
    onStartEdit: () => void
}) => {
    
    // Helper: Parse koordinat dari DB atau gunakan garis lurus default
    const getDisplayPath = () => {
        if (isEditing) return currentPath; // Jika sedang diedit, gunakan path sementara
        
        if (cable.coordinates && cable.coordinates !== "[]") {
            try { return JSON.parse(cable.coordinates); } catch (e) {}
        }
        // Default Lurus
        return [[cable.source_node.lat, cable.source_node.lng], [cable.target_node.lat, cable.target_node.lng]];
    };

    // Handle Drag Titik Handle
    const handleDrag = (index: number, e: any) => {
        const newPos = e.target.getLatLng();
        const updated = [...currentPath];
        updated[index] = [newPos.lat, newPos.lng];
        onPathChange(updated);
    };

    // Handle Klik Garis (Tambah Titik Baru)
    const handleLineClick = (e: any) => {
        if (!isEditing) return;
        const { lat, lng } = e.latlng;
        const newPoint: L.LatLngExpression = [lat, lng];
        
        // Sisipkan titik sebelum titik terakhir
        const updated = [...currentPath];
        if (updated.length >= 2) {
            updated.splice(updated.length - 1, 0, newPoint);
        } else {
            updated.push(newPoint);
        }
        onPathChange(updated);
    };

    // Handle Klik Kanan (Hapus Titik)
    const handleRightClick = (index: number) => {
        if (!isEditing) return;
        if (index === 0 || index === currentPath.length - 1) {
            Swal.fire({toast: true, title: 'Ujung kabel tidak bisa dihapus', icon: 'warning'});
            return;
        }
        const updated = currentPath.filter((_, i) => i !== index);
        onPathChange(updated);
    };

    return (
        <>
            <Polyline 
                positions={getDisplayPath()}
                pathOptions={{ 
                    color: isEditing ? '#0ea5e9' : '#475569', // Biru (Edit) vs Abu (View)
                    weight: isEditing ? 4 : 3,
                    opacity: 0.8,
                    dashArray: cable.cable_type.toLowerCase().includes('drop') ? '5, 10' : undefined 
                }}
                eventHandlers={{ click: handleLineClick }}
            >
                {!isEditing && (
                    <Popup>
                        <div className="text-xs p-1 min-w-[160px]">
                            <div className="font-bold text-slate-700 mb-1 flex justify-between items-center">
                                <span>Kabel #{cable.cable_id}</span>
                                <PlugsConnected className="text-sky-600" size={16}/>
                            </div>
                            <hr className="my-2 border-slate-200"/>
                            <p><span className="text-slate-400">Tipe:</span> {cable.cable_type}</p>
                            <p className="mb-3"><span className="text-slate-400">Ket:</span> {cable.description || '-'}</p>
                            
                            <button 
                                onClick={onStartEdit}
                                className="w-full bg-sky-500 hover:bg-sky-600 text-white py-1.5 rounded flex items-center justify-center gap-1 transition-colors shadow-sm font-semibold"
                            >
                                <PencilSimple weight="bold"/> Edit Jalur
                            </button>
                        </div>
                    </Popup>
                )}
            </Polyline>

            {/* HANDLES (Titik Putih) hanya muncul saat Edit Mode */}
            {isEditing && currentPath.map((pos, idx) => (
                <Marker
                    key={`handle-${cable.cable_id}-${idx}`}
                    position={pos}
                    icon={editHandleIcon}
                    draggable={idx !== 0 && idx !== currentPath.length - 1} 
                    eventHandlers={{
                        drag: (e) => handleDrag(idx, e),
                        contextmenu: () => handleRightClick(idx)
                    }}
                    zIndexOffset={1000}
                >
                    {(idx === 0 || idx === currentPath.length - 1) && (
                        <Tooltip direction="top" offset={[0, -10]} opacity={0.8}>Titik Terkunci</Tooltip>
                    )}
                </Marker>
            ))}
        </>
    );
};

// ==========================================
// MAIN COMPONENT: NETWORK MAP
// ==========================================
const NetworkMap: React.FC = () => {
    const [nodes, setNodes] = useState<NodeData[]>([]);
    const [cables, setCables] = useState<CableData[]>([]);
    
    // State Logic Connecting
    const [isConnecting, setIsConnecting] = useState(false);
    const [sourceNode, setSourceNode] = useState<NodeData | null>(null);
    
    // State Logic Editing Cable Path
    const [editingCableId, setEditingCableId] = useState<number | null>(null);
    const [tempPath, setTempPath] = useState<L.LatLngExpression[]>([]); 

    // --- FETCH TOPOLOGY DATA ---
    const fetchTopology = async () => {
        try {
            const res = await api.get('/api/topology');
            if (res.data.status === 'success') {
                setNodes(res.data.data.nodes);
                setCables(res.data.data.cables);
            }
        } catch (err) {
            console.error(err);
            Swal.fire({ toast: true, icon: 'error', title: 'Gagal memuat peta', position: 'top-end' });
        }
    };

    useEffect(() => { fetchTopology(); }, []);

    // --- HANDLER: START EDIT JALUR ---
    const handleStartEdit = (cable: CableData) => {
        setEditingCableId(cable.cable_id);
        
        // Load path eksisting ke temp state
        let initialPath: L.LatLngExpression[] = [];
        if (cable.coordinates && cable.coordinates !== "[]") {
            try { initialPath = JSON.parse(cable.coordinates); } catch (e) {}
        }
        // Jika belum ada koordinat (baru dibuat), pakai garis lurus
        if (initialPath.length === 0) {
            initialPath = [[cable.source_node.lat, cable.source_node.lng], [cable.target_node.lat, cable.target_node.lng]];
        }
        setTempPath(initialPath);
    };

    // --- HANDLER: SIMPAN JALUR (Backend) ---
    const handleSavePath = async () => {
        if (!editingCableId) return;
        try {
            const jsonPath = JSON.stringify(tempPath);
            await api.put(`/api/cables/${editingCableId}/path`, {
                coordinates: jsonPath,
                length_meter: 0 
            });
            Swal.fire({ toast: true, icon: 'success', title: 'Jalur kabel disimpan', position: 'top-end', timer: 1500 });
            
            setEditingCableId(null);
            fetchTopology();
        } catch (error) {
            Swal.fire('Error', 'Gagal menyimpan jalur', 'error');
        }
    };

    // --- HANDLER: DELETE NODE ---
    const handleDeleteNode = async (id: number, name: string) => {
        const result = await Swal.fire({
            title: 'Hapus Node?',
            html: `Hapus <b>${name}</b>?<br/><small class="text-red-500">Semua kabel terhubung juga akan dihapus!</small>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Ya, Hapus'
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/api/nodes/${id}`);
                Swal.fire('Terhapus', '', 'success');
                fetchTopology();
            } catch (err) { Swal.fire('Gagal', 'Error deleting node', 'error'); }
        }
    };

    // --- HANDLER: KLIK NODE (CONNECTING LOGIC) ---
    const handleNodeClick = async (node: NodeData) => {
        if (!isConnecting) return; 

        if (!sourceNode) {
            setSourceNode(node);
            Swal.fire({ toast: true, icon: 'info', title: `Jalur Mulai: ${node.name}`, position: 'top-end' });
        } else {
            if (sourceNode.node_id === node.node_id) return;
            
            const { value: form } = await Swal.fire({
                title: 'Hubungkan Kabel',
                html: `
                    <div class="text-left space-y-2">
                        <div class="text-xs text-slate-500">${sourceNode.name} ➝ ${node.name}</div>
                        <input id="swal-type" class="swal2-input w-full m-0" placeholder="Tipe (ex: 24 Core)">
                        <input id="swal-desc" class="swal2-input w-full m-0" placeholder="Keterangan">
                    </div>
                `,
                preConfirm: () => [
                    (document.getElementById('swal-type') as HTMLInputElement).value,
                    (document.getElementById('swal-desc') as HTMLInputElement).value
                ]
            });

            if (form) {
                try {
                    await api.post('/api/cables', {
                        source_node_id: sourceNode.node_id,
                        target_node_id: node.node_id,
                        cable_type: form[0],
                        description: form[1],
                        coordinates: "[]"
                    });
                    fetchTopology();
                    Swal.fire({ toast: true, icon: 'success', title: 'Kabel terhubung', position: 'top-end' });
                } catch (e) { Swal.fire('Gagal', 'Error creating cable', 'error'); }
            }
            setSourceNode(null);
            setIsConnecting(false);
        }
    };

    return (
        <div className="relative h-[85vh] w-full rounded-xl overflow-hidden border border-slate-300 shadow-md bg-slate-100">
            
            {/* 1. CONTROL PANEL (Top Right) */}
            <div className="absolute top-4 right-4 z-[999] flex flex-col gap-2 pointer-events-auto">
                <button 
                    onClick={() => { setIsConnecting(!isConnecting); setSourceNode(null); }}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-md transition-all border
                        ${isConnecting ? 'bg-orange-500 text-white border-orange-600 animate-pulse' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'}`}
                >
                    <ShareNetwork size={20} weight={isConnecting ? "fill" : "bold"}/>
                    {isConnecting ? (sourceNode ? 'Pilih Tujuan...' : 'Pilih Sumber...') : 'Hubungkan Node'}
                </button>
                
                <button 
                    onClick={() => Swal.fire('Info', 'Klik kanan pada peta untuk tambah Node (OLT/ODP).', 'info')}
                    className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-lg shadow-md border border-slate-200 flex items-center gap-2 text-sm font-semibold"
                >
                    <Broadcast size={20} weight="duotone" className="text-sky-600"/> Tambah Node
                </button>
            </div>

            {/* 2. FLOATING SAVE PANEL (Bottom Center - Only when editing) */}
            {editingCableId && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-white px-5 py-2.5 rounded-full shadow-2xl border border-slate-200 flex items-center gap-4 animate-fade-in-up">
                    <div className="flex flex-col items-start mr-2 border-r border-slate-200 pr-4">
                        <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">Edit Mode</span>
                        <span className="text-[10px] text-slate-400">Drag titik untuk geser</span>
                    </div>
                    <button 
                        onClick={handleSavePath}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 shadow transition-colors"
                    >
                        <FloppyDisk weight="fill" size={18}/> Simpan
                    </button>
                    <button 
                        onClick={() => { setEditingCableId(null); setTempPath([]); }} 
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 transition-colors"
                    >
                        <X weight="bold" size={18}/> Batal
                    </button>
                </div>
            )}

            {/* 3. LEGENDA (Bottom Left) */}
            <div className="absolute bottom-6 left-6 z-[999] bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <div className="font-bold mb-1 border-b pb-1 text-slate-800">Legenda</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 border border-white shadow"></div> OLT</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500 border border-white shadow"></div> ODC</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 border border-white shadow"></div> ODP</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500 border border-white shadow"></div> Client</div>
            </div>

            {/* 4. MAP CONTAINER */}
            <MapContainer center={[-7.98, 112.63]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />

                {/* Render Kabel */}
                {cables.map((cable) => (
                    <EditableCable 
                        key={cable.cable_id}
                        cable={cable}
                        isEditing={editingCableId === cable.cable_id}
                        currentPath={tempPath}
                        onPathChange={setTempPath}
                        onStartEdit={() => handleStartEdit(cable)}
                        onCancel={() => setEditingCableId(null)}
                        onSave={handleSavePath} // Not used inside but prop required
                    />
                ))}

                {/* Render Nodes */}
                {nodes.map((node) => (
                    <Marker 
                        key={node.node_id} 
                        position={[node.lat, node.lng]} 
                        icon={icons[node.type] || defaultIcon}
                        eventHandlers={{ click: () => handleNodeClick(node) }}
                    >
                        {/* [BARU] Tooltip saat Hover */}
                        <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                            <span className="font-bold text-slate-700">{node.name}</span>
                        </Tooltip>

                        <Popup>
                            <div className="min-w-[160px]">
                                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm ${node.type==='OLT'?'bg-red-500':node.type==='ODC'?'bg-orange-500':node.type==='ODP'?'bg-blue-500':'bg-green-500'}`}>{node.type}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.node_id, node.name); }} className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50">
                                        <Trash size={16} weight="bold" />
                                    </button>
                                </div>
                                <h3 className="font-bold text-sm text-slate-800">{node.name}</h3>
                                <p className="text-xs text-slate-500 mt-1 flex items-start gap-1"><Info size={14}/> {node.description || '-'}</p>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                <AddNodeHandler refreshMap={fetchTopology} />
            </MapContainer>
        </div>
    );
};

// --- COMPONENT: KLIK KANAN TAMBAH NODE ---
const AddNodeHandler = ({ refreshMap }: { refreshMap: () => void }) => {
    useMapEvents({
        contextmenu(e) {
            const { lat, lng } = e.latlng;
            Swal.fire({
                title: 'Tambah Titik Baru',
                html: `
                    <div class="text-left space-y-2">
                        <select id="swal-node-type" class="swal2-select w-full m-0 text-sm">
                            <option value="ODP">ODP (Tiang)</option><option value="ODC">ODC</option><option value="OLT">OLT</option><option value="CLIENT">Client</option>
                        </select>
                        <input id="swal-node-name" class="swal2-input w-full m-0 text-sm" placeholder="Nama Node">
                        <input id="swal-node-desc" class="swal2-input w-full m-0 text-sm" placeholder="Deskripsi">
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Simpan',
                preConfirm: () => ({
                    type: (document.getElementById('swal-node-type') as HTMLSelectElement).value,
                    name: (document.getElementById('swal-node-name') as HTMLInputElement).value,
                    description: (document.getElementById('swal-node-desc') as HTMLInputElement).value,
                    lat, lng
                })
            }).then(async (res) => {
                if (res.isConfirmed) {
                    await api.post('/api/nodes', res.value);
                    refreshMap();
                }
            });
        }
    });
    return null;
}

export default NetworkMap;