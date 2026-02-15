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
    Network,Graph,
    PlugsConnected,
    User,
    Package,
} from "@phosphor-icons/react";

interface UserData {
    fullname: string;
    email: string;
    role: number;
}

const navigationLinks = [
    { name: 'Dashboard', href: '/admin', icon: SquaresFour, end: true },
    { name: 'Pengguna', href: '/admin/users', icon: User, end: false },
    { name: 'Paket', href: '/admin/packages', icon: Package, end: false },
    { name: 'Router', href: '/admin/routers', icon: RouterIcon, end: false },
    { name: 'Interface', href: '/admin/interfaces', icon: Network, end: false },
    { name: 'Traffic', href: '/admin/traffic-monitoring', icon: Graph, end: false },
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

    const pageTitle = navigationLinks.find(link => {
        if (link.end) return location.pathname === link.href;
        return location.pathname.startsWith(link.href);
    })?.name || 'Dashboard';

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            
            {/* --- MOBILE SIDEBAR --- */}
            <Transition.Root show={sidebarOpen} as={Fragment}>
                <div className="relative z-50 lg:hidden">
                    <Transition.Child as={Fragment} enter="transition-opacity ease-linear duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="transition-opacity ease-linear duration-300" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-slate-900/80" onClick={() => setSidebarOpen(false)} />
                    </Transition.Child>
                    <div className="fixed inset-0 flex">
                        <Transition.Child as={Fragment} enter="transition ease-in-out duration-300 transform" enterFrom="-translate-x-full" enterTo="translate-x-0" leave="transition ease-in-out duration-300 transform" leaveFrom="translate-x-0" leaveTo="-translate-x-full">
                            <div className="relative mr-16 flex w-full max-w-xs flex-1">
                                <SidebarContent onLogout={handleLogout} onClose={() => setSidebarOpen(false)} userData={userData} />
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
                <SidebarContent onLogout={handleLogout} userData={userData} />
            </div>

            {/* --- MAIN CONTENT WRAPPER --- */}
            {/* PERBAIKAN SCROLL: Tambahkan h-full agar wrapper mengisi tinggi layar */}
            <div className="flex flex-1 flex-col lg:pl-72 h-full">
                
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
                <main className="flex-1 overflow-y-auto bg-slate-50">
                    {/* min-h-full memastikan background mengisi layar walau konten sedikit */}
                    <div className="px-4 py-10 sm:px-6 lg:px-8 min-h-full">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

const SidebarContent: React.FC<{ onLogout: () => void; onClose?: () => void; userData: UserData | null }> = ({ onLogout, onClose }) => {
    return (
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-slate-200 bg-white px-6 pb-4">
            <div className="flex h-16 shrink-0 items-center justify-center border-b border-slate-100 mb-2">
                <div className="flex items-center gap-2">
                    {/* <div className="h-8 w-8 rounded bg-sky-600 flex items-center justify-center text-white font-bold shadow-sm"><RouterIcon size={20} weight="bold"/></div> */}
                    <span className="text-xl font-bold text-slate-800 tracking-tight">Monitoring Traffic</span>
                </div>
            </div>
            <nav className="flex flex-1 flex-col">
                <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    <li>
                        <div className="text-xs font-semibold leading-6 text-slate-400 uppercase tracking-wider mb-2">Menu Utama</div>
                        <ul role="list" className="-mx-2 space-y-1">
                            {navigationLinks.map((item) => (
                                <li key={item.name}>
                                    <NavLink to={item.href} end={item.end} onClick={onClose} className={({ isActive }) => `group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium transition-all duration-200 border border-transparent ${isActive ? 'bg-sky-50 text-sky-700 border-sky-200/50 shadow-sm' : 'text-slate-600 hover:text-sky-600 hover:bg-slate-50'}`}>
                                        {({ isActive }) => (<><item.icon className={`h-6 w-6 shrink-0 transition-colors duration-200 ${isActive ? 'text-sky-600' : 'text-slate-400 group-hover:text-sky-600'}`} aria-hidden="true" weight={isActive ? "fill" : "regular"}/>{item.name}</>)}
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </li>
                    
                    <li className="mt-auto">
                        <button onClick={onLogout} className="group -mx-2 flex w-full gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"><SignOut className="h-6 w-6 shrink-0 text-slate-400 group-hover:text-red-500" aria-hidden="true" />Logout</button>
                    </li>
                </ul>
            </nav>
        </div>
    );
};

export default DashboardLayout;