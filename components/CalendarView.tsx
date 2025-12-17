import React, { useState, useMemo } from 'react';
import { SocialPost } from '../types';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Film, GripVertical, Calendar, Clock, LayoutGrid, List, Columns } from 'lucide-react';

type ViewMode = 'daily' | 'weekly' | 'monthly';

interface CalendarViewProps {
  posts: SocialPost[];
  onSelectPost: (post: SocialPost) => void;
  onReschedulePost?: (postId: string, newDate: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ posts, onSelectPost, onReschedulePost }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [draggedPost, setDraggedPost] = useState<SocialPost | null>(null);

  // Navigation helpers
  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Navigation
  const navigate = (direction: number) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'monthly') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (viewMode === 'weekly') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else {
      newDate.setDate(newDate.getDate() + direction);
    }
    setCurrentDate(newDate);
  };

  // Get scheduled posts count
  const scheduledCount = posts.filter(p => p.scheduledDate).length;

  // Generate 30-minute time slots for daily view
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute of [0, 30]) {
        const h = hour.toString().padStart(2, '0');
        const m = minute.toString().padStart(2, '0');
        slots.push(`${h}:${m}`);
      }
    }
    return slots;
  }, []);

  // Get posts for a specific date
  const getPostsForDate = (date: Date) => {
    return posts.filter(post => {
      if (!post.scheduledDate) return false;
      const postDate = new Date(post.scheduledDate);
      return postDate.toDateString() === date.toDateString();
    }).sort((a, b) => {
      const aTime = new Date(a.scheduledDate!).getTime();
      const bTime = new Date(b.scheduledDate!).getTime();
      return aTime - bTime;
    });
  };

  // Get posts for a specific time slot on a date
  const getPostsForTimeSlot = (date: Date, timeSlot: string) => {
    const [hour, minute] = timeSlot.split(':').map(Number);
    return posts.filter(post => {
      if (!post.scheduledDate) return false;
      const postDate = new Date(post.scheduledDate);
      return postDate.toDateString() === date.toDateString() &&
             postDate.getHours() === hour &&
             postDate.getMinutes() >= minute &&
             postDate.getMinutes() < minute + 30;
    });
  };

  // Handle drag start
  const handleDragStart = (post: SocialPost, e: React.DragEvent) => {
    setDraggedPost(post);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drop on a date (monthly view)
  const handleDropOnDate = (date: Date, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedPost || !onReschedulePost) return;
    
    // Keep the original time, just change the date
    const originalDate = draggedPost.scheduledDate ? new Date(draggedPost.scheduledDate) : new Date();
    const newDate = new Date(date);
    newDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);
    
    // If dropping on a day with existing posts, append to end of day (18:00 default)
    const existingPosts = getPostsForDate(date);
    if (existingPosts.length > 0 && !draggedPost.scheduledDate) {
      const lastPost = existingPosts[existingPosts.length - 1];
      const lastTime = new Date(lastPost.scheduledDate!);
      newDate.setHours(lastTime.getHours(), lastTime.getMinutes() + 30, 0, 0);
    }
    
    onReschedulePost(draggedPost.id, newDate.toISOString());
    setDraggedPost(null);
  };

  // Handle drop on a time slot (daily view)
  const handleDropOnTimeSlot = (date: Date, timeSlot: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedPost || !onReschedulePost) return;
    
    const [hour, minute] = timeSlot.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hour, minute, 0, 0);
    
    onReschedulePost(draggedPost.id, newDate.toISOString());
    setDraggedPost(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatTimeSlot = (slot: string) => {
    const [h, m] = slot.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
  };

  // Post card component
  const PostCard: React.FC<{ post: SocialPost; compact?: boolean; showTime?: boolean }> = ({ post, compact = false, showTime = true }) => (
    <div
      draggable={!!onReschedulePost}
      onDragStart={(e) => handleDragStart(post, e)}
      onClick={() => onSelectPost(post)}
      className={`group bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 hover:border-indigo-500 transition-all cursor-pointer ${
        compact ? 'p-1.5' : 'p-2'
      } ${onReschedulePost ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-center gap-2">
        {onReschedulePost && (
          <GripVertical size={12} className="text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
        )}
        {post.imageUrl ? (
          <img 
            src={post.imageUrl} 
            className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} rounded object-cover flex-shrink-0`} 
            alt="" 
          />
        ) : (
          <div className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} bg-gray-700 rounded flex-shrink-0 flex items-center justify-center`}>
            {post.videoStatus ? <Film size={compact ? 10 : 12} className="text-gray-500" /> : <ImageIcon size={compact ? 10 : 12} className="text-gray-500" />}
          </div>
        )}
        <div className="overflow-hidden flex-1 min-w-0">
          {showTime && post.scheduledDate && (
            <div className="text-[10px] text-indigo-400 font-mono leading-none mb-0.5">
              {formatTime(new Date(post.scheduledDate))}
            </div>
          )}
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-white truncate`}>
            {post.platform}
          </div>
        </div>
      </div>
    </div>
  );

  // Monthly view
  const renderMonthlyView = () => {
    const days = [];
    const totalDays = daysInMonth(currentDate);
    const startDay = firstDayOfMonth(currentDate);

    // Padding for previous month
    for (let i = 0; i < startDay; i++) {
      days.push(
        <div key={`pad-${i}`} className="min-h-[100px] bg-gray-900/50 border border-gray-800/50" />
      );
    }

    // Days of the month
    for (let i = 1; i <= totalDays; i++) {
      const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
      const dayPosts = getPostsForDate(dayDate);
      const isToday = new Date().toDateString() === dayDate.toDateString();

      days.push(
        <div 
          key={i} 
          className={`min-h-[100px] bg-gray-900 border border-gray-800 p-2 relative group hover:bg-gray-800/50 transition-colors ${
            isToday ? 'bg-indigo-900/10 border-indigo-500/30' : ''
          } ${draggedPost ? 'hover:border-indigo-500 hover:bg-indigo-900/20' : ''}`}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDropOnDate(dayDate, e)}
        >
          <div className={`text-sm font-medium mb-2 ${isToday ? 'text-indigo-400' : 'text-gray-500'}`}>
            {i}
          </div>
          
          <div className="space-y-1">
            {dayPosts.slice(0, 3).map(post => (
              <PostCard key={post.id} post={post} compact />
            ))}
            {dayPosts.length > 3 && (
              <div className="text-xs text-gray-500 text-center">
                +{dayPosts.length - 3} more
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-7 text-center py-2 bg-gray-900 border-b border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
        </div>
        <div className="grid grid-cols-7 bg-gray-950">
          {days}
        </div>
      </>
    );
  };

  // Weekly view
  const renderWeeklyView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + i);
      const dayPosts = getPostsForDate(dayDate);
      const isToday = new Date().toDateString() === dayDate.toDateString();

      days.push(
        <div 
          key={i}
          className={`min-h-[200px] bg-gray-900 border border-gray-800 p-3 ${
            isToday ? 'bg-indigo-900/10 border-indigo-500/30' : ''
          } ${draggedPost ? 'hover:border-indigo-500 hover:bg-indigo-900/20' : ''}`}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDropOnDate(dayDate, e)}
        >
          <div className={`text-sm font-medium mb-3 ${isToday ? 'text-indigo-400' : 'text-gray-400'}`}>
            <span className="text-lg">{dayDate.getDate()}</span>
            <span className="ml-2 text-xs uppercase">{dayNames[i].substring(0, 3)}</span>
          </div>
          
          <div className="space-y-2">
            {dayPosts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 bg-gray-950">
        {days}
      </div>
    );
  };

  // Daily view with 30-minute slots
  const renderDailyView = () => {
    const dayPosts = getPostsForDate(currentDate);
    const isToday = new Date().toDateString() === currentDate.toDateString();

    return (
      <div className="bg-gray-950 max-h-[500px] overflow-y-auto custom-scrollbar">
        <div className={`p-4 border-b border-gray-800 sticky top-0 bg-gray-900/95 backdrop-blur-sm z-10 ${
          isToday ? 'border-l-4 border-l-indigo-500' : ''
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-white">{currentDate.getDate()}</div>
              <div className="text-gray-400">{dayNames[currentDate.getDay()]}, {monthNames[currentDate.getMonth()]}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">{dayPosts.length} posts scheduled</div>
            </div>
          </div>
        </div>
        
        <div className="divide-y divide-gray-800">
          {timeSlots.filter((_, i) => i % 2 === 0 || getPostsForTimeSlot(currentDate, timeSlots[i]).length > 0).map(slot => {
            const slotPosts = getPostsForTimeSlot(currentDate, slot);
            const [hour] = slot.split(':').map(Number);
            const isWorkingHour = hour >= 9 && hour <= 18;
            
            return (
              <div 
                key={slot}
                className={`flex ${isWorkingHour ? 'bg-gray-900' : 'bg-gray-900/50'} ${
                  draggedPost ? 'hover:bg-indigo-900/20' : ''
                }`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnTimeSlot(currentDate, slot, e)}
              >
                <div className="w-20 flex-shrink-0 p-3 text-right border-r border-gray-800">
                  <span className={`text-sm font-mono ${isWorkingHour ? 'text-gray-400' : 'text-gray-600'}`}>
                    {formatTimeSlot(slot)}
                  </span>
                </div>
                <div className="flex-1 p-2 min-h-[50px]">
                  {slotPosts.length > 0 ? (
                    <div className="space-y-2">
                      {slotPosts.map(post => (
                        <PostCard key={post.id} post={post} showTime={false} />
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-700 text-xs">
                      {draggedPost && 'Drop here'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getHeaderTitle = () => {
    if (viewMode === 'monthly') {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (viewMode === 'weekly') {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return `${startOfWeek.getDate()} - ${endOfWeek.getDate()} ${monthNames[endOfWeek.getMonth()]}`;
    } else {
      return `${dayNames[currentDate.getDay()]}, ${currentDate.getDate()} ${monthNames[currentDate.getMonth()]}`;
    }
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-white">
            {getHeaderTitle()}
          </h2>
          <div className="flex gap-1">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => navigate(1)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        
        {/* View Mode Toggles */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 mr-2">View:</span>
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'daily' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <List size={14} />
              Daily
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'weekly' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Columns size={14} />
              Weekly
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'monthly' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <LayoutGrid size={14} />
              Monthly
            </button>
          </div>
        </div>
      </div>
      
      {/* Stats Bar */}
      <div className="px-4 py-2 bg-gray-900/30 border-b border-gray-800 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Calendar size={12} />
          <span>{scheduledCount} scheduled</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-500">
          <Clock size={12} />
          <span>{posts.length - scheduledCount} unscheduled</span>
        </div>
        {onReschedulePost && (
          <div className="text-gray-600 ml-auto">
            <GripVertical size={12} className="inline mr-1" />
            Drag to reschedule
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      {viewMode === 'monthly' && renderMonthlyView()}
      {viewMode === 'weekly' && renderWeeklyView()}
      {viewMode === 'daily' && renderDailyView()}
    </div>
  );
};

export default CalendarView;
