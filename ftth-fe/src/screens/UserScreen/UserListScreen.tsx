import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/AxiosInstance';
import { 
    Plus, 
    PencilSimple, 
    Trash, 
    MagnifyingGlass, 
    User as UserIcon,
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Manajemen User</h1>
                    <p className="text-slate-500 text-sm">Kelola akun pengguna sistem (Admin, Teknisi, User).</p>
                </div>
                <button 
                    onClick={() => navigate('/admin/users/add')}
                    className="inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-sm"
                >
                    <Plus size={18} weight="bold" />
                    Tambah User
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                    <MagnifyingGlass className="text-slate-400" size={20} />
                    <input 
                        type="text"
                        placeholder="Cari nama atau email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-700 placeholder:text-slate-400 outline-none"
                    />
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-slate-500">Memuat data...</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">Tidak ada user ditemukan.</div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4">Nama Lengkap</th>
                                        <th className="px-6 py-4">Email</th>
                                        <th className="px-6 py-4">Role</th>
                                        <th className="px-6 py-4 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                        <UserIcon weight="bold"/>
                                                    </div>
                                                    {user.fullname}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{user.email}</td>
                                            <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => navigate(`/admin/users/edit/${user.id}`)}
                                                        className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all"
                                                    >
                                                        <PencilSimple size={18} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(user.id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <Trash size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {filteredUsers.map((user) => (
                                <div key={user.id} className="p-4 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-lg font-bold">
                                                {user.fullname.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800">{user.fullname}</p>
                                                <p className="text-xs text-slate-500">{user.email}</p>
                                            </div>
                                        </div>
                                        {getRoleBadge(user.role)}
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
                                        <button 
                                            onClick={() => navigate(`/admin/users/edit/${user.id}`)}
                                            className="px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 rounded-md"
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(user.id)}
                                            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-md"
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