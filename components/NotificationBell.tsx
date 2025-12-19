import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCircle2, AlertCircle, Film, ChevronRight } from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationBellProps {
  notifications: AppNotification[];
  onNotificationClick: (notification: AppNotification) => void;
  onMarkAsRead: (notificationId: string) => void;
  onClearAll: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  onNotificationClick,
  onMarkAsRead,
  onClearAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current && 
        buttonRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: AppNotification) => {
    onNotificationClick(notification);
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    setIsOpen(false);
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'analysis_complete':
        return <CheckCircle2 size={16} className="text-green-400" />;
      case 'analysis_failed':
        return <AlertCircle size={16} className="text-red-400" />;
      case 'video_ready':
        return <Film size={16} className="text-purple-400" />;
      default:
        return <Bell size={16} className="text-gray-400" />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="relative z-50">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-full bg-gray-800/80 hover:bg-gray-700 border border-gray-700 transition-all hover:scale-105"
        aria-label="Notifications"
      >
        <Bell size={20} className="text-gray-300" />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto max-h-72">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Bell size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full flex items-start gap-3 p-4 text-left hover:bg-gray-800/50 transition-colors ${
                      !notification.read ? 'bg-indigo-500/5' : ''
                    }`}
                  >
                    {/* Icon */}
                    <div className={`mt-0.5 p-2 rounded-full ${
                      notification.type === 'analysis_complete' ? 'bg-green-500/10' :
                      notification.type === 'analysis_failed' ? 'bg-red-500/10' :
                      'bg-purple-500/10'
                    }`}>
                      {getIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        notification.read ? 'text-gray-300' : 'text-white'
                      }`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>

                    {/* Unread Indicator */}
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                    )}

                    <ChevronRight size={14} className="text-gray-600 mt-1.5 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

