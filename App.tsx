import React, { useState, useEffect, useCallback } from 'react';
import { AppState, BrandProfile, SocialPost, AnalysisStage, PendingAnalysis, AppNotification } from './types';
import Onboarding from './components/Onboarding';
import AnalysisLoader from './components/AnalysisLoader';
import SwipeDeck from './components/SwipeDeck';
import Editor from './components/Editor';
import Dashboard from './components/Dashboard';
import CalendarPage from './components/CalendarPage';
import BrandSelector from './components/BrandSelector';
import NotificationBell from './components/NotificationBell';
import NotificationToast from './components/NotificationToast';
import { ToastContainer, useToast } from './components/Toast';
import { analyzeBrand, generateContentIdeas, generatePostImage, refinePost, mergeSourceUrl, generatePostVideo, checkVideoStatus, isApiConfigured, getMissingApiKeys, softRefreshBrand } from './services/geminiService';
import { saveBrand, saveBrandAssets, getBrandByUrl, findRelevantAsset, checkDatabaseSetup, listBrands, loadBrandWorkspace, StoredBrand, getSavedPosts } from './services/supabaseService';
import { Plus, X } from 'lucide-react';

// LocalStorage keys
const STORAGE_KEYS = {
  BRAND_PROFILE: 'flysolo_brand_profile',
  GENERATED_POSTS: 'flysolo_generated_posts',
  LIKED_POSTS: 'flysolo_liked_posts',
  APP_STATE: 'flysolo_app_state',
  PENDING_ANALYSES: 'flysolo_pending_analyses',
  NOTIFICATIONS: 'flysolo_notifications',
};

// Helper to normalise URLs for consistent tracking
const normaliseUrl = (url: string): string => {
  return url.toLowerCase().replace(/\/$/, '').replace(/^https?:\/\//, '');
};

// Helper to load from localStorage (only works client-side)
const loadFromStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.ONBOARDING);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [generatedPosts, setGeneratedPosts] = useState<SocialPost[]>([]);
  const [likedPosts, setLikedPosts] = useState<SocialPost[]>([]);
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Check if API is configured
  const apiConfigured = isApiConfigured();
  
  // Error handling state
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Restore state from localStorage on mount
  useEffect(() => {
    const savedProfile = loadFromStorage<BrandProfile | null>(STORAGE_KEYS.BRAND_PROFILE, null);
    const savedPosts = loadFromStorage<SocialPost[]>(STORAGE_KEYS.GENERATED_POSTS, []);
    const savedLiked = loadFromStorage<SocialPost[]>(STORAGE_KEYS.LIKED_POSTS, []);
    const savedState = loadFromStorage<string>(STORAGE_KEYS.APP_STATE, AppState.ONBOARDING);
    
    console.log('LocalStorage check:', { savedState, SWIPING: AppState.SWIPING, hasProfile: !!savedProfile, postCount: savedPosts.length });
    if (savedProfile && savedPosts.length > 0) {
      console.log('Restoring from localStorage:', { profile: savedProfile.name, posts: savedPosts.length, state: savedState });
      setBrandProfile(savedProfile);
      setGeneratedPosts(savedPosts);
      setLikedPosts(savedLiked);
      // Only restore SWIPING or DASHBOARD states
      if (savedState === AppState.SWIPING || savedState === AppState.DASHBOARD) {
        console.log('Setting appState to:', savedState);
        setAppState(savedState as AppState);
      } else {
        // Profile exists but state wasn't saved - go to swiping
        console.log('Defaulting to SWIPING');
        setAppState(AppState.SWIPING);
      }
    }
    setIsHydrated(true);
  }, []);
  
  // Save to localStorage when state changes
  useEffect(() => {
    if (!isHydrated) return; // Don't save during initial hydration
    if (brandProfile) {
      localStorage.setItem(STORAGE_KEYS.BRAND_PROFILE, JSON.stringify(brandProfile));
    }
  }, [brandProfile, isHydrated]);
  
  useEffect(() => {
    if (!isHydrated) return;
    if (generatedPosts.length > 0) {
      localStorage.setItem(STORAGE_KEYS.GENERATED_POSTS, JSON.stringify(generatedPosts));
    }
  }, [generatedPosts, isHydrated]);
  
  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(STORAGE_KEYS.LIKED_POSTS, JSON.stringify(likedPosts));
  }, [likedPosts, isHydrated]);
  
  useEffect(() => {
    if (!isHydrated) return;
    if (appState === AppState.SWIPING || appState === AppState.DASHBOARD) {
      localStorage.setItem(STORAGE_KEYS.APP_STATE, appState);
    }
  }, [appState, isHydrated]);
  
  // Clear all saved data and start fresh
  const handleStartFresh = () => {
    localStorage.removeItem(STORAGE_KEYS.BRAND_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.GENERATED_POSTS);
    localStorage.removeItem(STORAGE_KEYS.LIKED_POSTS);
    localStorage.removeItem(STORAGE_KEYS.APP_STATE);
    setBrandProfile(null);
    setGeneratedPosts([]);
    setLikedPosts([]);
    setAppState(AppState.ONBOARDING);
    resetAnalysisStages();
  };
  
  // New States for enhanced features
  const [isMerging, setIsMerging] = useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [customCreateMode, setCustomCreateMode] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [currentBrandId, setCurrentBrandId] = useState<string | null>(null); // Supabase brand ID
  const [allBrands, setAllBrands] = useState<StoredBrand[]>([]); // All saved brands for switcher
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Toast notifications
  const toast = useToast();
  
  // Check Supabase on mount and load brands
  useEffect(() => {
    const initApp = async () => {
      const status = await checkDatabaseSetup();
      console.log('🗄️ Supabase status:', status);
      
      // Load all brands for the selector
      const brands = await listBrands();
      setAllBrands(brands);
      
      // If we have saved brands and no local session, show brand selector
      if (brands.length > 0 && !brandProfile && appState === AppState.ONBOARDING) {
        setAppState(AppState.BRAND_SELECTOR);
      }
    };
    initApp();
  }, []);
  
  // Analysis State
  const [analysisStages, setAnalysisStages] = useState<AnalysisStage[]>([
    { label: 'Scanning website & identifying products...', status: 'waiting' },
    { label: 'Extracting brand colours & visual style...', status: 'waiting' },
    { label: 'Analysing competitor engagement...', status: 'waiting' },
    { label: 'Generating platform-optimised content...', status: 'waiting' },
  ]);

  // Editor State
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Video polling state - track operations in progress
  const [pendingVideos, setPendingVideos] = useState<Map<string, string>>(new Map()); // postId -> operationName

  // ============================================================================
  // BACKGROUND ANALYSIS & NOTIFICATION SYSTEM
  // ============================================================================
  
  // Background analyses keyed by normalised URL
  const [pendingAnalyses, setPendingAnalyses] = useState<Map<string, PendingAnalysis>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PENDING_ANALYSES);
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Map(Object.entries(parsed));
      }
    } catch {}
    return new Map();
  });
  
  // App notifications
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (saved) {
        return JSON.parse(saved).map((n: any) => ({
          ...n,
          createdAt: new Date(n.createdAt),
        }));
      }
    } catch {}
    return [];
  });
  
  // Toast notification to display
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  
  // URL currently being analyzed (for foreground mode)
  const [currentAnalysisUrl, setCurrentAnalysisUrl] = useState<string | null>(null);
  
  // Persist pending analyses to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    const obj = Object.fromEntries(pendingAnalyses);
    localStorage.setItem(STORAGE_KEYS.PENDING_ANALYSES, JSON.stringify(obj));
  }, [pendingAnalyses, isHydrated]);
  
  // Persist notifications to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications, isHydrated]);
  
  // Helper to update pending analysis status
  const updatePendingStatus = useCallback((
    url: string, 
    status: PendingAnalysis['status'], 
    extras?: Partial<PendingAnalysis>
  ) => {
    setPendingAnalyses(prev => {
      const existing = prev.get(url);
      if (!existing) return prev;
      
      const updated = new Map(prev);
      updated.set(url, {
        ...existing,
        status,
        ...(extras || {}),
        ...(status === 'complete' ? { completedAt: new Date() } : {}),
      });
      return updated;
    });
  }, []);
  
  // Add a new notification
  const addNotification = useCallback((notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: AppNotification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      read: false,
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    setActiveToast(newNotification);
  }, []);
  
  // Mark notification as read
  const handleMarkNotificationAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);
  
  // Clear all notifications
  const handleClearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);
  
  // Handle notification click - navigate to the brand
  const handleNotificationClick = useCallback(async (notification: AppNotification) => {
    if (notification.brandUrl) {
      const pending = pendingAnalyses.get(notification.brandUrl);
      
      if (pending?.status === 'complete' && pending.profile && pending.posts) {
        // Load the completed analysis
        setBrandProfile(pending.profile);
        setGeneratedPosts(pending.posts);
        setLikedPosts([]);
        
        // Start image generation
        startImageGeneration(pending.posts.slice(0, 5), pending.profile);
        
        // Save to Supabase
        const fullUrl = notification.brandUrl.startsWith('http') 
          ? notification.brandUrl 
          : `https://${notification.brandUrl}`;
        saveBrand(fullUrl, pending.profile).then(async (storedBrand) => {
          if (storedBrand) {
            setCurrentBrandId(storedBrand.id);
            // Refresh brands list
            const brands = await listBrands();
            setAllBrands(brands);
          }
        });
        
        // Remove from pending analyses
        setPendingAnalyses(prev => {
          const updated = new Map(prev);
          updated.delete(notification.brandUrl!);
          return updated;
        });
        
        setAppState(AppState.SWIPING);
      } else {
        // Try to find brand in allBrands by URL
        const brand = allBrands.find(b => normaliseUrl(b.url) === notification.brandUrl);
        if (brand) {
          await handleSelectBrand(brand);
        }
      }
    }
    
    // Mark as read
    handleMarkNotificationAsRead(notification.id);
  }, [pendingAnalyses, allBrands]);
  
  // Run analysis in background (non-blocking)
  const runAnalysisInBackground = useCallback(async (url: string) => {
    const normalisedUrl = normaliseUrl(url);
    
    try {
      // Update to 'analysing' status (AMBER)
      updatePendingStatus(normalisedUrl, 'analysing');
      
      // 1. Analyse Brand
      const profile = await analyzeBrand(url);
      
      // Update with brand name once known
      updatePendingStatus(normalisedUrl, 'analysing', { brandName: profile.name });
      
      // 2. Generate Content Ideas
      const posts = await generateContentIdeas(profile, 10);
      
      // Complete! Update to 'complete' status (GREEN)
      updatePendingStatus(normalisedUrl, 'complete', { profile, posts });
      
      // Create notification
      addNotification({
        type: 'analysis_complete',
        title: `${profile.name} is ready!`,
        message: 'Tap to view your brand DNA and content ideas.',
        brandUrl: normalisedUrl,
      });
      
      // Save to Supabase in background
      saveBrand(url, profile).then(async (storedBrand) => {
        if (storedBrand) {
          console.log('✅ Background brand saved to Supabase:', storedBrand.id);
          
          // Save discovered image assets
          if (profile.imageAssets && profile.imageAssets.length > 0) {
            const assetCount = await saveBrandAssets(storedBrand.id, profile.imageAssets);
            console.log(`✅ Saved ${assetCount} image assets to Supabase`);
          }
          
          // Refresh brands list
          const brands = await listBrands();
          setAllBrands(brands);
        }
      }).catch(err => console.warn('Supabase save failed (non-critical):', err));
      
    } catch (error: any) {
      console.error('Background analysis failed:', error);
      
      // Error! Update to 'error' status (RED)
      updatePendingStatus(normalisedUrl, 'error', { 
        error: error.message || 'Analysis failed' 
      });
      
      addNotification({
        type: 'analysis_failed',
        title: 'Analysis failed',
        message: error.message || 'Could not analyse brand.',
        brandUrl: normalisedUrl,
      });
    }
  }, [updatePendingStatus, addNotification]);
  
  // Start background analysis
  const startBackgroundAnalysis = useCallback((url: string) => {
    const normalisedUrl = normaliseUrl(url);
    const analysisId = crypto.randomUUID();
    
    // Add to pending queue with 'starting' status (RED)
    setPendingAnalyses(prev => new Map(prev).set(normalisedUrl, {
      id: analysisId,
      url: normalisedUrl,
      status: 'starting',
      progress: 0,
      startedAt: new Date(),
    }));
    
    // Run analysis in background (non-blocking)
    runAnalysisInBackground(url);
    
    // Navigate user to brand selector
    setAppState(AppState.BRAND_SELECTOR);
  }, [runAnalysisInBackground]);
  
  // Handle continuing analysis in background (called from AnalysisLoader)
  const handleContinueInBackground = useCallback(() => {
    if (currentAnalysisUrl) {
      // The analysis is already running in handleStartAnalysis
      // We just need to add it to pendingAnalyses and navigate away
      const normalisedUrl = normaliseUrl(currentAnalysisUrl);
      
      // Add to pending with 'analysing' status since it's already started
      setPendingAnalyses(prev => new Map(prev).set(normalisedUrl, {
        id: crypto.randomUUID(),
        url: normalisedUrl,
        status: 'analysing',
        progress: 25, // Approximate progress
        startedAt: new Date(),
      }));
      
      // Navigate to brand selector
      setAppState(AppState.BRAND_SELECTOR);
    }
  }, [currentAnalysisUrl]);

  // Reset analysis stages when returning to onboarding
  const resetAnalysisStages = () => {
    setAnalysisStages([
      { label: 'Scanning website & identifying products...', status: 'waiting' },
      { label: 'Extracting brand colours & visual style...', status: 'waiting' },
      { label: 'Analysing competitor engagement...', status: 'waiting' },
      { label: 'Generating platform-optimised content...', status: 'waiting' },
    ]);
  };

  // Handlers
  const handleStartAnalysis = async (url: string) => {
    setAnalysisError(null);
    resetAnalysisStages();
    setAppState(AppState.ANALYZING);
    setCurrentAnalysisUrl(url); // Track for background mode
    
    const normalisedUrl = normaliseUrl(url);
    
    // Simulate progressive loading steps for UX while API works
    const updateStage = (index: number, status: 'loading' | 'done' | 'error') => {
      setAnalysisStages(prev => prev.map((s, i) => i === index ? { ...s, status } : s));
    };

    updateStage(0, 'loading');

    try {
      // 1. Analyse Brand
      const profile = await analyzeBrand(url);
      
      // Check if user moved to background mode
      // If so, the pending analysis will be updated there
      
      updateStage(0, 'done');
      updateStage(1, 'loading');
      setBrandProfile(profile);

      // Artificial delay to make it feel like "deep thinking" if API is too fast
      await new Promise(r => setTimeout(r, 800));
      updateStage(1, 'done');
      updateStage(2, 'loading');

      // 2. Generate Content Ideas (Text only first)
      const posts = await generateContentIdeas(profile, 10); // Generate 10 cards
      setGeneratedPosts(posts);
      updateStage(2, 'done');
      updateStage(3, 'loading');
      
      await new Promise(r => setTimeout(r, 800));
      updateStage(3, 'done');

      // 4. Save to Supabase (non-blocking)
      saveBrand(url, profile).then(async (storedBrand) => {
        if (storedBrand) {
          setCurrentBrandId(storedBrand.id);
          console.log('✅ Brand saved to Supabase:', storedBrand.id);
          
          // Save discovered image assets
          if (profile.imageAssets && profile.imageAssets.length > 0) {
            const assetCount = await saveBrandAssets(storedBrand.id, profile.imageAssets);
            console.log(`✅ Saved ${assetCount} image assets to Supabase`);
          }
          
          // Refresh brands list
          const brands = await listBrands();
          setAllBrands(brands);
        }
      }).catch(err => console.warn('Supabase save failed (non-critical):', err));

      // 5. Start Image Generation in Background for the first few posts
      // Generate images for first 5 posts immediately to ensure smooth experience
      startImageGeneration(posts.slice(0, 5), profile);

      // Clear current analysis URL
      setCurrentAnalysisUrl(null);
      
      // If there was a pending analysis for this URL, complete it
      if (pendingAnalyses.has(normalisedUrl)) {
        updatePendingStatus(normalisedUrl, 'complete', { profile, posts });
      }

      setAppState(AppState.SWIPING);
      
    } catch (error: any) {
      console.error("Analysis failed:", error);
      
      // Mark stages as error
      setAnalysisStages(prev => prev.map(s => 
        s.status === 'loading' ? { ...s, status: 'error' } : s
      ));
      
      // Update pending analysis if it exists
      if (pendingAnalyses.has(normalisedUrl)) {
        updatePendingStatus(normalisedUrl, 'error', { 
          error: error.message || 'Analysis failed' 
        });
      }
      
      // Set error message and return to onboarding after delay
      setAnalysisError(error.message || "Analysis failed. Please try again.");
      setCurrentAnalysisUrl(null);
      
      setTimeout(() => {
        setAppState(AppState.ONBOARDING);
      }, 2000);
    }
  };

  const startImageGeneration = async (postsToGen: SocialPost[], profile: BrandProfile, overrideBrandId?: string | null) => {
    const MAX_RETRIES = 3;
    // Use override brandId if provided, otherwise fall back to state (may be stale during brand switch)
    const activeBrandId = overrideBrandId !== undefined ? overrideBrandId : currentBrandId;
    
    postsToGen.forEach(async (post) => {
      if (post.imageUrl || loadingImages.has(post.id)) return;

      setLoadingImages(prev => new Set(prev).add(post.id));
      
      let b64Image: string | undefined;
      let retries = 0;
      
      // PRIORITY 1: Check Supabase for real product images
      if (activeBrandId) {
        try {
          // Extract product name from caption/visual prompt for matching
          const searchTerm = post.caption.split(' ').slice(0, 5).join(' ');
          const realAsset = await findRelevantAsset(activeBrandId, searchTerm);
          
          if (realAsset && realAsset.url) {
            console.log(`🎯 Using REAL product image for post ${post.id}:`, realAsset.label);
            b64Image = realAsset.url;
          }
        } catch (e) {
          console.warn('Asset lookup failed, falling back to AI:', e);
        }
      }
      
      // PRIORITY 2: Generate with AI if no real image found
      if (!b64Image) {
        while (!b64Image && retries < MAX_RETRIES) {
          try {
            b64Image = await generatePostImage(post.visualPrompt, profile);
            
            // Validate image URL is not empty/undefined
            if (!b64Image || b64Image === 'undefined') {
              b64Image = undefined;
              retries++;
              console.log(`Image generation attempt ${retries} failed for post ${post.id}, retrying...`);
              await new Promise(r => setTimeout(r, 1000 * retries)); // Backoff delay
            }
          } catch (error) {
            console.error(`Image generation error for post ${post.id}:`, error);
            retries++;
            await new Promise(r => setTimeout(r, 1000 * retries));
          }
        }
      }
      
      // PRIORITY 3: Fallback to branded placeholder if all else fails
      if (!b64Image) {
        // Use branded placeholder from geminiService (will use brand colors)
        console.log(`Using branded placeholder for post ${post.id}`);
        b64Image = await generatePostImage(post.visualPrompt, profile);
      }
      
      setGeneratedPosts(current => 
        current.map(p => p.id === post.id ? { ...p, imageUrl: b64Image } : p)
      );
      
      // Also update liked posts if it exists there
      setLikedPosts(current =>
        current.map(p => p.id === post.id && !p.imageUrl ? { ...p, imageUrl: b64Image } : p)
      );
      
      setLoadingImages(prev => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    });
  };

  // Eager load images as user swipes - load up to 3 in parallel
  useEffect(() => {
    if (appState === AppState.SWIPING && brandProfile) {
      // Find pending images that aren't loading
      const pending = generatedPosts.filter(p => !p.imageUrl && !loadingImages.has(p.id));
      
      // Allow up to 3 concurrent image loads
      const currentlyLoading = loadingImages.size;
      const canLoad = Math.max(0, 3 - currentlyLoading);
      
      if (pending.length > 0 && canLoad > 0) {
        startImageGeneration(pending.slice(0, canLoad), brandProfile);
      }
    }
  }, [generatedPosts, appState, brandProfile, loadingImages]);

  const handleLike = (post: SocialPost) => {
    setLikedPosts(prev => [...prev, { ...post, status: 'liked' }]);
  };

  const handleReject = (post: SocialPost) => {
    // Just discard
  };

  const handleFetchMore = async () => {
    if (isGeneratingMore || !brandProfile) return;
    setIsGeneratingMore(true);
    
    // Generate next batch
    const newPosts = await generateContentIdeas(brandProfile, 10);
    setGeneratedPosts(prev => [...prev, ...newPosts]);
    
    // Start generating images for the first 2 new ones immediately
    startImageGeneration(newPosts.slice(0, 2), brandProfile);
    
    setIsGeneratingMore(false);
  };

  const handleProfileUpdate = (updated: BrandProfile) => {
    setBrandProfile(updated);
    // Note: This updated profile will be used by handleFetchMore automatically
    // when the user scrolls near the end.
  };

  const handleAddSource = async (url: string) => {
    if (!brandProfile) return;
    setIsMerging(true);
    const updated = await mergeSourceUrl(brandProfile, url);
    setBrandProfile(updated);
    setIsMerging(false);
  };

  const handleCustomCreate = async () => {
    if (!customPrompt || !brandProfile) return;
    setIsGeneratingMore(true); // Reusing loader state
    setCustomCreateMode(false);
    
    const [newPost] = await generateContentIdeas(brandProfile, 1, customPrompt);
    if (newPost) {
        setGeneratedPosts(prev => {
            return [...prev, newPost];
        });
        startImageGeneration([newPost], brandProfile);
    }
    setCustomPrompt('');
    setIsGeneratingMore(false);
  };

  const handleEditOpen = (post: SocialPost) => {
    setEditingPost(post);
  };

  const handleEditSave = async (instruction: string) => {
    if (!editingPost) return;
    setIsUpdatingPost(true);
    
    const updatedPost = await refinePost(editingPost, instruction);
    
    setGeneratedPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
    setLikedPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));

    setEditingPost(null);
    setIsUpdatingPost(false);
  };
  
  const handleUpdatePost = (updatedPost: SocialPost) => {
    setLikedPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  // Delete a post from liked posts
  const handleDeletePost = (postId: string) => {
    setLikedPosts(prev => prev.filter(p => p.id !== postId));
    
    // Also remove from pending videos if it was generating
    if (pendingVideos.has(postId)) {
      setPendingVideos(prev => {
        const next = new Map(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  // Schedule a post to calendar
  const handleSchedulePost = (postId: string, scheduledDate: string) => {
    setLikedPosts(prev => prev.map(p => 
      p.id === postId ? { ...p, scheduledDate } : p
    ));
    console.log(`Post ${postId} scheduled for ${scheduledDate}`);
  };

  // Reschedule a post (drag-drop from calendar)
  const handleReschedulePost = (postId: string, newDate: string) => {
    setLikedPosts(prev => prev.map(p => 
      p.id === postId ? { ...p, scheduledDate: newDate } : p
    ));
    console.log(`Post ${postId} rescheduled to ${newDate}`);
  };

  // Handle animation request - generates video from image
  // Creates a SEPARATE video asset while keeping the original image
  const handleAnimate = async (instruction: string) => {
    if (!editingPost || !brandProfile) return;
    setIsAnimating(true);
    
    // Generate a new ID for the video asset
    const videoPostId = `${editingPost.id}-video-${Date.now()}`;
    
    // Create a new video asset based on the original image post
    const createVideoAsset = (status: SocialPost['videoStatus'], videoUrl?: string): SocialPost => ({
      ...editingPost,
      id: videoPostId,
      status: 'liked',
      videoStatus: status,
      videoUrl: videoUrl,
      // Keep the image for thumbnail/poster
    });
    
    // First, ensure the original image post is in liked posts
    const originalInLiked = likedPosts.find(p => p.id === editingPost.id);
    if (!originalInLiked) {
      // Add original image to liked posts first
      setLikedPosts(prev => [...prev, { ...editingPost, status: 'liked' }]);
    }
    
    // For image-to-video, ONLY use the user's motion instruction
    // Do NOT include the image description (visualPrompt) - the image itself provides the visuals
    // The prompt should describe HOW to animate, not WHAT is in the image
    const motionPrompt = instruction || "Subtle cinematic motion with gentle camera movement";
    
    try {
      // Pass the source image for image-to-video mode (animates the actual image)
      const result = await generatePostVideo(motionPrompt, brandProfile, '5s', editingPost.imageUrl);
      
      if (result.status === 'success' && result.videoUrl) {
        // Video ready immediately (unlikely but handle it)
        const videoAsset = createVideoAsset('ready', result.videoUrl);
        setLikedPosts(prev => [...prev, videoAsset]);
        
      } else if (result.status === 'pending' && result.operationName) {
        // Video generation is async - add to polling queue
        // Create a placeholder video asset that will be updated when ready
        const videoAsset = createVideoAsset('generating');
        setLikedPosts(prev => [...prev, videoAsset]);
        
        // Track this video asset for polling (use the new video post ID)
        setPendingVideos(prev => new Map(prev).set(videoPostId, result.operationName!));
        
      } else {
        // Video generation failed - create a failed asset so user can see/retry
        const videoAsset = createVideoAsset('failed');
        setLikedPosts(prev => [...prev, videoAsset]);
      }
    } catch (error) {
      console.error('Animation failed:', error);
      // Add failed video asset
      const videoAsset = createVideoAsset('failed');
      setLikedPosts(prev => [...prev, videoAsset]);
    }
    
    setIsAnimating(false);
    setEditingPost(null);
  };

  // Poll for pending video completions
  useEffect(() => {
    if (pendingVideos.size === 0) return;
    
    const pollInterval = setInterval(async () => {
      for (const [postId, operationName] of pendingVideos.entries()) {
        try {
          const status = await checkVideoStatus(operationName);
          
          if (status.status === 'success' && status.videoUrl) {
            // Video ready! Update the video asset
            const update = (p: SocialPost) => p.id === postId ? { 
              ...p, 
              videoStatus: 'ready' as const, 
              videoUrl: status.videoUrl 
            } : p;
            
            // Only update likedPosts since video assets are only in liked
            setLikedPosts(prev => prev.map(update));
            
            // Remove from pending
            setPendingVideos(prev => {
              const next = new Map(prev);
              next.delete(postId);
              return next;
            });
            
            console.log(`Video ready for asset ${postId}:`, status.videoUrl);
          } else if (status.status === 'failed') {
            // Video failed - update the asset status
            const update = (p: SocialPost) => p.id === postId ? { 
              ...p, 
              videoStatus: 'failed' as const 
            } : p;
            setLikedPosts(prev => prev.map(update));
            
            setPendingVideos(prev => {
              const next = new Map(prev);
              next.delete(postId);
              return next;
            });
            
            console.log(`Video failed for asset ${postId}:`, status.failureReason);
          }
          // If still pending, keep polling
        } catch (error) {
          console.error('Video poll error:', error);
        }
      }
    }, 10000); // Poll every 10 seconds
    
    return () => clearInterval(pollInterval);
  }, [pendingVideos]);

  const handleDeckEmpty = () => {
    setAppState(AppState.DASHBOARD);
  };

  // Brand Selector handlers
  const handleSelectBrand = async (brand: StoredBrand) => {
    console.log('📦 Loading brand workspace:', brand.name);
    
    // Load workspace from Supabase
    const workspace = await loadBrandWorkspace(brand.id);
    if (!workspace) {
      console.error('Failed to load brand workspace');
      return;
    }
    
    // Set brand profile from stored data
    setBrandProfile(workspace.brand.profile_json);
    setCurrentBrandId(brand.id);
    
    // Load saved posts
    const likedFromDb = workspace.posts.map(p => ({
      ...p.post_json,
      status: 'liked' as const,
    }));
    setLikedPosts(likedFromDb);
    
    // Generate fresh content for the deck
    const freshPosts = await generateContentIdeas(workspace.brand.profile_json, 10);
    setGeneratedPosts(freshPosts);
    
    // Start image generation with explicit brand ID to avoid stale state
    startImageGeneration(freshPosts.slice(0, 5), workspace.brand.profile_json, brand.id);
    
    setAppState(AppState.SWIPING);
  };

  const handleNewBrand = () => {
    // Clear current brand and go to onboarding
    setBrandProfile(null);
    setGeneratedPosts([]);
    setLikedPosts([]);
    setCurrentBrandId(null);
    resetAnalysisStages();
    setAppState(AppState.ONBOARDING);
  };

  const handleHardRefresh = async (brand: StoredBrand) => {
    console.log('🔄 Hard refresh for:', brand.name);
    // Clear posts but keep the brand context
    setGeneratedPosts([]);
    // Keep liked posts - they're the user's work
    
    // Re-analyze the brand from scratch
    setAppState(AppState.ANALYZING);
    resetAnalysisStages();
    
    // Trigger fresh analysis using the stored URL
    await handleStartAnalysis(brand.url.startsWith('http') ? brand.url : `https://${brand.url}`);
  };

  const handleSoftRefresh = async (brand: StoredBrand) => {
    console.log('🔄 Soft refresh for:', brand.name);
    setIsRefreshing(true);
    
    try {
      const result = await softRefreshBrand(
        brand.profile_json, 
        brand.url.startsWith('http') ? brand.url : `https://${brand.url}`
      );
      
      if (result.changes.length > 0) {
        // Update the brand in Supabase
        await saveBrand(brand.url, result.updatedProfile);
        
        // Refresh the brands list
        const updatedBrands = await listBrands();
        setAllBrands(updatedBrands);
        
        // Show what changed with beautiful toast
        toast.success(
          'Refresh Complete!',
          result.changes.join(' • ')
        );
      } else {
        toast.info(
          'All Up to Date',
          'No new information found. Your brand profile is current.'
        );
      }
    } catch (error) {
      console.error('Soft refresh failed:', error);
      toast.error(
        'Refresh Failed',
        'Could not refresh brand data. Please try again.'
      );
    }
    
    setIsRefreshing(false);
  };

  // Brand switching from sidebar
  const handleSwitchBrand = async (brandId: string) => {
    const brand = allBrands.find(b => b.id === brandId);
    if (brand) {
      await handleSelectBrand(brand);
    }
  };

  // Navigate back to brand selector
  const handleBackToBrands = () => {
    setAppState(AppState.BRAND_SELECTOR);
  };

  // Show configuration error if API keys are missing
  if (!apiConfigured) {
    const missingKeys = getMissingApiKeys();
    return (
      <div className="h-screen w-full bg-gray-950 flex items-center justify-center p-8">
        <div className="max-w-lg text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">API Keys Not Configured</h1>
          <p className="text-gray-400 mb-6">
            FlySolo requires Google AI API keys to function. Please configure the following environment variables in your Netlify dashboard:
          </p>
          <div className="bg-gray-900 rounded-lg p-4 text-left mb-6">
            <ul className="space-y-2 text-sm font-mono">
              {missingKeys.map(key => (
                <li key={key} className="text-red-400">
                  ❌ {key}
                </li>
              ))}
              <li className="text-gray-500">VITE_IMAGEN_API_KEY (optional)</li>
              <li className="text-gray-500">VITE_VEO_API_KEY (optional)</li>
            </ul>
          </div>
          <div className="text-sm text-gray-500 space-y-2">
            <p>1. Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Google AI Studio</a> to get an API key</p>
            <p>2. Add it to Netlify: Site settings → Environment variables</p>
            <p>3. Redeploy your site</p>
          </div>
        </div>
      </div>
    );
  }

  // Render Logic
  switch (appState) {
    case AppState.BRAND_SELECTOR:
      return (
        <>
          <BrandSelector
            onSelectBrand={handleSelectBrand}
            onNewBrand={handleNewBrand}
            onHardRefresh={handleHardRefresh}
            onSoftRefresh={handleSoftRefresh}
            pendingAnalyses={pendingAnalyses}
            onPendingAnalysisClick={handleNotificationClick}
          />
          {/* Global Notification Bell */}
          <div className="fixed top-4 right-4 z-50">
            <NotificationBell
              notifications={notifications}
              onNotificationClick={handleNotificationClick}
              onMarkAsRead={handleMarkNotificationAsRead}
              onClearAll={handleClearAllNotifications}
            />
          </div>
          {/* Toast Notifications */}
          <NotificationToast
            notification={activeToast}
            onClose={() => setActiveToast(null)}
            onClick={handleNotificationClick}
          />
          {/* Modern Toast Container */}
          <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />
        </>
      );
    case AppState.ONBOARDING:
      return <Onboarding onStart={handleStartAnalysis} errorMessage={analysisError} />;
    case AppState.ANALYZING:
      return (
        <AnalysisLoader 
          stages={analysisStages} 
          onContinueInBackground={handleContinueInBackground}
        />
      );
    case AppState.SWIPING:
      return (
        <div className="h-screen w-full bg-gray-950 flex items-center justify-center p-4 relative">
            <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
                 <NotificationBell
                    notifications={notifications}
                    onNotificationClick={handleNotificationClick}
                    onMarkAsRead={handleMarkNotificationAsRead}
                    onClearAll={handleClearAllNotifications}
                 />
                 <button 
                    onClick={() => setAppState(AppState.DASHBOARD)}
                    className="text-gray-400 hover:text-white text-sm font-medium"
                 >
                    Skip to Saved ({likedPosts.length})
                 </button>
            </div>
            {/* Toast Notifications */}
            <NotificationToast
              notification={activeToast}
              onClose={() => setActiveToast(null)}
              onClick={handleNotificationClick}
            />
            
            {brandProfile && (
                <SwipeDeck 
                    posts={generatedPosts} 
                    brandProfile={brandProfile}
                    likedPosts={likedPosts}
                    onLike={handleLike}
                    onReject={handleReject}
                    onEdit={handleEditOpen}
                    onEmpty={handleDeckEmpty}
                    onFetchMore={handleFetchMore}
                    onUpdateProfile={handleProfileUpdate}
                    onAddSource={handleAddSource}
                    onCustomCreate={() => setCustomCreateMode(true)}
                    onStartFresh={handleStartFresh}
                    onDeletePost={handleDeletePost}
                    onSchedulePost={handleSchedulePost}
                    onCalendar={() => setAppState(AppState.CALENDAR)}
                    loadingImages={loadingImages}
                    isMerging={isMerging}
                    isGeneratingMore={isGeneratingMore}
                    allBrands={allBrands}
                    currentBrandId={currentBrandId}
                    onSwitchBrand={handleSwitchBrand}
                    onBackToBrands={handleBackToBrands}
                />
            )}

            {/* Custom Create Modal */}
            {customCreateMode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 w-full max-w-md rounded-2xl border border-gray-700 p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">Create Custom Asset</h3>
                            <button onClick={() => setCustomCreateMode(false)}><X className="text-gray-400 hover:text-white" /></button>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">
                            Describe exactly what you want (e.g. "A promo for our winter sale in 9:16 video style").
                        </p>
                        <textarea 
                            className="w-full bg-black/50 border border-gray-700 rounded-xl p-3 text-white mb-4 h-32 focus:outline-none focus:border-indigo-500"
                            placeholder="Describe your vision..."
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                        />
                        <button 
                            onClick={handleCustomCreate}
                            disabled={!customPrompt}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
                        >
                            Generate Custom Post
                        </button>
                    </div>
                </div>
            )}

            {editingPost && (
                <Editor 
                    post={editingPost} 
                    onSave={handleEditSave}
                    onAnimate={handleAnimate}
                    onClose={() => setEditingPost(null)}
                    isUpdating={isUpdatingPost}
                    isAnimating={isAnimating}
                />
            )}
        </div>
      );
    case AppState.CALENDAR:
      return brandProfile ? (
        <>
          <CalendarPage 
            posts={likedPosts}
            profile={brandProfile}
            onBack={() => setAppState(AppState.SWIPING)}
            onSelectPost={handleEditOpen}
            onReschedulePost={handleReschedulePost}
          />
          {/* Global Notification Bell */}
          <div className="fixed top-4 right-4 z-50">
            <NotificationBell
              notifications={notifications}
              onNotificationClick={handleNotificationClick}
              onMarkAsRead={handleMarkNotificationAsRead}
              onClearAll={handleClearAllNotifications}
            />
          </div>
          {/* Toast Notifications */}
          <NotificationToast
            notification={activeToast}
            onClose={() => setActiveToast(null)}
            onClick={handleNotificationClick}
          />
          {/* Modern Toast Container */}
          <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />
          {editingPost && (
            <Editor 
              post={editingPost} 
              onSave={handleEditSave}
              onAnimate={handleAnimate}
              onClose={() => setEditingPost(null)}
              isUpdating={isUpdatingPost}
              isAnimating={isAnimating}
            />
          )}
        </>
      ) : null;
    case AppState.DASHBOARD:
      return brandProfile ? (
        <>
            <Dashboard 
                posts={likedPosts} 
                profile={brandProfile} 
                onUpdatePost={handleUpdatePost} 
                onEditPost={handleEditOpen}
            />
            {/* Global Notification Bell */}
            <div className="fixed top-4 right-4 z-50">
              <NotificationBell
                notifications={notifications}
                onNotificationClick={handleNotificationClick}
                onMarkAsRead={handleMarkNotificationAsRead}
                onClearAll={handleClearAllNotifications}
              />
            </div>
            {/* Toast Notifications */}
            <NotificationToast
              notification={activeToast}
              onClose={() => setActiveToast(null)}
              onClick={handleNotificationClick}
            />
            {editingPost && (
                <Editor 
                    post={editingPost} 
                    onSave={handleEditSave}
                    onAnimate={handleAnimate}
                    onClose={() => setEditingPost(null)}
                    isUpdating={isUpdatingPost}
                    isAnimating={isAnimating}
                />
            )}
        </>
      ) : null;
    default:
        return null;
  }
}

export default App;
