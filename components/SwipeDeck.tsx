import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SocialPost, BrandProfile } from '../types';
import { X, Check, Edit2, RefreshCw, PlusCircle, Layers, ImageIcon, Menu, ChevronLeft, Film, Play, Loader2, Calendar } from 'lucide-react';
import BrandInfoCard from './BrandInfoCard';
import LikedAssetsPanel from './LikedAssetsPanel';

interface SwipeDeckProps {
  posts: SocialPost[];
  brandProfile: BrandProfile;
  likedPosts: SocialPost[];
  onLike: (post: SocialPost) => void;
  onReject: (post: SocialPost) => void;
  onEdit: (post: SocialPost) => void;
  onEmpty: () => void;
  onFetchMore: () => void;
  onUpdateProfile: (p: BrandProfile) => void;
  onAddSource: (url: string) => void;
  onCustomCreate: () => void;
  onStartFresh: () => void;
  onDeletePost?: (postId: string) => void;
  onSchedulePost?: (postId: string, scheduledDate: string) => void;
  onCalendar: () => void;
  loadingImages: Set<string>;
  isMerging: boolean;
  isGeneratingMore: boolean;
}

const SwipeDeck: React.FC<SwipeDeckProps> = ({ 
    posts, brandProfile, likedPosts, onLike, onReject, onEdit, onEmpty, onFetchMore, 
    onUpdateProfile, onAddSource, onCustomCreate, onStartFresh, onDeletePost, onSchedulePost, onCalendar, loadingImages, isMerging, isGeneratingMore 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [likedPanelOpen, setLikedPanelOpen] = useState(false);
  const [prevRemaining, setPrevRemaining] = useState(0);
  
  // Mobile sidebar state
  const [showBrandSidebar, setShowBrandSidebar] = useState(false);
  
  // Drag state for swipe gesture - IMPROVED LOGIC
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHoveringCard, setIsHoveringCard] = useState(false);
  const [isHoveringImage, setIsHoveringImage] = useState(false);
  
  // Track if mouse has moved significantly
  const [hasMoved, setHasMoved] = useState(false);
  const mouseStartPos = useRef({ x: 0, y: 0 });
  const isMouseDown = useRef(false);
  const moveThreshold = 10; // Pixels - if moved less than this, it's a click
  
  const cardRef = useRef<HTMLDivElement>(null);
  const dragThreshold = 100; // Pixels to trigger swipe
  
  const remainingPosts = posts.length - currentIndex;
  const maxVisibleCards = 5;
  const isDeckEmpty = currentIndex >= posts.length;
  
  // CRITICAL FIX: Prevent swiping last card when generating
  // This completely eliminates the race condition that causes blank screens
  const isLowOnCards = remainingPosts <= 3;
  const canSwipe = !isDeckEmpty && !(isLowOnCards && isGeneratingMore);

  // Animate counter when cards are added
  useEffect(() => {
    setPrevRemaining(remainingPosts);
  }, [remainingPosts]);

  // Infinite Scroll Trigger - IMPROVED with eager loading
  useEffect(() => {
    // Trigger earlier (at 10 cards) to prevent blank screen when swiping fast
    if (remainingPosts <= 10 && !isGeneratingMore && remainingPosts > 0) {
      console.log("🔄 Low on cards, fetching more... (remaining:", remainingPosts, ")");
      onFetchMore();
    }
  }, [remainingPosts, isGeneratingMore, onFetchMore]);

  const currentPost = isDeckEmpty ? undefined : posts[currentIndex];
  const isImageLoading = currentPost ? loadingImages.has(currentPost.id) : false;

  const renderDeckEmptyCard = () => {
    const showGenerating = isGeneratingMore;

    return (
      <div className="w-full h-full bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col items-center justify-center text-center p-10">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-5 border border-gray-700">
          {showGenerating ? (
            <RefreshCw className="animate-spin text-indigo-400" size={32} />
          ) : (
            <Check className="text-green-400" size={32} />
          )}
        </div>
        <h3 className="text-xl font-bold text-white mb-2">
          {showGenerating ? 'Designing new assets…' : 'No more assets to review'}
        </h3>
        <p className="text-gray-400 text-sm max-w-sm">
          {showGenerating
            ? 'We’re generating your next batch. You can still review, edit, and schedule any saved assets whilst you wait.'
            : 'Generate another batch to keep swiping, or open your saved assets to edit and schedule posts.'}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => setLikedPanelOpen(true)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors border border-gray-700"
          >
            View saved assets ({likedPosts.length})
          </button>
          <button
            onClick={onFetchMore}
            disabled={isGeneratingMore}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isGeneratingMore ? 'Generating…' : 'Generate more'}
          </button>
        </div>
      </div>
    );
  };

  // Button-based swipe (still works)
  const handleSwipe = (dir: 'left' | 'right') => {
    if (!currentPost) return;
    // CRITICAL FIX: Block swiping when we're low on cards and still generating
    // This prevents the blank screen bug completely
    if (!canSwipe) {
      console.log("❌ Swipe blocked - generating more cards (remaining:", remainingPosts, ")");
      return; // Prevent the swipe
    }
    
    setDirection(dir);
    setDragOffset({ x: 0, y: 0 });
    
    setTimeout(() => {
      if (dir === 'left') {
        onReject(currentPost);
      } else {
        onLike(currentPost);
      }
      setDirection(null);
      setCurrentIndex(prev => prev + 1);
    }, 300);
  };

  // Handle image click - separate from card drag
  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Only trigger edit if we haven't moved significantly
    if (!hasMoved && !isDragging && currentPost) {
      onEdit(currentPost);
    }
  };

  // Mouse/Touch drag handlers - IMPROVED with canSwipe guard
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    // CRITICAL FIX: Don't allow drag to start if we can't swipe
    if (!canSwipe) {
      console.log("❌ Drag blocked - generating more cards");
      return;
    }
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    mouseStartPos.current = { x: clientX, y: clientY };
    isMouseDown.current = true;
    setHasMoved(false);
    setDragStart({ x: clientX, y: clientY });
  };

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isMouseDown.current) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    // Calculate distance moved from start
    const distanceX = Math.abs(clientX - mouseStartPos.current.x);
    const distanceY = Math.abs(clientY - mouseStartPos.current.y);
    const totalDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    
    // If moved more than threshold, it's a drag not a click
    if (totalDistance > moveThreshold) {
      setHasMoved(true);
      setIsDragging(true);
      
      setDragOffset({
        x: clientX - dragStart.x,
        y: (clientY - dragStart.y) * 0.3, // Reduce vertical movement
      });
    }
  }, [dragStart]);

  const handleMouseUp = useCallback(() => {
    isMouseDown.current = false;
    
    // Check if we should swipe
    if (isDragging && hasMoved && Math.abs(dragOffset.x) > dragThreshold) {
      if (dragOffset.x > 0) {
        handleSwipe('right');
      } else {
        handleSwipe('left');
      }
    } else {
      // Animate back to center if not a full swipe
      setDragOffset({ x: 0, y: 0 });
    }
    
    // Reset drag state after a brief delay to prevent click triggering
    setTimeout(() => {
      setIsDragging(false);
      setHasMoved(false);
    }, 50);
  }, [isDragging, hasMoved, dragOffset]);

  // Global mouse/touch event listeners for dragging
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Calculate card transform based on drag
  const getActiveCardTransform = () => {
    if (direction === 'left') return 'translateX(-120%) rotate(-15deg)';
    if (direction === 'right') return 'translateX(120%) rotate(15deg)';
    
    if (isDragging && hasMoved) {
      const rotation = dragOffset.x * 0.05;
      return `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${rotation}deg)`;
    }
    
    return 'translateX(0) rotate(0)';
  };

  // Swipe indicator based on drag
  const getSwipeIndicator = () => {
    if (direction) return direction;
    if (isDragging && hasMoved) {
      if (dragOffset.x > 50) return 'right';
      if (dragOffset.x < -50) return 'left';
    }
    return null;
  };

  // Helper to render card content
  const renderCardContent = (post: SocialPost, loading: boolean, isActive: boolean = false) => (
    <>
      <div 
        className={`h-3/5 w-full bg-black relative ${isActive ? 'cursor-pointer' : ''}`}
        onMouseEnter={() => isActive && setIsHoveringImage(true)}
        onMouseLeave={() => isActive && setIsHoveringImage(false)}
        onClick={isActive ? handleImageClick : undefined}
      >
        {post.imageUrl ? (
          <img src={post.imageUrl} alt="Content" className="w-full h-full object-cover pointer-events-none" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-gray-800 to-gray-900">
            {loading ? (
              <>
                <RefreshCw className="animate-spin text-indigo-400 mb-4" size={32} />
                <p className="text-gray-400 text-sm animate-pulse">Designing visual...</p>
              </>
            ) : (
              <>
                <ImageIcon className="text-gray-600 mb-2" size={32} />
                <p className="text-gray-500 text-sm text-center italic">Image loading...</p>
              </>
            )}
          </div>
        )}
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-[10px] px-3 py-1 rounded-full border border-white/10 uppercase font-bold">
          {post.platform}
        </div>
        
        {/* Video Status Badge */}
        {post.videoStatus === 'ready' && (
          <div className="absolute top-4 right-4 bg-green-500/90 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 font-medium">
            <Play size={10} fill="white" />
            <span>Video</span>
          </div>
        )}
        {post.videoStatus === 'generating' && (
          <div className="absolute top-4 right-4 bg-indigo-500/90 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 font-medium animate-pulse">
            <Loader2 size={10} className="animate-spin" />
            <span>Creating</span>
          </div>
        )}
        {post.videoStatus === 'failed' && (
          <div className="absolute top-4 right-4 bg-red-500/90 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full font-medium">
            Video Failed
          </div>
        )}
        
        {/* Edit overlay on image hover (active card only) - only show if not dragging */}
        {isActive && isHoveringImage && !isDragging && !hasMoved && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity pointer-events-none">
            <div className="bg-gray-900/90 px-4 py-2 rounded-lg flex items-center gap-2 text-white text-sm border border-gray-700">
              <Edit2 size={16} />
              <span>Click to Edit</span>
            </div>
          </div>
        )}
      </div>
      <div className="h-2/5 p-6 flex flex-col justify-between bg-gray-900/95 backdrop-blur-sm">
        <div>
          <p className="text-white text-sm leading-relaxed line-clamp-3 opacity-90">
            {post.caption}
          </p>
        </div>
        <div className="flex justify-between items-center mt-2 pt-4 border-t border-gray-800">
          <div className="flex gap-1 flex-wrap">
            {post.hashtags.slice(0, 2).map((t, i) => <span key={i} className="text-[10px] text-indigo-400">{t}</span>)}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-600 font-mono">
            AI GENERATED
          </div>
        </div>
      </div>
    </>
  );

  // Generate background card styles for 3D stack effect
  const getCardStyle = (offset: number) => {
    const scale = 1 - (offset * 0.04);
    const translateY = offset * 12;
    const translateZ = -offset * 30;
    const opacity = 1 - (offset * 0.15);
    
    return {
      transform: `translateY(${translateY}px) translateZ(${translateZ}px) scale(${scale})`,
      opacity: Math.max(opacity, 0.3),
      zIndex: maxVisibleCards - offset,
    };
  };

  const swipeIndicator = getSwipeIndicator();

  return (
    <div className="h-full w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-4 lg:gap-8 p-4 relative">
      
      {/* Mobile Brand Sidebar Toggle */}
      <button
        onClick={() => setShowBrandSidebar(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white border border-gray-700"
      >
        <Menu size={20} />
      </button>
      
      {/* Mobile Brand Sidebar Overlay */}
      {showBrandSidebar && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setShowBrandSidebar(false)}
        />
      )}
      
      {/* LEFT COLUMN: Interactive Brand Profile */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        w-80 lg:w-1/3 h-full 
        transform transition-transform duration-300 ease-out
        ${showBrandSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        lg:block
      `}>
        {/* Mobile close button */}
        <button
          onClick={() => setShowBrandSidebar(false)}
          className="lg:hidden absolute top-4 right-4 z-10 p-1 text-gray-400 hover:text-white"
        >
          <ChevronLeft size={24} />
        </button>
        
        <BrandInfoCard 
          profile={brandProfile} 
          onUpdate={onUpdateProfile} 
          onAddSource={onAddSource} 
          isMerging={isMerging}
        />
      </div>

      {/* CENTER COLUMN: Swipe Interface */}
      <div className="flex-1 flex flex-col items-center justify-center relative pt-12 lg:pt-0" style={{ perspective: '1000px' }}>
        
        {/* Mobile Header Context */}
        <div className="lg:hidden absolute top-0 left-12 right-0 px-4 flex justify-between items-center text-xs font-mono text-gray-500 uppercase tracking-widest z-0">
          <span className="truncate max-w-[120px]">{brandProfile.name}</span>
          <span className="text-indigo-400">{remainingPosts} Left</span>
        </div>

        {/* Animated Counter Badge (Desktop) */}
        <div className="absolute top-0 right-0 hidden lg:flex flex-col items-end z-0">
          <div className={`text-6xl font-black leading-none transition-all duration-500 ${
            isGeneratingMore ? 'text-indigo-500 animate-pulse' : 
            remainingPosts <= 5 ? 'text-amber-500' : 'text-gray-800/50'
          }`}>
            {remainingPosts}
          </div>
          <div className="text-xs text-gray-600 font-mono uppercase tracking-widest">
            {isGeneratingMore ? (
              <span className="text-indigo-400 animate-pulse">Creating more...</span>
            ) : remainingPosts <= 5 ? (
              <span className="text-amber-400">Low - generating...</span>
            ) : (
              "Cards Left"
            )}
          </div>
          
          {/* Stack indicator */}
          <div className="mt-4 flex items-center gap-1">
            <Layers size={14} className="text-gray-600" />
            <span className="text-xs text-gray-600">{Math.min(remainingPosts, maxVisibleCards)} in stack</span>
          </div>
        </div>

        {/* Custom Create, Calendar & Fresh Start Buttons - Desktop */}
        <div className="absolute top-0 left-0 hidden lg:flex items-center gap-2">
          <button 
            onClick={onCustomCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white rounded-full transition-colors text-xs font-bold uppercase tracking-wider border border-gray-700/50"
          >
            <PlusCircle size={16} /> Create Custom
          </button>
          <button 
            onClick={onCalendar}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-colors text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-500/20"
          >
            <Calendar size={16} /> Calendar
          </button>
          <button 
            onClick={onStartFresh}
            className="flex items-center gap-2 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 rounded-full transition-colors text-xs font-medium border border-red-800/50"
            title="Clear saved data and start with a new brand"
          >
            <RefreshCw size={14} /> Fresh Start
          </button>
        </div>

        {/* Calendar Button - Mobile (Always Visible) */}
        <button 
          onClick={onCalendar}
          className="lg:hidden fixed top-4 right-4 z-40 p-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-500/30 border border-indigo-500"
          title="View Calendar"
        >
          <Calendar size={20} />
        </button>

        {/* 3D Stack Container */}
        <div className="relative w-full max-w-md aspect-[4/5] flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
          
          {/* Background Cards (Visual 3D Stack) */}
          {Array.from({ length: Math.min(maxVisibleCards - 1, Math.max(0, remainingPosts - 1)) }).map((_, i) => {
            const cardIndex = currentIndex + i + 1;
            if (cardIndex >= posts.length) return null;
            const post = posts[cardIndex];
            const offset = i + 1;
            
            return (
              <div 
                key={post.id}
                className="absolute w-full h-full bg-gray-800 rounded-3xl border border-gray-700 shadow-xl overflow-hidden transition-all duration-500"
                style={getCardStyle(offset)}
              >
                {i < 2 ? (
                  renderCardContent(post, loadingImages.has(post.id), false)
                ) : (
                  <div className="w-full h-full bg-gradient-to-b from-gray-800 to-gray-900">
                    <div className="w-full h-1/2 bg-gray-900/50"></div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Active Card - Draggable */}
          <div 
            ref={cardRef}
            className={`w-full h-full absolute bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-hidden select-none ${
              isDragging && hasMoved ? 'cursor-grabbing' : isHoveringCard ? 'cursor-grab' : ''
            } ${direction ? 'transition-all duration-300' : isDragging && hasMoved ? '' : 'transition-all duration-200'}`}
            style={{ 
              zIndex: maxVisibleCards + 1,
              transform: getActiveCardTransform(),
              opacity: direction ? 0 : 1,
            }}
            onMouseEnter={() => setIsHoveringCard(true)}
            onMouseLeave={() => {
              setIsHoveringCard(false);
              setIsHoveringImage(false);
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
          >
            {currentPost ? renderCardContent(currentPost, isImageLoading, true) : renderDeckEmptyCard()}
            
            {/* Edit Button (always visible in corner) */}
            {currentPost && (
              <div className="absolute bottom-6 right-6">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(currentPost);
                  }}
                  className="p-3 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors border border-gray-700 shadow-lg"
                  title="Refine Prompt"
                >
                  <Edit2 size={18} />
                </button>
              </div>
            )}

            {/* Visual Feedback Overlays */}
            {swipeIndicator === 'right' && (
              <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center z-20 pointer-events-none">
                <div className="border-4 border-green-400 rounded-full p-4 transform rotate-[-15deg]">
                  <Check className="text-green-400 w-16 h-16" strokeWidth={4} />
                </div>
              </div>
            )}
            {swipeIndicator === 'left' && (
              <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center z-20 pointer-events-none">
                <div className="border-4 border-red-400 rounded-full p-4 transform rotate-[15deg]">
                  <X className="text-red-400 w-16 h-16" strokeWidth={4} />
                </div>
              </div>
            )}
            
            {/* Drag hint on hover */}
            {isHoveringCard && !isDragging && !isHoveringImage && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-gray-900/90 px-3 py-1.5 rounded-full text-xs text-gray-400 border border-gray-700 pointer-events-none">
                Drag to swipe • Click image to edit
              </div>
            )}
          </div>

        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-4 mt-8 z-20">
          {/* Warning message when swipe is disabled */}
          {!canSwipe && (
            <div className="flex items-center gap-2 text-amber-400 text-sm animate-pulse">
              <RefreshCw size={16} className="animate-spin" />
              <span>
                {isDeckEmpty
                  ? (isGeneratingMore ? 'Generating your next batch…' : 'No more cards — generate another batch.')
                  : `Generating more cards… (${remainingPosts} left)`}
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-6">
            <button 
              onClick={() => handleSwipe('left')}
              disabled={!canSwipe}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-transform shadow-lg border border-gray-700 ${
                canSwipe 
                  ? 'bg-gray-800 hover:bg-gray-700 text-red-500 hover:scale-110' 
                  : 'bg-gray-900 text-gray-600 cursor-not-allowed opacity-50'
              }`}
            >
              <X size={28} />
            </button>
            
            <button 
              onClick={() => handleSwipe('right')}
              disabled={!canSwipe}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-transform shadow-lg ${
                canSwipe
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white hover:scale-110 shadow-indigo-500/30'
                  : 'bg-gray-900 text-gray-600 cursor-not-allowed opacity-50 border border-gray-700'
              }`}
            >
              <Check size={28} />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Liked Assets Panel (Toggleable) */}
      <LikedAssetsPanel 
        posts={likedPosts}
        isOpen={likedPanelOpen}
        onToggle={() => setLikedPanelOpen(!likedPanelOpen)}
        onSelectPost={(post) => onEdit(post)}
        onDeletePost={onDeletePost}
        onSchedulePost={onSchedulePost}
      />
    </div>
  );
};

export default SwipeDeck;
