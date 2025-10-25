import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import api from '../../api/AxiosInstance';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

// Aset (pastikan path-nya sudah benar)
import bgkabel from '../../assets/images/bgkabel.jpg';
// import LogoPerusahaan from '../../assets/images/logo.png'; // Ganti dengan path logo Anda

// Komponen kecil untuk toggle ikon mata, tidak perlu diubah
const EyeIconToggle = ({ isOpen }: { isOpen: boolean }) => {
    return isOpen ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />;
};

const LoginScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    // --- PERUBAHAN 1: State baru untuk pesan sukses ---
    const [success, setSuccess] = useState('');

    const navigate = useNavigate();

   const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
        const response = await api.post('/api/login', { email, password });
        if (response.data.status === 'success' && response.data.data.token) {
            
            // --- PERBAIKAN DI SINI ---
            // Token berada di dalam response.data.data
            const token = response.data.data.token; 

            try {
                const payloadBase64 = token.split('.')[1];
                const decodedPayload = atob(payloadBase64);
                const parsedPayload = JSON.parse(decodedPayload);
                
                // Pengecekan role Anda sudah benar!
                if (parsedPayload.role === 3 || parsedPayload.role === 2 || parsedPayload.role === 1) {
                    localStorage.setItem('jwt_token', token);
                    
                    setSuccess('Login berhasil! Anda akan diarahkan ke dashboard...');
                    
                    setTimeout(() => {
                        navigate('/admin');
                    }, 2000);

                } else {
                    setError('Anda tidak memiliki hak akses untuk masuk ke halaman ini.');
                    setIsLoading(false);
                }
            } catch (decodeError) {
                console.error("Gagal mendekode token:", decodeError);
                setError("Token tidak valid, silakan coba lagi.");
                setIsLoading(false);
            }
        } else {
            setError(response.data.remark || 'Terjadi kesalahan saat login.');
            setIsLoading(false);
        }
    } catch (err) {
        let errorMessage = 'Login gagal. Silakan coba lagi nanti.';
        if (err instanceof AxiosError && err.response) {
            errorMessage = err.response.data.remark || 'Email atau password yang Anda masukkan salah.';
        }
        setError(errorMessage);
        setIsLoading(false); 
    }
};
    
    return (
        <div className="flex min-h-screen bg-slate-100">
            
            <div 
                className="hidden lg:flex w-1/2 flex-col items-center justify-center bg-cover bg-center p-12 text-white relative" 
                style={{ backgroundImage: `url(${bgkabel})` }}
            >
                <div className="absolute inset-0 bg-sky-900/70 z-0"></div>
                <div className="relative z-10 text-center animate-fade-in">
                   
                    <h1 className="text-3xl font-bold tracking-tight">
                        Sistem Informasi Jaringan
                    </h1>
                    <p className="mt-2 text-lg text-sky-200">
                        Manajemen Jaringan Fiber To The Home (FTTH)
                    </p>
                </div>
            </div>

            {/* Bagian Kanan: Form Login */}
            <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-8">
                <div className="w-full max-w-sm">
                    <div className="text-center mb-8 lg:text-left">
                        <h1 className="text-2xl font-bold text-slate-800">Selamat Datang</h1>
                        <p className="text-slate-500 text-sm mt-1">Silakan masuk ke akun Anda.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      
                        {error && (
                            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md text-sm" role="alert">
                                <p>{error}</p>
                            </div>
                        )}
                        {success && (
                            <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md text-sm" role="alert">
                                <p>{success}</p>
                            </div>
                        )}
                        
                        <div>
                            <label htmlFor="email" className="text-sm font-medium text-slate-600 mb-1 block">Email</label>
                            <div className="relative">
                                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                    <Mail className="h-5 w-5" />
                                </span>
                                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contoh@email.com" className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all" required />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="password" className="text-sm font-medium text-slate-600 mb-1 block">Password</label>
                            <div className="relative">
                                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                    <Lock className="h-5 w-5" />
                                </span>
                                <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all" required />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-sky-600" aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}>
                                    <EyeIconToggle isOpen={showPassword} />
                                </button>
                            </div>
                        </div>
                        <button type="submit" disabled={isLoading} className="w-full bg-sky-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500">
                            {isLoading ? 'Memproses...' : 'Login'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;