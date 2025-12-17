import React, { useState, useMemo } from 'react';
import { SocialPost } from '../types';
import { X, Wand2, Loader2, Film, Sparkles, Play, Image as ImageIcon } from 'lucide-react';
import VideoPlayer from './VideoPlayer';

interface EditorProps {
  post: SocialPost;
  onSave: (instruction: string) => void; // Passes instruction to AI for text refinement
  onAnimate: (instruction: string) => void; // Triggers video generation
  onClose: () => void;
  isUpdating: boolean;
  isAnimating?: boolean;
}

// Animation-related keywords to detect
const ANIMATION_KEYWORDS = [
  'animate', 'animation', 'video', 'motion', 'move', 'moving',
  'reel', 'reels', 'tiktok', 'clip', 'dynamic', 'cinematic',
  'bring to life', 'make it move', 'add motion', 'pan', 'zoom',
  'transition', 'loop', 'looping', 'gif', 'animated'
];

const detectAnimationRequest = (text: string): boolean => {
  const lower = text.toLowerCase();
  return ANIMATION_KEYWORDS.some(keyword => lower.includes(keyword));
};

const Editor: React.FC<EditorProps> = ({ 
  post, 
  onSave, 
  onAnimate,
  onClose, 
  isUpdating,
  isAnimating = false
}) => {
  const [instruction, setInstruction] = useState('');
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [previewMode, setPreviewMode] = useState<'image' | 'video'>('image');

  // Detect if user is requesting animation
  const isAnimationRequest = useMemo(() => {
    return detectAnimationRequest(instruction);
  }, [instruction]);

  // Check if video already exists or is generating
  const hasVideo = post.videoUrl && post.videoStatus === 'ready';
  const isVideoGenerating = post.videoStatus === 'generating' || isAnimating;
  
  // Check if this is a video-only asset (no image)
  const isVideoOnly = post.videoUrl && !post.imageUrl;

  const handleSubmit = () => {
    if (isAnimationRequest) {
      onAnimate(instruction);
    } else {
      onSave(instruction);
    }
  };

  // Quick animate button - uses user's instruction if provided, otherwise default
  const handleQuickAnimate = () => {
    // If user has typed motion instructions, use those
    // Otherwise use a sensible default
    const motionInstruction = instruction.trim() || 'Subtle cinematic motion with gentle camera movement';
    onAnimate(motionInstruction);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 w-full max-w-lg rounded-2xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <h3 className="text-lg font-semibold text-white">Refine Content</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {/* Media Preview Section */}
          {(post.imageUrl || post.videoUrl) && (
            <div className="mb-4">
              {/* Toggle Tabs if both image and video exist */}
              {post.imageUrl && hasVideo && (
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setPreviewMode('image')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      previewMode === 'image' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <ImageIcon size={14} />
                    Image
                  </button>
                  <button
                    onClick={() => setPreviewMode('video')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      previewMode === 'video' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Play size={14} />
                    Video
                  </button>
                </div>
              )}

              {/* Image Preview */}
              {((previewMode === 'image' && post.imageUrl) || (isVideoOnly && !hasVideo)) && post.imageUrl && (
                <div className="relative rounded-xl overflow-hidden border border-gray-700">
                  <img 
                    src={post.imageUrl} 
                    alt="Post preview" 
                    className="w-full h-40 object-cover"
                  />
                  {/* Video Status Badge */}
                  {hasVideo && (
                    <button 
                      onClick={() => setPreviewMode('video')}
                      className="absolute top-2 right-2 bg-green-500/90 hover:bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium cursor-pointer transition-colors"
                    >
                      <Play size={12} />
                      Watch Video
                    </button>
                  )}
                  {isVideoGenerating && (
                    <div className="absolute top-2 right-2 bg-indigo-500/90 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium animate-pulse">
                      <Loader2 size={12} className="animate-spin" />
                      Creating Video...
                    </div>
                  )}
                  {post.videoStatus === 'failed' && (
                    <div className="absolute top-2 right-2 bg-red-500/90 text-white text-xs px-2 py-1 rounded-full font-medium">
                      Video Failed
                    </div>
                  )}
                </div>
              )}

              {/* Video Preview/Player */}
              {((previewMode === 'video' && hasVideo) || isVideoOnly) && post.videoUrl && (
                <div className="rounded-xl overflow-hidden border border-gray-700">
                  <VideoPlayer 
                    videoUrl={post.videoUrl}
                    posterImage={post.imageUrl}
                    className="w-full aspect-[9/16] max-h-64"
                  />
                </div>
              )}

              {/* Video generating state for video-only assets */}
              {isVideoOnly && isVideoGenerating && (
                <div className="rounded-xl border border-gray-700 bg-gray-800 h-40 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={24} className="text-indigo-400 animate-spin" />
                    <span className="text-gray-400 text-sm">Creating video...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Animate Button - only for image assets without video */}
          {!hasVideo && !isVideoGenerating && post.imageUrl && !isVideoOnly && (
            <button
              onClick={handleQuickAnimate}
              disabled={isUpdating}
              className="w-full mb-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50"
            >
              <Film size={18} />
              <span>Quick Animate This Image</span>
              <Sparkles size={14} className="opacity-70" />
            </button>
          )}

          {/* Current Caption Display */}
          <div className="bg-black/50 p-4 rounded-xl border border-gray-800 mb-6">
            <p className="text-sm text-gray-500 mb-2 uppercase tracking-wider font-bold text-[10px]">Current Caption</p>
            <p className="text-gray-300 text-sm whitespace-pre-wrap">{post.caption}</p>
            <div className="mt-3 flex flex-wrap gap-2">
               {post.hashtags.map((h, i) => <span key={i} className="text-indigo-400 text-xs">{h}</span>)}
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-white">
              What should AI change?
            </label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-32"
              placeholder="e.g., Make it funnier, animate the image with a slow zoom, add motion to the scene..."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            
            {/* Animation Detection Hint */}
            {isAnimationRequest && (
              <div className="flex items-center gap-2 text-purple-400 text-sm bg-purple-500/10 p-3 rounded-lg border border-purple-500/30 animate-fadeIn">
                <Film size={16} />
                <span>Animation detected! This will create a video version of your image.</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-800 bg-gray-900 space-y-2">
          {/* Main Action Button - Changes based on intent */}
          <button
            onClick={handleSubmit}
            disabled={!instruction || isUpdating || isAnimating}
            className={`w-full py-3 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
              isAnimationRequest 
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500' 
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {isUpdating || isAnimating ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                {isAnimating ? 'Creating Animation...' : 'Regenerating...'}
              </>
            ) : isAnimationRequest ? (
              <>
                <Film size={18} />
                Create Animated Video
              </>
            ) : (
              <>
                <Wand2 size={18} />
                Apply AI Magic
              </>
            )}
          </button>

          {/* Fullscreen Video Button if available */}
          {hasVideo && post.videoUrl && (
            <button
              onClick={() => setShowVideoPlayer(true)}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Play size={18} />
              Watch Video Fullscreen
            </button>
          )}
        </div>

        {/* Fullscreen Video Player Modal */}
        {showVideoPlayer && post.videoUrl && (
          <VideoPlayer 
            videoUrl={post.videoUrl}
            posterImage={post.imageUrl}
            onClose={() => setShowVideoPlayer(false)}
            isModal
            className="w-full aspect-[9/16]"
          />
        )}
      </div>
    </div>
  );
};

export default Editor;
