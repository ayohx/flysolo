import React from 'react';
import { SocialPost, BrandProfile } from '../types';
import { ArrowLeft, Layers, Calendar as CalendarIcon, Home } from 'lucide-react';
import CalendarView from './CalendarView';

interface CalendarPageProps {
  posts: SocialPost[];
  profile: BrandProfile;
  onBack: () => void;
  onSelectPost: (post: SocialPost) => void;
  onReschedulePost?: (postId: string, newDate: string) => void;
  onBackToBrands?: () => void;
}

const CalendarPage: React.FC<CalendarPageProps> = ({ 
  posts, 
  profile, 
  onBack, 
  onSelectPost,
  onReschedulePost,
  onBackToBrands,
}) => {
  // Only show posts with scheduled dates
  const scheduledPosts = posts.filter(p => p.scheduledDate);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header - Always Visible */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-xl border-b border-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            {onBackToBrands && (
              <button
                onClick={onBackToBrands}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl transition-colors"
                title="Back to all brands"
              >
                <Home size={16} />
              </button>
            )}
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors font-medium"
            >
              <ArrowLeft size={18} />
              <span className="hidden sm:inline">Back to Assets</span>
              <Layers size={16} className="sm:hidden" />
            </button>
          </div>

          {/* Title */}
          <div className="flex items-center gap-3">
            <CalendarIcon className="text-indigo-400" size={24} />
            <div className="text-center">
              <h1 className="text-lg font-bold text-white">Content Calendar</h1>
              <p className="text-xs text-gray-400 hidden sm:block">{profile.name}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg">
            <span className="text-indigo-400 font-bold">{scheduledPosts.length}</span>
            <span className="text-gray-400 text-sm hidden sm:inline">scheduled</span>
          </div>
        </div>
      </header>

      {/* Calendar Content */}
      <main className="max-w-7xl mx-auto p-4 lg:p-8">
        {scheduledPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6">
              <CalendarIcon className="text-gray-600" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No Scheduled Content</h2>
            <p className="text-gray-400 mb-6 max-w-md">
              Like some content and schedule it to see it appear on your calendar.
            </p>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
            >
              Browse Content
            </button>
          </div>
        ) : (
          <CalendarView posts={scheduledPosts} onSelectPost={onSelectPost} onReschedulePost={onReschedulePost} />
        )}
      </main>
    </div>
  );
};

export default CalendarPage;

