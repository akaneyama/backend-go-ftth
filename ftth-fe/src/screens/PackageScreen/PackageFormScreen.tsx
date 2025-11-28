import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/AxiosInstance';
import { ArrowLeft, FloppyDisk, CircleNotch, WifiHigh } from "@phosphor-icons/react";
import Swal from 'sweetalert2';

const PackageFormScreen: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    // State terpisah untuk upload/download agar user mudah input
    const [uploadLimit, setUploadLimit] = useState('');
    const [downloadLimit, setDownloadLimit] = useState('');
    
    const [formData, setFormData] = useState({
        package_name: '',
        package_price: '', // String dulu biar bisa handle input kosong
        package_desc: '',
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isEditMode) {
            const fetchDetail = async () => {
                setIsLoading(true);
                try {
                    const response = await api.get(`/api/internetpackages/${id}`);
                    if (response.data.status === 'success') {
                        const data = response.data.data;
                        setFormData({
                            package_name: data.package_name,
                            package_price: data.package_price.toString(),
                            package_desc: data.package_desc,
                        });
                        
                        // Pecah string "10M/20M" menjadi Upload & Download
                        const limits = data.package_limit.split('/');
                        if (limits.length === 2) {
                            setUploadLimit(limits[0]); // Upload (biasanya yang kiri di mikrotik queue)
                            setDownloadLimit(limits[1]); // Download
                        }
                    }
                } catch (err) {
                    Swal.fire("Error", "Gagal load data paket", "error");
                    navigate('/admin/packages');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchDetail();
        }
    }, [id, isEditMode, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Gabungkan Limit sesuai format backend (Upload/Download)
            const combinedLimit = `${uploadLimit}/${downloadLimit}`;

            const payload = {
                package_name: formData.package_name,
                package_desc: formData.package_desc,
                package_price: Number(formData.package_price), // Konversi ke Int
                package_limit: combinedLimit
            };

            if (isEditMode) {
                await api.put(`/api/internetpackages/${id}`, payload);
            } else {
                await api.post('/api/internetpackages/add', payload);
            }

            Swal.fire('Sukses', 'Data paket berhasil disimpan', 'success');
            navigate('/admin/packages');
        } catch (err: any) {
            console.error(err);
            Swal.fire('Gagal', err.response?.data?.message || 'Gagal menyimpan data', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    if (isLoading) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="max-w-3xl mx-auto">
            <button 
                onClick={() => navigate('/admin/packages')}
                className="mb-4 flex items-center text-sm text-slate-500 hover:text-sky-600 transition-colors"
            >
                <ArrowLeft className="mr-1" /> Kembali ke Daftar
            </button>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
                    <div className="p-3 bg-sky-100 text-sky-600 rounded-lg">
                        <WifiHigh size={24} weight="bold"/>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">
                            {isEditMode ? 'Edit Paket Internet' : 'Buat Paket Baru'}
                        </h2>
                        <p className="text-sm text-slate-500">Isi detail spesifikasi paket internet.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Nama & Harga */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Paket</label>
                            <input
                                type="text"
                                name="package_name"
                                value={formData.package_name}
                                onChange={handleChange}
                                required
                                placeholder="Contoh: Home Super 20Mbps"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Harga Bulanan (Rp)</label>
                            <input
                                type="number"
                                name="package_price"
                                value={formData.package_price}
                                onChange={handleChange}
                                required
                                placeholder="150000"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Bandwidth Limit */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <label className="block text-sm font-bold text-slate-700 mb-3">Bandwidth Limit (Format Mikrotik)</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">Max Upload</label>
                                <input
                                    type="text"
                                    value={uploadLimit}
                                    onChange={(e) => setUploadLimit(e.target.value)}
                                    required
                                    placeholder="10M"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all font-mono"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Contoh: 512k, 10M</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">Max Download</label>
                                <input
                                    type="text"
                                    value={downloadLimit}
                                    onChange={(e) => setDownloadLimit(e.target.value)}
                                    required
                                    placeholder="20M"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all font-mono"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Contoh: 10M, 50M</p>
                            </div>
                        </div>
                    </div>

                    {/* Deskripsi */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi / Keterangan</label>
                        <textarea
                            name="package_desc"
                            value={formData.package_desc}
                            onChange={handleChange}
                            required
                            rows={3}
                            placeholder="Cocok untuk streaming HD dan gaming..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all resize-none"
                        ></textarea>
                    </div>

                    <div className="pt-4 flex justify-end border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-md"
                        >
                            {isSubmitting ? (
                                <><CircleNotch className="animate-spin" size={20} /> Menyimpan...</>
                            ) : (
                                <><FloppyDisk size={20} /> Simpan Paket</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PackageFormScreen;