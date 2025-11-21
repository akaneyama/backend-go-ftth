import React from 'react';
import { Cloud as RouterIcon, Users, CheckCircle, XCircle } from "@phosphor-icons/react";

const stats = [
  { name: 'Total Router', value: '12', icon: RouterIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
  { name: 'Router Aktif', value: '10', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  { name: 'Router Down', value: '2', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  { name: 'Pelanggan', value: '48', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
];

const DashboardHome: React.FC = () => {
  return (
    <div>
        <div className="mb-8">
            <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
                Ringkasan Jaringan
            </h2>
            <p className="mt-1 text-sm text-slate-500">Overview status jaringan FTTH Anda hari ini.</p>
        </div>

        {/* Stats Grid */}
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((item) => (
            <div
                key={item.name}
                className="relative overflow-hidden rounded-lg bg-white px-4 pt-5 pb-12 shadow-sm ring-1 ring-slate-200 sm:px-6 sm:pt-6 transition hover:shadow-md"
            >
                <dt>
                    <div className={`absolute rounded-md p-3 ${item.bg}`}>
                        <item.icon className={`h-6 w-6 ${item.color}`} aria-hidden="true" weight="duotone" />
                    </div>
                    <p className="ml-16 truncate text-sm font-medium text-slate-500">{item.name}</p>
                </dt>
                <dd className="ml-16 flex items-baseline pb-1 sm:pb-7">
                    <p className="text-2xl font-semibold text-slate-900">{item.value}</p>
                </dd>
            </div>
            ))}
        </dl>

    
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200 p-6 min-h-[300px]">
                <h3 className="text-base font-semibold leading-6 text-slate-900 mb-4">Aktivitas Terakhir</h3>
                <div className="border-l-2 border-slate-100 pl-4 space-y-4">
                    <div className="relative">
                        <div className="text-sm font-medium text-slate-800">Router MikroTik-Core ditambahkan</div>
                        <div className="text-xs text-slate-500">2 jam yang lalu oleh Admin</div>
                    </div>
                    <div className="relative">
                        <div className="text-sm font-medium text-slate-800">Router GPON-01 Update Firmware</div>
                        <div className="text-xs text-slate-500">5 jam yang lalu oleh Teknisi</div>
                    </div>
                </div>
            </div>
            
            <div className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200 p-6 min-h-[300px] flex items-center justify-center text-slate-400">
                <div className="text-center">
                    <p>Grafik Traffic Jaringan</p>
                    <p className="text-xs mt-1">(Coming Soon)</p>
                </div>
            </div>
        </div>
    </div>
  );
};

export default DashboardHome;