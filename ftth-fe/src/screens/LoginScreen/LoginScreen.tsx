import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import api from '../../api/AxiosInstance';
import { EyesIcon as Eye, EyeClosedIcon as EyeOff, MailboxIcon as Mail, Lock, CircleNotch } from '@phosphor-icons/react'; // Saya sarankan pakai phosphor-icons agar seragam dengan dashboard

import bgkabel from '../../assets/images/bgkabel.jpg';
// import LogoPerusahaan from '../../assets/images/logo.png'; 

const EyeIconToggle = ({ isOpen }: { isOpen: boolean }) => {
    return isOpen ? <Eye size={20} /> : <EyeOff size={20} />;
};

const LoginScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true); // State untuk loading awal (cek token)
    
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
                        // Token Masih Valid -> Auto Redirect
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
                        setSuccess('Login berhasil! Mengalihkan...');
                        
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
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <CircleNotch className="animate-spin text-sky-600" size={40} />
                    <p className="text-slate-500 text-sm font-medium">Memeriksa sesi login...</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex min-h-screen bg-slate-100">
            <div 
                className="hidden lg:flex w-1/2 flex-col items-center justify-center bg-cover bg-center p-12 text-white relative" 
                style={{ backgroundImage: `url(${bgkabel})` }}
            >
                <div className="absolute inset-0 bg-sky-900/80 z-0"></div>
                <div className="relative z-10 text-center animate-fade-in">
                    <h1 className="text-3xl font-bold tracking-tight">
                        Sistem Informasi Jaringan
                    </h1>
                    <p className="mt-2 text-lg text-sky-200">
                        Manajemen Jaringan Fiber To The Home (FTTH)
                    </p>
                </div>
            </div>
            <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-8">
                <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow-lg lg:shadow-none lg:bg-transparent lg:p-0">
                    <div className="text-center mb-8 lg:text-left">
                        <h1 className="text-2xl font-bold text-slate-800">Selamat Datang</h1>
                        <p className="text-slate-500 text-sm mt-1">Silakan masuk ke akun Anda.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      
                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-md text-sm animate-shake" role="alert">
                                <p className="font-medium">Login Gagal</p>
                                <p>{error}</p>
                            </div>
                        )}
                        {success && (
                            <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-r-md text-sm animate-pulse" role="alert">
                                <p className="font-medium">Berhasil!</p>
                                <p>{success}</p>
                            </div>
                        )}
                        
                        <div>
                            <label htmlFor="email" className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
                            <div className="relative">
                                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                    <Mail size={20} />
                                </span>
                                <input 
                                    id="email" 
                                    type="email" 
                                    value={email} 
                                    onChange={(e) => setEmail(e.target.value)} 
                                    placeholder="contoh@email.com" 
                                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all shadow-sm" 
                                    required 
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="text-sm font-medium text-slate-700 mb-1 block">Password</label>
                            <div className="relative">
                                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                    <Lock size={20} />
                                </span>
                                <input 
                                    id="password" 
                                    type={showPassword ? 'text' : 'password'} 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    placeholder="••••••••" 
                                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all shadow-sm" 
                                    required 
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowPassword(!showPassword)} 
                                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-sky-600 transition-colors"
                                    title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                                >
                                    <EyeIconToggle isOpen={showPassword} />
                                </button>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoading} 
                            className="w-full bg-sky-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-sky-700 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 flex justify-center items-center gap-2"
                        >
                            {isLoading && <CircleNotch className="animate-spin" size={20}/>}
                            {isLoading ? 'Memproses...' : 'Masuk'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;