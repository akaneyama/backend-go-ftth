import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/AxiosInstance';
import { 
    EyesIcon as Eye, 
    EyeClosedIcon as EyeOff, 
    MailboxIcon as Mail, 
    Lock, 
    CircleNotch,
    ShareNetwork 
} from '@phosphor-icons/react';

import bgkabel from '../../assets/images/bgkabel.jpg';

const EyeIconToggle = ({ isOpen }: { isOpen: boolean }) => {
    return isOpen ? <Eye size={20} /> : <EyeOff size={20} />;
};

const LoginScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const navigate = useNavigate();

    // --- FITUR AUTO LOGIN ---
    useEffect(() => {
        const checkAuth = () => {
            const token = localStorage.getItem('jwt_token');
            
            if (token) {
                try {
                    const payloadBase64 = token.split('.')[1];
                    const decodedPayload = JSON.parse(atob(payloadBase64));
                    const currentTime = Date.now() / 1000;
                    
                    if (decodedPayload.exp < currentTime) {
                        console.log("Token expired, silakan login ulang.");
                        localStorage.removeItem('jwt_token');
                    } else {
                        console.log("Token valid, redirecting...");
                        navigate('/admin', { replace: true });
                        return; 
                    }
                } catch (e) {
                    console.error("Token rusak:", e);
                    localStorage.removeItem('jwt_token');
                }
            }
        
            setIsCheckingAuth(false);
        };

        checkAuth();
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await api.post('/api/login', { email, password });
            
            if (response.data.status === 'success' && response.data.data.token) {
                const token = response.data.data.token;
        
                try {
                    const payloadBase64 = token.split('.')[1];
                    const decodedPayload = JSON.parse(atob(payloadBase64));
                    
                    if ([1, 2, 3].includes(decodedPayload.role)) {
                        localStorage.setItem('jwt_token', token);
                        setSuccess('Login berhasil! Mengalihkan ke dashboard...');
                        
                        setTimeout(() => {
                            navigate('/admin');
                        }, 1500);
                    } else {
                        setError('Role user tidak dikenali.');
                        setIsLoading(false);
                    }
                } catch (decodeError) {
                    setError("Token server invalid.");
                    setIsLoading(false);
                }
            } else {
                setError(response.data.remark || 'Terjadi kesalahan saat login.');
                setIsLoading(false);
            }
        } catch (err: any) {
            let errorMessage = 'Login gagal. Coba lagi nanti.';
            if (err.response && err.response.data) {
                errorMessage = err.response.data.remark || err.response.data.message || 'Email atau password salah.';
            }
            setError(errorMessage);
            setIsLoading(false);
        }
    };

    if (isCheckingAuth) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-3">
                    <CircleNotch className="animate-spin text-sky-400" size={40} />
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider animate-pulse">Memeriksa sesi login...</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex min-h-screen bg-slate-950 relative overflow-hidden font-sans">
            {/* Background decorative blobs */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

            {/* --- LEFT PANEL: IMAGE BANNER --- */}
            <div 
                className="hidden lg:flex w-1/2 flex-col items-center justify-center bg-cover bg-center p-12 text-white relative border-r border-slate-900" 
                style={{ backgroundImage: `url(${bgkabel})` }}
            >
                <div className="absolute inset-0 bg-slate-950/85 z-0" />
                
                <div className="relative z-10 text-center space-y-6 max-w-md">
                    <div className="inline-flex p-4 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-md shadow-2xl">
                        <ShareNetwork size={48} className="text-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.5)] animate-pulse" weight="fill" />
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-2xl font-black tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-sky-400">
                            Sistem Informasi Manajemen Jaringan
                        </h1>
                    </div>
                </div>
            </div>

            {/* --- RIGHT PANEL: FORM --- */}
            <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12 relative z-10">
                <div className="w-full max-w-md bg-slate-900/40 border border-slate-800/80 p-8 rounded-3xl shadow-2xl backdrop-blur-xl space-y-8">
                    
                    {/* Header Card (Logo shows on Mobile) */}
                    <div className="text-center space-y-4">
                        <div className="lg:hidden inline-flex p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl mb-2">
                            <ShareNetwork size={32} className="text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)] animate-pulse" weight="fill" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-black text-white tracking-tight">Selamat Datang</h2>
                            <p className="text-slate-400 text-xs font-semibold">Silakan masuk untuk mengelola sistem jaringan.</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Status Alerts */}
                        {error && (
                            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs space-y-1" role="alert">
                                <p className="font-black uppercase tracking-wider text-[10px]">Login Gagal</p>
                                <p className="font-semibold leading-relaxed">{error}</p>
                            </div>
                        )}
                        {success && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-xs space-y-1 animate-pulse" role="alert">
                                <p className="font-black uppercase tracking-wider text-[10px]">Berhasil!</p>
                                <p className="font-semibold leading-relaxed">{success}</p>
                            </div>
                        )}
                        
                        {/* Email Input */}
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Email Address</label>
                            <div className="relative">
                                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                                    <Mail size={18} />
                                </span>
                                <input 
                                    id="email" 
                                    type="email" 
                                    value={email} 
                                    onChange={(e) => setEmail(e.target.value)} 
                                    placeholder="nama@email.com" 
                                    className="w-full pl-11 pr-4 py-3 bg-slate-950/65 border border-slate-800/80 rounded-2xl text-xs font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all" 
                                    required 
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-1.5">
                            <label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Password</label>
                            <div className="relative">
                                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                                    <Lock size={18} />
                                </span>
                                <input 
                                    id="password" 
                                    type={showPassword ? 'text' : 'password'} 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    placeholder="••••••••" 
                                    className="w-full pl-11 pr-10 py-3 bg-slate-950/65 border border-slate-800/80 rounded-2xl text-xs font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all" 
                                    required 
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowPassword(!showPassword)} 
                                    className="absolute inset-y-0 right-0 px-4 flex items-center text-slate-500 hover:text-sky-400 transition-colors"
                                    title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                                >
                                    <EyeIconToggle isOpen={showPassword} />
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button 
                            type="submit" 
                            disabled={isLoading} 
                            className="w-full bg-gradient-to-r from-sky-500 to-indigo-650 hover:from-sky-600 hover:to-indigo-700 text-white font-extrabold text-xs py-3.5 px-4 rounded-2xl transition-all duration-300 shadow-lg shadow-sky-500/10 active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            {isLoading ? (
                                <CircleNotch className="animate-spin" size={16}/>
                            ) : (
                                <Lock size={14} weight="bold" />
                            )}
                            {isLoading ? 'MEMPROSES...' : 'MASUK KE DASHBOARD'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;