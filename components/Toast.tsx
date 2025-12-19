import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = persistent
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onDismiss(toast.id), 300);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, toast.id, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const icons = {
    success: <CheckCircle className="text-emerald-400" size={20} />,
    error: <AlertCircle className="text-red-400" size={20} />,
    info: <Info className="text-blue-400" size={20} />,
    loading: <Loader2 className="text-indigo-400 animate-spin" size={20} />,
  };

  const borders = {
    success: 'border-emerald-500/30',
    error: 'border-red-500/30',
    info: 'border-blue-500/30',
    loading: 'border-indigo-500/30',
  };

  const backgrounds = {
    success: 'bg-emerald-500/10',
    error: 'bg-red-500/10',
    info: 'bg-blue-500/10',
    loading: 'bg-indigo-500/10',
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl
        shadow-2xl shadow-black/20 min-w-[320px] max-w-[420px]
        transition-all duration-300 ease-out
        ${borders[toast.type]} ${backgrounds[toast.type]}
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)' }}
    >
      <div className="flex-shrink-0 mt-0.5">
        {icons[toast.type]}
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-medium text-sm">{toast.title}</h4>
        {toast.message && (
          <p className="text-gray-400 text-xs mt-1 leading-relaxed">{toast.message}</p>
        )}
      </div>

      {toast.type !== 'loading' && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors p-1 -m-1"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

// Toast Container - manages multiple toasts
interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

// Hook for managing toasts
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastMessage = {
      ...toast,
      id,
      duration: toast.duration ?? 5000, // Default 5 seconds
    };
    setToasts((prev) => [...prev, newToast]);
    return id;
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const updateToast = (id: string, updates: Partial<Omit<ToastMessage, 'id'>>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  // Convenience methods
  const success = (title: string, message?: string) => 
    addToast({ type: 'success', title, message });
  
  const error = (title: string, message?: string) => 
    addToast({ type: 'error', title, message, duration: 7000 });
  
  const info = (title: string, message?: string) => 
    addToast({ type: 'info', title, message });
  
  const loading = (title: string, message?: string) => 
    addToast({ type: 'loading', title, message, duration: 0 });

  return {
    toasts,
    addToast,
    dismissToast,
    updateToast,
    success,
    error,
    info,
    loading,
  };
};

export default Toast;

