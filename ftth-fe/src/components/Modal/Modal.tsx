import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

// Tipe untuk status modal yang berbeda
type ModalStatus = 'success' | 'error' | 'warning';

// Definisi props untuk komponen Modal
export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    status?: ModalStatus;
    autoClose?: number; // Prop opsional untuk durasi tutup-otomatis dalam milidetik
}

// Konfigurasi visual (ikon & warna) untuk setiap status
const statusConfig = {
    success: {
        icon: <CheckCircle2 className="h-10 w-10 text-green-600" />,
        bgColor: 'bg-green-100',
        buttonColor: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
    },
    error: {
        icon: <XCircle className="h-10 w-10 text-red-600" />,
        bgColor: 'bg-red-100',
        buttonColor: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    warning: {
        icon: <AlertTriangle className="h-10 w-10 text-yellow-600" />,
        bgColor: 'bg-yellow-100',
        buttonColor: 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500',
    }
};

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    status = 'success', // Nilai default status adalah 'success'
    autoClose,
}) => {
    // useEffect untuk menangani timer tutup-otomatis
    useEffect(() => {
        if (!isOpen || !autoClose) return;

        const timer = setTimeout(() => {
            onClose();
        }, autoClose);

        // Fungsi cleanup untuk membersihkan timer
        return () => clearTimeout(timer);
    }, [isOpen, autoClose, onClose]);

    // Jangan render apapun jika modal tidak terbuka
    if (!isOpen) return null;

    const currentStatus = statusConfig[status];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 transition-opacity" role="dialog" aria-modal="true">
            <div className="bg-white rounded-2xl shadow-xl p-8 m-4 max-w-sm w-full text-center transform transition-all animate-scale-in">
                <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full ${currentStatus.bgColor} mb-4`}>
                    {currentStatus.icon}
                </div>
                <h3 className="text-2xl font-bold text-slate-800" id="modal-title">
                    {title}
                </h3>
                <div className="mt-2">
                    <p className="text-base text-slate-500">
                        {children}
                    </p>
                </div>

                {/* Tampilkan tombol "Tutup" hanya jika tidak ada properti autoClose */}
                {!autoClose && (
                    <div className="mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className={`w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${currentStatus.buttonColor}`}
                        >
                            Tutup
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;