import React, { useState } from 'react';
import { SocialPost, BrandProfile } from '../types';
import { Download, Copy, Calendar, LayoutGrid, Sparkles, Loader2, Clock, Home, ArrowLeft } from 'lucide-react';
import CalendarView from './CalendarView';
import { autoSchedulePosts } from '../services/geminiService';
import Editor from './Editor';

interface DashboardProps {
  posts: SocialPost[];
  profile: BrandProfile;
  onUpdatePost: (post: SocialPost) => void;
  onEditPost: (post: SocialPost) => void;
  onBackToBrands?: () => void;
  onBackToSwiping?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ posts, profile, onUpdatePost, onEditPost, onBackToBrands, onBackToSwiping }) => {
  const [view, setView] = useState<'grid' | 'calendar'>('grid');
  const [isScheduling, setIsScheduling] = useState(false);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);

  const handleAutoSchedule = async () => {
    setIsScheduling(true);
    const scheduleMap = await autoSchedulePosts(posts, profile.strategy);
    
    // Update all posts with new dates
    posts.forEach(post => {
      if (scheduleMap[post.id]) {
        onUpdatePost({ ...post, scheduledDate: scheduleMap[post.id] });
      }
    });
    
    setIsScheduling(false);
    setView('calendar');
  };

  const handleManualSchedule = (e: React.ChangeEvent<HTMLInputElement>, post: SocialPost) => {
    onUpdatePost({ ...post, scheduledDate: e.target.value });
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6 md:p-12">
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          {/* Navigation buttons */}
          <div className="flex items-center gap-2 mb-3">
            {onBackToBrands && (
              <button
                onClick={onBackToBrands}
                className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors text-sm"
                title="Back to all brands"
              >
                <Home size={16} />
                <span>All Brands</span>
              </button>
            )}
            {onBackToSwiping && (
              <button
                onClick={onBackToSwiping}
                className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors text-sm"
              >
                <ArrowLeft size={16} />
                <span>Create More</span>
              </button>
            )}
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Campaign Manager</h1>
          <p className="text-gray-400">
            Managing content for <span className="text-indigo-400 font-semibold">{profile.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 bg-gray-900 p-1 rounded-xl border border-gray-800">
          <button 
            onClick={() => setView('grid')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${view === 'grid' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <LayoutGrid size={16} /> Library
          </button>
          <button 
            onClick={() => setView('calendar')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${view === 'calendar' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <Calendar size={16} /> Calendar
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        {/* Controls */}
        <div className="flex justify-end mb-6">
          <button 
            onClick={handleAutoSchedule}
            disabled={isScheduling}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-purple-900/20 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {isScheduling ? <Loader2 className="animate-spin" size={18}/> : <Sparkles size={18} />}
            {isScheduling ? 'AI is Planning...' : 'Auto-Schedule with AI'}
          </button>
        </div>

        {view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <div key={post.id} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden flex flex-col hover:border-indigo-500/50 transition-colors group">
                <div className="aspect-square bg-black relative">
                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt="Social Post" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 p-4 text-center text-xs">
                      {post.visualPrompt}
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-[10px] text-white uppercase font-bold tracking-wide backdrop-blur-md border border-white/10">
                    {post.platform}
                  </div>
                  
                  {/* Edit Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                     <button onClick={() => onEditPost(post)} className="px-4 py-2 bg-white text-black rounded-full text-sm font-bold hover:bg-gray-200">
                        Edit Content
                     </button>
                  </div>
                </div>
                
                <div className="p-5 flex-1 flex flex-col">
                  <p className="text-gray-300 text-sm mb-4 line-clamp-3 flex-grow whitespace-pre-line">
                    {post.caption}
                  </p>
                  
                  {/* Scheduling Input */}
                  <div className="mb-4 pt-4 border-t border-gray-800">
                    <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Clock size={12} /> Scheduled For
                    </label>
                    <input 
                      type="datetime-local" 
                      className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      value={post.scheduledDate ? new Date(post.scheduledDate).toISOString().slice(0, 16) : ''}
                      onChange={(e) => handleManualSchedule(e, post)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-sm flex items-center justify-center gap-2 transition-colors">
                      <Copy size={14} /> Copy
                    </button>
                    <button className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm flex items-center justify-center gap-2 transition-colors">
                      <Download size={14} /> Asset
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <CalendarView 
            posts={posts} 
            onSelectPost={(p) => {
              setSelectedPost(p);
              // Could open a mini modal here, but for now we'll just switch to grid or focus
              // Simplest is to jump to grid? Or just show a modal.
              // Let's reuse the Edit function for simplicity, or just allow edit
              onEditPost(p);
            }} 
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;