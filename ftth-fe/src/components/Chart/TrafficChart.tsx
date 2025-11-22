import React from 'react';
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

const TrafficChart: React.FC<Props> = ({ data, title, routerName }) => {
    // Fungsi format helper untuk tooltip
    const formatSpeed = (value: number) => {
        if (value >= 1000) return `${(value / 1000).toFixed(1)} Mbps`;
        return `${value} Kbps`;
    };

    const formatTime = (isoString: string) => {
        return format(new Date(isoString), 'HH:mm', { locale: id });
    };

    return (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="mb-6 flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-2 h-6 bg-sky-500 rounded-full"></span>
                        {title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 ml-4 font-mono bg-slate-100 px-2 py-1 rounded inline-block">
                        Router: {routerName}
                    </p>
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                        barSize={20}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                            dataKey="timestamp" 
                            tickFormatter={formatTime}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                        />
                        <YAxis 
                            tickFormatter={(val) => val >= 1000 ? `${val/1000}M` : `${val}K`}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            labelFormatter={(label) => format(new Date(label), 'dd MMM yyyy, HH:mm', { locale: id })}
                            formatter={(value: number) => [formatSpeed(value), '']}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                        <Bar 
                            name="Download" 
                            dataKey="DownloadSpeed" 
                            fill="#0ea5e9" // Sky-500
                            radius={[4, 4, 0, 0]} 
                        />
                        <Bar 
                            name="Upload" 
                            dataKey="UploadSpeed" 
                            fill="#8b5cf6" // Violet-500
                            radius={[4, 4, 0, 0]} 
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default TrafficChart;