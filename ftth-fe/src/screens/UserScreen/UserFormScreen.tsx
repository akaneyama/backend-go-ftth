import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/AxiosInstance';
import { ArrowLeft, FloppyDisk, CircleNotch } from "@phosphor-icons/react";
import Swal from 'sweetalert2';

const UserFormScreen: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    const [formData, setFormData] = useState({
        email: '',
        fullname: '',
        password: '',
        role: 3 // Default User
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isEditMode) {
            const fetchUser = async () => {
                setIsLoading(true);
                try {
                    const response = await api.get(`/api/users/${id}`);
                    if (response.data.status === 'success') {
                        const data = response.data.data;
                        setFormData({
                            email: data.email,
                            fullname: data.fullname,
                            role: data.role,
                            password: '' // Password dikosongkan
                        });
                    }
                } catch (err) {
                    Swal.fire("Error", "Gagal mengambil data user", "error");
                    navigate('/admin/users');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchUser();
        }
    }, [id, isEditMode, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                ...formData,
                role: Number(formData.role)
            };

            if (isEditMode) {
                await api.put(`/api/users/${id}`, payload);
            } else {
                // Gunakan endpoint register untuk create user baru
                await api.post('/api/register', payload); 
            }

            Swal.fire('Sukses', 'Data user berhasil disimpan', 'success');
            navigate('/admin/users');
        } catch (err: any) {
            console.error(err);
            Swal.fire('Gagal', err.response?.data?.message || 'Gagal menyimpan data', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    if (isLoading) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="max-w-2xl mx-auto">
            <button 
                onClick={() => navigate('/admin/users')}
                className="mb-4 flex items-center text-sm text-slate-500 hover:text-sky-600 transition-colors"
            >
                <ArrowLeft className="mr-1" /> Kembali ke Daftar
            </button>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-800">
                        {isEditMode ? 'Edit User' : 'Tambah User Baru'}
                    </h2>
                    <p className="text-sm text-slate-500">Lengkapi data akun pengguna di bawah ini.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                        <input
                            type="text"
                            name="fullname"
                            value={formData.fullname}
                            onChange={handleChange}
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                            placeholder="Contoh: Budi Santoso"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            // Email sebaiknya tidak bisa diedit jika primary key, tapi di sini ID yang jadi PK, jadi boleh diedit
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                            placeholder="budi@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Role Akun</label>
                        <select
                            name="role"
                            value={formData.role}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                        >
                            <option value="1">Admin</option>
                            <option value="2">Teknisi</option>
                            <option value="3">User</option>
                        </select>
                        <p className="text-xs text-slate-400 mt-1">
                            Admin: Full Access. Teknisi: Limited Access. User: Read Only (Tergantung Kebijakan).
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Password {isEditMode && <span className="text-slate-400 text-xs font-normal">(Kosongkan jika tidak diubah)</span>}
                        </label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required={!isEditMode}
                            minLength={6}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                            placeholder="******"
                        />
                    </div>

                    <div className="pt-4 flex justify-end border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <><CircleNotch className="animate-spin" size={20} /> Menyimpan...</>
                            ) : (
                                <><FloppyDisk size={20} /> Simpan Data</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserFormScreen;