import React, { useState } from 'react';
import { X, Calendar, Clock, Check } from 'lucide-react';
import { SocialPost } from '../types';

interface ScheduleDialogProps {
  post: SocialPost;
  onSchedule: (postId: string, scheduledDate: string) => void;
  onClose: () => void;
}

const ScheduleDialog: React.FC<ScheduleDialogProps> = ({ post, onSchedule, onClose }) => {
  // Default to tomorrow at 10:00 AM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  
  const [selectedDate, setSelectedDate] = useState(tomorrow.toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState('10:00');
  
  // Generate time slots in 30-minute intervals
  const timeSlots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute of [0, 30]) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      timeSlots.push(`${h}:${m}`);
    }
  }
  
  const handleSchedule = () => {
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledDate = new Date(selectedDate);
    scheduledDate.setHours(hours, minutes, 0, 0);
    
    onSchedule(post.id, scheduledDate.toISOString());
    onClose();
  };
  
  // Format time for display
  const formatTimeDisplay = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-gray-900 w-full max-w-sm rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="text-indigo-400" size={18} />
            <h3 className="text-white font-bold">Schedule Post</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>
        
        {/* Post Preview */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            {post.imageUrl ? (
              <img 
                src={post.imageUrl} 
                alt="Post preview" 
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center">
                <Calendar className="text-gray-600" size={24} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-indigo-400 font-medium mb-1">
                {post.platform}
              </div>
              <p className="text-gray-300 text-sm line-clamp-2">
                {post.caption.substring(0, 80)}...
              </p>
            </div>
          </div>
        </div>
        
        {/* Date Selection */}
        <div className="p-4 space-y-4">
          {/* Date Picker */}
          <div>
            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
              <Calendar size={14} />
              Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          
          {/* Time Picker */}
          <div>
            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
              <Clock size={14} />
              Select Time
            </label>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
            >
              {timeSlots.map(time => (
                <option key={time} value={time}>
                  {formatTimeDisplay(time)}
                </option>
              ))}
            </select>
          </div>
          
          {/* Quick Time Buttons */}
          <div>
            <label className="block text-sm text-gray-500 mb-2">Quick Select</label>
            <div className="flex flex-wrap gap-2">
              {['09:00', '12:00', '15:00', '18:00', '20:00'].map(time => (
                <button
                  key={time}
                  onClick={() => setSelectedTime(time)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedTime === time 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {formatTimeDisplay(time)}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="p-4 border-t border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Check size={16} />
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleDialog;

