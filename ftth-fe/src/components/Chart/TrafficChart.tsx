import React, { useMemo } from 'react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ArrowDown, ArrowUp, Cloud as RouterIcon } from "@phosphor-icons/react";

// --- TYPES ---
interface TrafficData {
    timestamp: string;
    DownloadSpeed: number;
    UploadSpeed: number;
}

interface Props {
    data: TrafficData[];
    title: string;
    routerName: string;
}

// --- HELPER: SMART FORMATTER (bps -> Gbps) ---
const formatBitrate = (bits: number): string => {
    if (!bits || bits === 0) return '0 bps';
    const k = 1000;
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
    const i = Math.floor(Math.log(bits) / Math.log(k));
    
    const decimals = i >= 2 ? 1 : 0; 
    return `${parseFloat((bits / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

// --- COMPONENT: CUSTOM TOOLTIP ---
// PERBAIKAN DISINI: Kita definisikan tipe props secara manual agar TypeScript tidak error
interface CustomTooltipProps {
    active?: boolean;
    payload?: any; // Kita gunakan any[] agar fleksibel menerima data recharts
    label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length && label) {
        return (
            <div className="bg-white/95 backdrop-blur-sm p-4 border border-slate-100 rounded-xl shadow-xl space-y-3 min-w-[200px]">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 border-b border-slate-100 pb-2">
                    {format(new Date(label), 'dd MMMM yyyy, HH:mm', { locale: id })}
                </p>
                <div className="space-y-2">
                    {/* Download Info */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-sky-100 rounded text-sky-600">
                                <ArrowDown size={14} weight="bold"/>
                            </div>
                            <span className="text-sm font-medium text-slate-600">Download</span>
                        </div>
                        <span className="text-sm font-bold text-slate-800 font-mono">
                            {formatBitrate(payload[0].value as number)}
                        </span>
                    </div>
                    {/* Upload Info */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-purple-100 rounded text-purple-600">
                                <ArrowUp size={14} weight="bold"/>
                            </div>
                            <span className="text-sm font-medium text-slate-600">Upload</span>
                        </div>
                        <span className="text-sm font-bold text-slate-800 font-mono">
                            {formatBitrate(payload[1].value as number)}
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

// --- MAIN COMPONENT ---
const TrafficChart: React.FC<Props> = ({ data, title, routerName }) => {
    
    // Hitung Peak (Max) Speed untuk ditampilkan di Header
    const peakStats = useMemo(() => {
        let maxDown = 0;
        let maxUp = 0;
        data.forEach(d => {
            if (d.DownloadSpeed > maxDown) maxDown = d.DownloadSpeed;
            if (d.UploadSpeed > maxUp) maxUp = d.UploadSpeed;
        });
        return { down: maxDown, up: maxUp };
    }, [data]);

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col h-full">
            
            {/* --- HEADER CARD --- */}
            <div className="p-5 border-b border-slate-50 bg-gradient-to-r from-white to-slate-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    
                    {/* Title & Router Badge */}
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
                            <span className="w-1.5 h-6 bg-gradient-to-b from-sky-400 to-purple-500 rounded-full"></span>
                            {title}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-3.5">
                            <RouterIcon size={14} className="text-slate-400"/>
                            <span className="font-medium">{routerName}</span>
                        </div>
                    </div>

                    {/* Peak Stats (Summary) */}
                    <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm">
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Peak Down</p>
                            <p className="text-xs font-bold text-sky-600 font-mono">{formatBitrate(peakStats.down)}</p>
                        </div>
                        <div className="w-px h-6 bg-slate-100"></div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Peak Up</p>
                            <p className="text-xs font-bold text-purple-600 font-mono">{formatBitrate(peakStats.up)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- CHART AREA --- */}
            <div className="flex-1 p-4 min-h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                        barGap={2}
                    >
                        {/* Gradients Definitions */}
                        <defs>
                            <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.9}/>
                                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.6}/>
                            </linearGradient>
                            <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.6}/>
                            </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        
                        <XAxis 
                            dataKey="timestamp" 
                            tickFormatter={(val) => {
                                try {
                                    return format(new Date(val), 'HH:mm');
                                } catch (e) {
                                    return val;
                                }
                            }}
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                            minTickGap={30}
                        />
                        
                        <YAxis 
                            tickFormatter={(val) => {
                                // Short formatter for Y-Axis labels
                                if (val >= 1e9) return `${(val/1e9).toFixed(0)}G`;
                                if (val >= 1e6) return `${(val/1e6).toFixed(0)}M`;
                                if (val >= 1e3) return `${(val/1e3).toFixed(0)}K`;
                                return val;
                            }}
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                            dx={-5}
                        />
                        
                        <Tooltip 
                            cursor={{ fill: '#f8fafc', opacity: 0.6 }}
                            content={<CustomTooltip />} 
                        />
                        
                        <Legend 
                            wrapperStyle={{ paddingTop: '20px' }} 
                            iconType="circle"
                            formatter={(value) => <span className="text-xs font-semibold text-slate-600 ml-1">{value} Speed</span>}
                        />
                        
                        {/* Bars with Gradient and Radius */}
                        <Bar 
                            name="Download" 
                            dataKey="DownloadSpeed" 
                            fill="url(#colorDownload)" 
                            radius={[4, 4, 0, 0]} 
                            maxBarSize={40}
                            animationDuration={1500}
                        />
                        <Bar 
                            name="Upload" 
                            dataKey="UploadSpeed" 
                            fill="url(#colorUpload)" 
                            radius={[4, 4, 0, 0]} 
                            maxBarSize={40}
                            animationDuration={1500}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default TrafficChart;