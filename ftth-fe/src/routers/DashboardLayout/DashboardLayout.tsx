import React, { useState, useEffect, Fragment } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Transition, Menu } from '@headlessui/react';
import {
    SquaresFour,
    Cloud as RouterIcon,
    SignOut,
    Bell,
    List,
    X,
    CaretDown,
    MagnifyingGlass,
    Network,
    Graph,
    User,
    Package,
    LineSegmentIcon,
    Table,
    Prohibit,
    Users,
    Broadcast,
    ShareNetwork,
    WifiHigh,
} from "@phosphor-icons/react";

interface UserData {
    fullname: string;
    email: string;
    role: number;
}

const navigationGroups = [
    {
        title: 'Utama',
        links: [
            { name: 'Dashboard', href: '/admin', icon: SquaresFour, end: true, adminOnly: false },
        ]
    },
    {
        title: 'Layanan & Pelanggan',
        links: [
            { name: 'Pelanggan', href: '/admin/clients', icon: Users, end: false, adminOnly: false },
            { name: 'Paket Internet', href: '/admin/packages', icon: Package, end: false, adminOnly: true },
            { name: 'Isolir Batch', href: '/admin/isolir', icon: Prohibit, end: false, adminOnly: true },
            { name: 'Pengguna Sistem', href: '/admin/users', icon: User, end: false, adminOnly: true },
        ]
    },
    {
        title: 'Infrastruktur Jaringan',
        links: [
            { name: 'Router Mikrotik', href: '/admin/routers', icon: RouterIcon, end: false, adminOnly: false },
            { name: 'Interface Jaringan', href: '/admin/interfaces', icon: Network, end: false, adminOnly: false },
            { name: 'IP Pool', href: '/admin/ippool', icon: Network, end: false, adminOnly: true },
            { name: 'ODP / Distribusi', href: '/admin/odp', icon: Broadcast, end: false, adminOnly: false },
            { name: 'Manajemen Modem', href: '/admin/genie-acs', icon: WifiHigh, end: false, adminOnly: false },
        ]
    },
    {
        title: 'Monitoring & Topologi',
        links: [
            { name: 'Traffic Monitoring', href: '/admin/traffic-monitoring', icon: Graph, end: false, adminOnly: false },
            { name: 'Visualisasi Topologi', href: '/admin/network-map', icon: LineSegmentIcon, end: false, adminOnly: false },
            { name: 'Data Topologi', href: '/admin/topology-table', icon: Table, end: false, adminOnly: false },
            { name: 'Mapping Jaringan', href: '/admin/network-mapping', icon: ShareNetwork, end: false, adminOnly: false },
        ]
    }
];


const DashboardLayout: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const token = localStorage.getItem('jwt_token');
        if (token) {
            try {
                const payloadBase64 = token.split('.')[1];
                const decodedPayload = atob(payloadBase64);
                const parsed = JSON.parse(decodedPayload);

                setUserData({
                    fullname: parsed.fullname || 'Admin',
                    email: parsed.email || 'admin@ftth.com',
                    role: parsed.role || 1
                });
            } catch (error) {
                handleLogout();
            }
        } else {
            handleLogout();
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('jwt_token');
        navigate('/login', { replace: true });
    };

    const pageTitle = navigationGroups.flatMap(g => g.links).find(link => {
        if (link.end) return location.pathname === link.href;
        return location.pathname.startsWith(link.href);
    })?.name || 'Dashboard';

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">

            {/* --- MOBILE SIDEBAR --- */}
            <Transition.Root show={sidebarOpen} as={Fragment}>
                <div className="relative z-[10000] lg:hidden">
                    <Transition.Child as={Fragment} enter="transition-opacity ease-linear duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="transition-opacity ease-linear duration-300" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-slate-900/80" onClick={() => setSidebarOpen(false)} />
                    </Transition.Child>
                    <div className="fixed inset-0 flex">
                        <Transition.Child as={Fragment} enter="transition ease-in-out duration-300 transform" enterFrom="-translate-x-full" enterTo="translate-x-0" leave="transition ease-in-out duration-300 transform" leaveFrom="translate-x-0" leaveTo="-translate-x-full">
                            <div className="relative mr-16 flex w-full max-w-xs flex-1">
                                <SidebarContent onLogout={handleLogout} onClose={() => setSidebarOpen(false)} userRole={userData?.role} />
                                <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                                    <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                                        <X className="h-6 w-6 text-white" aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        </Transition.Child>
                    </div>
                </div>
            </Transition.Root>

            {/* --- DESKTOP SIDEBAR --- */}
            <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
                <SidebarContent onLogout={handleLogout} userRole={userData?.role} />
            </div>

            {/* --- MAIN CONTENT WRAPPER --- */}
            {/* PERBAIKAN SCROLL: Tambahkan h-full agar wrapper mengisi tinggi layar, dan min-w-0 agar tidak overstretch */}
            <div className="flex flex-1 flex-col lg:pl-72 h-full min-w-0">

                {/* Header (Sticky) */}
                <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
                    <button type="button" className="-m-2.5 p-2.5 text-slate-700 lg:hidden" onClick={() => setSidebarOpen(true)}>
                        <List className="h-6 w-6" aria-hidden="true" />
                    </button>
                    <div className="hidden sm:flex flex-1 text-lg font-semibold text-slate-800">{pageTitle}</div>

                    <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 justify-end">
                        <div className="flex items-center gap-x-4 lg:gap-x-6">
                            <div className="relative hidden md:block">
                                <MagnifyingGlass className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-slate-400 ml-3" />
                                <input type="text" placeholder="Cari data..." className="block w-full rounded-full border-0 py-1.5 pl-10 pr-3 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6 bg-slate-50 transition-all" />
                            </div>
                            <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
                            <button type="button" className="-m-2.5 p-2.5 text-slate-400 hover:text-slate-500"><Bell className="h-6 w-6" /></button>

                            {/* User Menu */}
                            <Menu as="div" className="relative">
                                <Menu.Button className="-m-1.5 flex items-center p-1.5">
                                    <img className="h-8 w-8 rounded-full bg-slate-50 object-cover ring-2 ring-sky-100" src={`https://ui-avatars.com/api/?name=${userData?.fullname}&background=0ea5e9&color=fff`} alt="" />
                                    <span className="hidden lg:flex lg:items-center">
                                        <span className="ml-4 text-sm font-semibold leading-6 text-slate-900">{userData?.fullname}</span>
                                        <CaretDown className="ml-2 h-5 w-5 text-slate-400" />
                                    </span>
                                </Menu.Button>
                                <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                    <Menu.Items className="absolute right-0 z-10 mt-2.5 w-48 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-slate-900/5 focus:outline-none">
                                        <Menu.Item>{({ active }) => (<button onClick={handleLogout} className={`${active ? 'bg-red-50 text-red-700' : 'text-red-600'} w-full text-left block px-3 py-1 text-sm leading-6 font-medium`}>Logout</button>)}</Menu.Item>
                                    </Menu.Items>
                                </Transition>
                            </Menu>
                        </div>
                    </div>
                </header>

                {/* --- PERBAIKAN UTAMA SCROLL --- */}
                {/* overflow-y-auto: Mengaktifkan scrollbar vertikal pada konten utama */}
                {/* overflow-x-hidden mencegah horizontal scroll tingkat layout */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 relative">
                    {/* min-h-full memastikan background mengisi layar walau konten sedikit */}
                    <div className="px-4 py-10 sm:px-6 lg:px-8 min-h-full max-w-full">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

const SidebarContent: React.FC<{ onLogout: () => void; onClose?: () => void; userRole?: number }> = ({ onLogout, onClose, userRole }) => {
    return (
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-slate-800 bg-slate-950 px-6 pb-6">
            <div className="flex h-20 shrink-0 items-center justify-center border-b border-slate-900 mb-2">
                <div className="inline-flex p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl ring-4 ring-sky-500/5 transition duration-300 hover:border-sky-500/50">
                    <ShareNetwork size={30} className="text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.4)] animate-pulse" weight="fill" />
                </div>
            </div>

            <nav className="flex flex-1 flex-col">
                <ul role="list" className="flex flex-1 flex-col gap-y-6">
                    {navigationGroups.map((group) => {
                        // Filter links based on role
                        const visibleLinks = group.links.filter(link => {
                            if (link.adminOnly && userRole !== 1) return false;
                            return true;
                        });

                        if (visibleLinks.length === 0) return null;

                        return (
                            <li key={group.title}>
                                <div className="text-[10px] font-black leading-6 text-slate-500 uppercase tracking-widest mb-3">{group.title}</div>
                                <ul role="list" className="-mx-2 space-y-1.5">
                                    {visibleLinks.map((item) => (
                                        <li key={item.name}>
                                            <NavLink
                                                to={item.href}
                                                end={item.end}
                                                onClick={onClose}
                                                className={({ isActive }) => `group flex items-center gap-x-3 rounded-xl p-2.5 text-xs font-bold transition-all duration-300 border ${isActive
                                                    ? 'bg-gradient-to-r from-sky-500/10 to-indigo-500/10 text-sky-400 border-sky-500/20 shadow-[0_0_12px_rgba(14,165,233,0.08)]'
                                                    : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                                                    }`}
                                            >
                                                {({ isActive }) => (
                                                    <>
                                                        <item.icon
                                                            className={`h-5 w-5 shrink-0 transition-colors duration-300 ${isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-white'
                                                                }`}
                                                            aria-hidden="true"
                                                            weight={isActive ? "fill" : "regular"}
                                                        />
                                                        {item.name}
                                                    </>
                                                )}
                                            </NavLink>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        );
                    })}

                    {/* Logout Button */}
                    <li className="mt-auto">
                        <button
                            onClick={onLogout}
                            className="group relative flex w-full justify-center items-center gap-x-3 rounded-xl p-3 text-sm font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 hover:border-rose-500 hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all duration-300 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-rose-600 to-rose-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <SignOut className="relative z-10 h-5 w-5 shrink-0 transition-transform duration-300 group-hover:-translate-x-1" aria-hidden="true" weight="bold" />
                            <span className="relative z-10">Keluar Sistem</span>
                        </button>
                    </li>
                </ul>
            </nav>
        </div>
    );
};

export default DashboardLayout;