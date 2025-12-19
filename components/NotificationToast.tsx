import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Film, X, ChevronRight } from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationToastProps {
  notification: AppNotification | null;
  onClose: () => void;
  onClick: (notification: AppNotification) => void;
  autoHideDuration?: number; // milliseconds
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  onClick,
  autoHideDuration = 8000,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (notification) {
      // Show the toast
      setIsVisible(true);
      setIsLeaving(false);

      // Auto-hide after duration
      const timer = setTimeout(() => {
        handleClose();
      }, autoHideDuration);

      return () => clearTimeout(timer);
    }
  }, [notification, autoHideDuration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300); // Match animation duration
  };

  const handleClick = () => {
    if (notification) {
      onClick(notification);
      handleClose();
    }
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'analysis_complete':
        return <CheckCircle2 size={20} className="text-green-400" />;
      case 'analysis_failed':
        return <AlertCircle size={20} className="text-red-400" />;
      case 'video_ready':
        return <Film size={20} className="text-purple-400" />;
      default:
        return <CheckCircle2 size={20} className="text-gray-400" />;
    }
  };

  const getBorderColor = (type: AppNotification['type']) => {
    switch (type) {
      case 'analysis_complete':
        return 'border-l-green-500';
      case 'analysis_failed':
        return 'border-l-red-500';
      case 'video_ready':
        return 'border-l-purple-500';
      default:
        return 'border-l-gray-500';
    }
  };

  if (!notification || !isVisible) return null;

  return (
    <div 
      className={`fixed bottom-6 right-6 z-[100] transition-all duration-300 ${
        isLeaving 
          ? 'opacity-0 translate-x-4' 
          : 'opacity-100 translate-x-0'
      }`}
    >
      <div 
        className={`
          flex items-center gap-3 p-4 pr-3
          bg-gray-900 border border-gray-700 border-l-4 ${getBorderColor(notification.type)}
          rounded-xl shadow-2xl cursor-pointer
          hover:bg-gray-800 transition-colors
          max-w-sm
        `}
        onClick={handleClick}
      >
        {/* Icon */}
        <div className={`p-2 rounded-full flex-shrink-0 ${
          notification.type === 'analysis_complete' ? 'bg-green-500/10' :
          notification.type === 'analysis_failed' ? 'bg-red-500/10' :
          'bg-purple-500/10'
        }`}>
          {getIcon(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {notification.title}
          </p>
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {notification.message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <ChevronRight size={16} className="text-gray-500" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Progress bar for auto-dismiss */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800 rounded-b-xl overflow-hidden">
        <div 
          className={`h-full ${
            notification.type === 'analysis_complete' ? 'bg-green-500' :
            notification.type === 'analysis_failed' ? 'bg-red-500' :
            'bg-purple-500'
          }`}
          style={{
            animation: `shrink ${autoHideDuration}ms linear forwards`,
          }}
        />
      </div>

      {/* CSS for progress bar animation */}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default NotificationToast;

