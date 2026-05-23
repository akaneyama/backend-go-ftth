import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/AxiosInstance';
import { 
    Plus, 
    PencilSimple, 
    Trash, 
    MagnifyingGlass, 
    ShieldCheck,
    Wrench,
    Users
} from "@phosphor-icons/react";
import Swal from 'sweetalert2';

interface UserData {
    id: number;
    email: string;
    fullname: string;
    role: number;
}

const UserListScreen: React.FC = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/api/users');
            if (response.data.status === 'success') {
                setUsers(response.data.data);
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Gagal', 'Gagal memuat data user', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleDelete = async (id: number) => {
        const result = await Swal.fire({
            title: 'Hapus User?',
            text: "User yang dihapus tidak bisa login lagi.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Ya, Hapus!'
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/api/users/${id}`);
                Swal.fire('Terhapus!', 'User berhasil dihapus.', 'success');
                fetchUsers();
            } catch (err: any) {
                Swal.fire('Gagal!', err.response?.data?.message || 'Error', 'error');
            }
        }
    };

    // Helper untuk Badge Role
    const getRoleBadge = (role: number) => {
        switch(role) {
            case 1: return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200"><ShieldCheck weight="fill"/> Admin</span>;
            case 2: return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-700 border border-sky-200"><Wrench weight="fill"/> Teknisi</span>;
            default: return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200"><Users weight="fill"/> User</span>;
        }
    };

    const filteredUsers = users.filter(user => 
        user.fullname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
                <div>
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <Users size={28} weight="fill" className="text-sky-400 animate-pulse" />
                        Manajemen Pengguna
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">Kelola dan atur akun pengguna sistem (Admin, Teknisi, dan Operator) untuk hak akses provisioning serta monitoring.</p>
                </div>
                <div>
                    <button 
                        onClick={() => navigate('/admin/users/add')}
                        className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 shadow-md shadow-sky-500/25 transition-all duration-300"
                    >
                        <Plus size={16} weight="bold" /> Tambah User Baru
                    </button>
                </div>
            </div>

            {/* Search and Table Area */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Search */}
                <div className="p-5 border-b border-slate-50 flex items-center gap-3 bg-slate-50/50">
                    <MagnifyingGlass className="text-slate-400" size={20} />
                    <input 
                        type="text"
                        placeholder="Cari berdasarkan nama atau email pengguna..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-xs text-slate-700 placeholder:text-slate-400 outline-none font-medium"
                    />
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-slate-400 font-bold text-xs animate-pulse">Memuat data pengguna...</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs font-bold">Tidak ada pengguna ditemukan.</div>
                ) : (
                    <>
                        {/* --- DESKTOP TABLE --- */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Nama Lengkap</th>
                                        <th className="px-6 py-4">Email Address</th>
                                        <th className="px-6 py-4">Level Akses</th>
                                        <th className="px-6 py-4 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <img 
                                                        className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-100" 
                                                        src={`https://ui-avatars.com/api/?name=${user.fullname}&background=e2e8f0&color=475569`} 
                                                        alt="Avatar" 
                                                    />
                                                    <div>
                                                        <p className="font-extrabold text-slate-855 text-slate-800">{user.fullname}</p>
                                                        <span className="text-[9px] text-slate-400 font-bold">ID: #{user.id}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 font-medium">{user.email}</td>
                                            <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button 
                                                        onClick={() => navigate(`/admin/users/edit/${user.id}`)}
                                                        className="p-2 bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-500 hover:text-sky-600 rounded-xl transition active:scale-95"
                                                        title="Ubah Akses"
                                                    >
                                                        <PencilSimple size={16} weight="bold" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(user.id)}
                                                        className="p-2 bg-slate-50 border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition active:scale-95"
                                                        title="Hapus Akun"
                                                    >
                                                        <Trash size={16} weight="bold" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* --- MOBILE CARDS --- */}
                        <div className="md:hidden divide-y divide-slate-150 divide-slate-100">
                            {filteredUsers.map((user) => (
                                <div key={user.id} className="p-5 space-y-4 hover:bg-slate-50/30 transition">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <img 
                                                className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-100" 
                                                src={`https://ui-avatars.com/api/?name=${user.fullname}&background=e2e8f0&color=475569`} 
                                                alt="Avatar" 
                                            />
                                            <div>
                                                <p className="font-extrabold text-slate-800 text-xs">{user.fullname}</p>
                                                <p className="text-[10px] text-slate-500 font-medium">{user.email}</p>
                                            </div>
                                        </div>
                                        {getRoleBadge(user.role)}
                                    </div>
                                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-50">
                                        <button 
                                            onClick={() => navigate(`/admin/users/edit/${user.id}`)}
                                            className="px-3.5 py-2 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-100 rounded-xl active:scale-95 transition"
                                        >
                                            Ubah
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(user.id)}
                                            className="px-3.5 py-2 text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 rounded-xl active:scale-95 transition"
                                        >
                                            Hapus
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default UserListScreen;