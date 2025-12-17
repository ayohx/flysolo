import React, { useState } from 'react';
import { SocialPost } from '../types';
import { X, ChevronRight, Image as ImageIcon, Heart, Play, Film, Loader2, Trash2, CalendarPlus, Check, Pencil } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import ScheduleDialog from './ScheduleDialog';

interface LikedAssetsPanelProps {
  posts: SocialPost[];
  isOpen: boolean;
  onToggle: () => void;
  onSelectPost: (post: SocialPost) => void;
  onDeletePost?: (postId: string) => void;
  onSchedulePost?: (postId: string, scheduledDate: string) => void;
}

const LikedAssetsPanel: React.FC<LikedAssetsPanelProps> = ({ 
  posts, 
  isOpen, 
  onToggle, 
  onSelectPost,
  onDeletePost,
  onSchedulePost
}) => {
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);
  const [playingVideoPoster, setPlayingVideoPoster] = useState<string | undefined>(undefined);
  const [schedulingPost, setSchedulingPost] = useState<SocialPost | null>(null);
  
  // Count posts with videos
  const videosReady = posts.filter(p => p.videoStatus === 'ready').length;
  const videosGenerating = posts.filter(p => p.videoStatus === 'generating').length;
  
  // Check if a post is a video asset (has video URL or is generating video)
  const isVideoAsset = (post: SocialPost) => post.videoStatus === 'ready' || post.videoStatus === 'generating';
  
  // Handle video playback
  const handlePlayVideo = (post: SocialPost, e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.videoUrl) {
      setPlayingVideoUrl(post.videoUrl);
      setPlayingVideoPoster(post.imageUrl);
    }
  };
  
  // Handle delete
  const handleDelete = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeletePost) {
      onDeletePost(postId);
    }
  };

  return (
    <>
      {/* Collapsed Toggle Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-gray-900 border border-gray-700 border-r-0 rounded-l-xl p-3 hover:bg-gray-800 transition-all group shadow-xl"
        >
          <div className="flex flex-col items-center gap-2">
            <Heart className="text-pink-500" size={20} />
            <span className="text-white font-bold text-sm">{posts.length}</span>
            {videosReady > 0 && (
              <div className="flex items-center gap-1 text-green-400">
                <Film size={12} />
                <span className="text-xs">{videosReady}</span>
              </div>
            )}
            <ChevronRight className="text-gray-500 group-hover:text-white transition-colors" size={16} />
          </div>
        </button>
      )}

      {/* Expanded Panel */}
      <div className={`fixed right-0 top-0 h-full bg-gray-900/95 backdrop-blur-xl border-l border-gray-800 shadow-2xl z-30 transition-all duration-300 ${
        isOpen ? 'w-72 translate-x-0' : 'w-72 translate-x-full'
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="text-pink-500" size={18} />
            <h3 className="text-white font-bold">Saved Assets</h3>
            <span className="bg-pink-500/20 text-pink-400 text-xs px-2 py-0.5 rounded-full font-mono">
              {posts.length}
            </span>
          </div>
          <button 
            onClick={onToggle}
            className="text-gray-500 hover:text-white transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Stats */}
        {(videosReady > 0 || videosGenerating > 0) && (
          <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-4 text-xs">
            {videosReady > 0 && (
              <div className="flex items-center gap-1 text-green-400">
                <Play size={12} />
                <span>{videosReady} video{videosReady !== 1 ? 's' : ''} ready</span>
              </div>
            )}
            {videosGenerating > 0 && (
              <div className="flex items-center gap-1 text-indigo-400 animate-pulse">
                <Loader2 size={12} className="animate-spin" />
                <span>{videosGenerating} creating...</span>
              </div>
            )}
          </div>
        )}

        {/* Content Grid */}
        <div className="p-4 overflow-y-auto h-[calc(100%-60px)] custom-scrollbar">
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="text-gray-600" size={24} />
              </div>
              <p className="text-gray-500 text-sm">
                No saved assets yet
              </p>
              <p className="text-gray-600 text-xs mt-1">
                Swipe right to save content
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-gray-700 hover:border-indigo-500 transition-all hover:scale-[1.02]"
                >
                  {/* Thumbnail/Image */}
                  {post.imageUrl ? (
                    <img 
                      src={post.imageUrl} 
                      alt="Saved content" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                      {isVideoAsset(post) ? (
                        <Film className="text-gray-600" size={24} />
                      ) : (
                        <ImageIcon className="text-gray-600" size={24} />
                      )}
                    </div>
                  )}
                  
                  {/* Platform Badge */}
                  <div className="absolute top-1 left-1 bg-black/70 backdrop-blur-sm text-[8px] text-white px-1.5 py-0.5 rounded uppercase font-bold">
                    {post.platform.replace('Twitter/X', 'X')}
                  </div>
                  
                  {/* Asset Type Badge */}
                  {isVideoAsset(post) && (
                    <div className="absolute bottom-1 left-1 bg-purple-500/90 backdrop-blur-sm text-[8px] text-white px-1.5 py-0.5 rounded uppercase font-bold flex items-center gap-1">
                      <Film size={8} />
                      Video
                    </div>
                  )}
                  
                  {/* Video Status Badge */}
                  {post.videoStatus === 'ready' && (
                    <button
                      onClick={(e) => handlePlayVideo(post, e)}
                      className="absolute top-1 right-1 bg-green-500/90 hover:bg-green-500 backdrop-blur-sm text-white p-1.5 rounded-full transition-colors"
                      title="Play video"
                    >
                      <Play size={10} fill="white" />
                    </button>
                  )}
                  {post.videoStatus === 'generating' && (
                    <div className="absolute top-1 right-1 bg-indigo-500/90 backdrop-blur-sm text-white p-1.5 rounded-full animate-pulse">
                      <Loader2 size={10} className="animate-spin" />
                    </div>
                  )}
                  {post.videoStatus === 'failed' && (
                    <div className="absolute top-1 right-1 bg-red-500/90 backdrop-blur-sm text-white p-1 rounded-full">
                      <X size={10} />
                    </div>
                  )}
                  
                  {/* Scheduled Badge */}
                  {post.scheduledDate && (
                    <div className="absolute bottom-1 right-1 bg-green-500/90 backdrop-blur-sm text-[8px] text-white px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Check size={8} />
                      {new Date(post.scheduledDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  )}
                  
                  {/* Hover Overlay with Actions - Compact 2x2 Grid */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                    <div className="grid grid-cols-2 gap-1.5 w-full max-w-[90px]">
                      {/* Play button for videos - or Schedule if no video */}
                      {post.videoStatus === 'ready' && post.videoUrl ? (
                        <button
                          onClick={(e) => handlePlayVideo(post, e)}
                          className="flex flex-col items-center justify-center p-1.5 bg-green-600 hover:bg-green-500 text-white rounded-md transition-colors"
                          title="Play"
                        >
                          <Play size={14} fill="white" />
                          <span className="text-[9px] mt-0.5">Play</span>
                        </button>
                      ) : onSchedulePost ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSchedulingPost(post);
                          }}
                          className="flex flex-col items-center justify-center p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
                          title={post.scheduledDate ? 'Reschedule' : 'Schedule'}
                        >
                          <CalendarPlus size={14} />
                          <span className="text-[9px] mt-0.5">{post.scheduledDate ? 'Resched' : 'Sched'}</span>
                        </button>
                      ) : null}
                      
                      {/* Schedule/Reschedule button (when video has play) */}
                      {post.videoStatus === 'ready' && post.videoUrl && onSchedulePost && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSchedulingPost(post);
                          }}
                          className="flex flex-col items-center justify-center p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
                          title={post.scheduledDate ? 'Reschedule' : 'Schedule'}
                        >
                          <CalendarPlus size={14} />
                          <span className="text-[9px] mt-0.5">{post.scheduledDate ? 'Resched' : 'Sched'}</span>
                        </button>
                      )}
                      
                      {/* Edit button */}
                      <button
                        onClick={() => onSelectPost(post)}
                        className="flex flex-col items-center justify-center p-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} />
                        <span className="text-[9px] mt-0.5">Edit</span>
                      </button>
                      
                      {/* Delete button */}
                      {onDeletePost && (
                        <button
                          onClick={(e) => handleDelete(post.id, e)}
                          className="flex flex-col items-center justify-center p-1.5 bg-red-600/80 hover:bg-red-500 text-white rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                          <span className="text-[9px] mt-0.5">Delete</span>
                        </button>
                      )}
                    </div>
                    
                    {post.videoStatus === 'generating' && (
                      <span className="text-indigo-300 text-[10px]">Video creating...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Video Player Modal */}
      {playingVideoUrl && (
        <VideoPlayer
          videoUrl={playingVideoUrl}
          posterImage={playingVideoPoster}
          onClose={() => {
            setPlayingVideoUrl(null);
            setPlayingVideoPoster(undefined);
          }}
          isModal
          className="w-full aspect-[9/16]"
        />
      )}
      
      {/* Schedule Dialog */}
      {schedulingPost && onSchedulePost && (
        <ScheduleDialog
          post={schedulingPost}
          onSchedule={onSchedulePost}
          onClose={() => setSchedulingPost(null)}
        />
      )}
    </>
  );
};

export default LikedAssetsPanel;
