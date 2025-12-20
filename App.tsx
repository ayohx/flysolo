import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
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
import { analyzeBrand, generateContentIdeas, generatePostImage, generatePostImageWithSource, refinePost, mergeSourceUrl, generatePostVideo, checkVideoStatus, isApiConfigured, getMissingApiKeys, softRefreshBrand, clearPendingRequests } from './services/geminiService';
import { saveBrand, saveBrandAssets, getBrandByUrl, findRelevantAsset, checkDatabaseSetup, listBrands, loadBrandWorkspace, StoredBrand, getSavedPosts } from './services/supabaseService';
import { cacheGeneratedContent, loadCachedContent, updateCachedPosts, clearCachedContent, clearExpiredCaches, shouldUseCachedContent } from './services/contentCacheService';
import { Plus, X, Home, ArrowLeft } from 'lucide-react';

// LocalStorage keys - MINIMAL storage only (no large data!)
const STORAGE_KEYS = {
  // Lightweight keys only - IDs and state strings
  CURRENT_BRAND_ID: 'flysolo_current_brand_id',  // Just the UUID
  APP_STATE: 'flysolo_app_state',                // Just the state string
  PENDING_ANALYSES: 'flysolo_pending_analyses',  // Lightweight analysis tracking
  NOTIFICATIONS: 'flysolo_notifications',        // Small notification objects
  // REMOVED: brand_profile, generated_posts, liked_posts (use Supabase instead)
};

// Helper to normalise URLs for consistent tracking
const normaliseUrl = (url: string): string => {
  return url.toLowerCase().replace(/\/$/, '').replace(/^https?:\/\//, '');
};

// Helper to create URL slugs from brand names
const createBrandSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '');      // Trim leading/trailing hyphens
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
  // React Router hooks for URL-based navigation
  const navigate = useNavigate();
  const location = useLocation();
  const { brandSlug } = useParams<{ brandSlug: string }>();
  
  const [appState, setAppState] = useState<AppState>(AppState.ONBOARDING);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [generatedPosts, setGeneratedPosts] = useState<SocialPost[]>([]);
  const [likedPosts, setLikedPosts] = useState<SocialPost[]>([]);
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Brand management state - MUST be before init useEffect that uses them
  const [currentBrandId, setCurrentBrandId] = useState<string | null>(null);
  const [allBrands, setAllBrands] = useState<StoredBrand[]>([]);
  
  // Check if API is configured
  const apiConfigured = isApiConfigured();
  
  // Error handling state
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Restore state from Supabase on mount (localStorage only for lightweight data)
  // NOW WITH CONTENT CACHING to avoid unnecessary API calls on refresh
  useEffect(() => {
    const initializeApp = async () => {
      // Clean up expired caches on startup
      await clearExpiredCaches();
      
      // Get lightweight state from localStorage
      const savedBrandId = loadFromStorage<string | null>(STORAGE_KEYS.CURRENT_BRAND_ID, null);
      const savedState = loadFromStorage<string>(STORAGE_KEYS.APP_STATE, AppState.ONBOARDING);
      
      console.log('🔄 App init - brandId:', savedBrandId, 'state:', savedState);
      
      // If we have a saved brand ID, load from Supabase
      if (savedBrandId) {
        try {
          // Load brand workspace from Supabase (profile + saved posts)
          const workspace = await loadBrandWorkspace(savedBrandId);
          
          if (workspace) {
            console.log('✅ Loaded from Supabase:', workspace.brand.name, 'with', workspace.posts.length, 'saved posts');
            setBrandProfile(workspace.brand.profile_json);
            setCurrentBrandId(savedBrandId);
            setLikedPosts(workspace.posts.map(p => ({ ...p.post_json, status: 'liked' as const })));
            
            // CHECK CONTENT CACHE FIRST - Avoid unnecessary API calls!
            const cacheStatus = await shouldUseCachedContent(savedBrandId);
            
            if (cacheStatus.useCache) {
              // Load from cache - NO API CALLS!
              console.log('📦 Using CACHED content (age: ' + cacheStatus.cacheAge + ' mins)');
              console.log('   Posts: ' + cacheStatus.postCount + ', Images: ' + cacheStatus.imagesLoaded);
              
              const cachedPosts = await loadCachedContent(savedBrandId);
              if (cachedPosts && cachedPosts.length > 0) {
                setGeneratedPosts(cachedPosts);
                // Skip image generation for posts that already have images
                const postsNeedingImages = cachedPosts.filter(p => !p.imageUrl || p.imageUrl.includes('svg+xml'));
                if (postsNeedingImages.length > 0) {
                  console.log(`🎨 Only ${postsNeedingImages.length} posts need images (${cachedPosts.length - postsNeedingImages.length} already cached)`);
                  startImageGeneration(postsNeedingImages.slice(0, 3), workspace.brand.profile_json, savedBrandId);
                }
              } else {
                // Cache was empty, generate fresh
                console.log('📭 Cache empty, generating fresh content...');
                const posts = await generateContentIdeas(workspace.brand.profile_json, 10);
                setGeneratedPosts(posts);
                // Cache the new content
                await cacheGeneratedContent(savedBrandId, posts);
              }
            } else {
              // No valid cache - generate fresh content (with rate limiting now!)
              console.log('🎨 No cache available, generating fresh content...');
              const posts = await generateContentIdeas(workspace.brand.profile_json, 10);
              setGeneratedPosts(posts);
              
              // Cache the generated content for future refreshes
              await cacheGeneratedContent(savedBrandId, posts);
            }
            
            // Set state - images will be generated by the eager-load effect
            if (savedState === AppState.SWIPING || savedState === AppState.DASHBOARD) {
              setAppState(savedState as AppState);
            } else {
              setAppState(AppState.SWIPING);
            }
          } else {
            // Brand not found in Supabase, check if we have brands at all
            const brands = await listBrands();
            setAllBrands(brands);
            if (brands.length > 0) {
              setAppState(AppState.BRAND_SELECTOR);
            } else {
              setAppState(AppState.ONBOARDING);
            }
          }
        } catch (e) {
          console.error('Failed to load from Supabase:', e);
          // Fallback to brand selector
          const brands = await listBrands();
          setAllBrands(brands);
          if (brands.length > 0) {
            setAppState(AppState.BRAND_SELECTOR);
          }
        }
      } else {
        // No saved brand - check if we have any brands in Supabase
        const brands = await listBrands();
        setAllBrands(brands);
        if (brands.length > 0) {
          setAppState(AppState.BRAND_SELECTOR);
        }
      }
      
      setIsHydrated(true);
    };
    
    initializeApp();
  }, []);
  
  // Handle URL-based brand navigation
  // When user navigates to /brand/nike, load the Nike brand
  useEffect(() => {
    if (!isHydrated || !brandSlug || allBrands.length === 0) return;
    
    // Find brand by matching slug
    const matchingBrand = allBrands.find(b => createBrandSlug(b.name) === brandSlug);
    
    if (matchingBrand) {
      // Only switch if it's a different brand
      if (matchingBrand.id !== currentBrandId) {
        console.log('🔗 URL navigation to brand:', matchingBrand.name);
        
        // Load this brand's workspace
        (async () => {
          // Clear previous brand state
          setGeneratedPosts([]);
          setLikedPosts([]);
          setIsGeneratingMore(true);
          setAppState(AppState.SWIPING);
          setCurrentBrandId(matchingBrand.id);
          
          const workspace = await loadBrandWorkspace(matchingBrand.id);
          if (!workspace) {
            console.error('Failed to load brand workspace from URL');
            setIsGeneratingMore(false);
            return;
          }
          
          setBrandProfile(workspace.brand.profile_json);
          setLikedPosts(workspace.posts.map(p => ({ ...p.post_json, status: 'liked' as const })));
          
          // Check content cache
          const cacheStatus = await shouldUseCachedContent(matchingBrand.id);
          
          if (cacheStatus.useCache) {
            console.log('📦 Loading CACHED content for', matchingBrand.name);
            const cachedPosts = await loadCachedContent(matchingBrand.id);
            if (cachedPosts && cachedPosts.length > 0) {
              setGeneratedPosts(cachedPosts);
              setIsGeneratingMore(false);
              
              // Generate images for posts that need them
              const postsNeedingImages = cachedPosts.filter(p => !p.imageUrl || p.imageUrl.includes('svg+xml'));
              if (postsNeedingImages.length > 0) {
                startImageGeneration(postsNeedingImages.slice(0, 3), workspace.brand.profile_json, matchingBrand.id);
              }
              return;
            }
          }
          
          // No cache - generate fresh content
          console.log('🎨 Generating fresh content for', matchingBrand.name);
          const posts = await generateContentIdeas(workspace.brand.profile_json, 10);
          setGeneratedPosts(posts);
          await cacheGeneratedContent(matchingBrand.id, posts);
          setIsGeneratingMore(false);
          
          // Start image generation
          startImageGeneration(posts.slice(0, 3), workspace.brand.profile_json, matchingBrand.id);
        })();
      }
    } else if (brandSlug) {
      // Brand not found - redirect to brand selector
      console.warn('⚠️ Brand not found for slug:', brandSlug);
      navigate('/');
    }
  }, [brandSlug, isHydrated, allBrands.length]);
  
  // Save ONLY lightweight data to localStorage (IDs and state strings)
  // All heavy data (posts, images) goes to Supabase
  useEffect(() => {
    if (!isHydrated) return;
    // Save current brand ID (just a UUID string - tiny)
    if (currentBrandId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_BRAND_ID, currentBrandId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_BRAND_ID);
    }
  }, [currentBrandId, isHydrated]);
  
  useEffect(() => {
    if (!isHydrated) return;
    // Save app state (just a string - tiny)
    if (appState === AppState.SWIPING || appState === AppState.DASHBOARD) {
      localStorage.setItem(STORAGE_KEYS.APP_STATE, appState);
    }
  }, [appState, isHydrated]);
  
  // NOTE: generatedPosts are NOT saved to localStorage or Supabase
  // They are regenerated fresh each session for better performance
  // Only likedPosts are saved to Supabase (see handleLike function)
  
  // Clear all saved data and start fresh
  const handleStartFresh = () => {
    // Clear lightweight localStorage keys
    localStorage.removeItem(STORAGE_KEYS.CURRENT_BRAND_ID);
    localStorage.removeItem(STORAGE_KEYS.APP_STATE);
    // Clear React state
    setBrandProfile(null);
    setCurrentBrandId(null);
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
  // currentBrandId and allBrands moved to top of component (before init useEffect)
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
        
        // Start image generation for first 10 posts
        startImageGeneration(pending.posts.slice(0, 10), pending.profile);
        
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
      
      // Extract a friendly brand name from the URL domain
      const urlDomain = normalisedUrl.replace(/^www\./, '').split('/')[0];
      const friendlyName = urlDomain.split('.')[0].charAt(0).toUpperCase() + urlDomain.split('.')[0].slice(1);
      
      // Add to pending with 'analysing' status since it's already started
      // If we have a brand profile already (stage 1 complete), use its name
      setPendingAnalyses(prev => new Map(prev).set(normalisedUrl, {
        id: crypto.randomUUID(),
        url: normalisedUrl,
        brandName: brandProfile?.name || friendlyName,
        status: 'analysing',
        progress: brandProfile ? 50 : 25, // More progress if we already have profile
        startedAt: new Date(),
        profile: brandProfile || undefined, // Include if available
      }));
      
      // Show toast confirming background mode
      toast.info(`Analysing ${brandProfile?.name || friendlyName} in the background...`);
      
      // Navigate to brand selector
      setAppState(AppState.BRAND_SELECTOR);
    }
  }, [currentAnalysisUrl, brandProfile, toast]);

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
      // Generate images for first 10 posts initially
      startImageGeneration(posts.slice(0, 10), profile);

      // Clear current analysis URL
      setCurrentAnalysisUrl(null);
      
      // Check if user moved analysis to background (not on ANALYZING screen anymore)
      // We need to check the ACTUAL current state, not a stale closure value
      const wasMovedToBackground = pendingAnalyses.has(normalisedUrl);
      
      if (wasMovedToBackground) {
        // User clicked "Continue in Background" - update pending and show notification
        updatePendingStatus(normalisedUrl, 'complete', { profile, posts });
        
        // Show toast notification
        addNotification({
          type: 'analysis_complete',
          title: `${profile.name} is ready!`,
          message: 'Tap to view your brand DNA and content ideas.',
          brandUrl: normalisedUrl,
        });
        
        // Don't navigate - user is viewing brand selector or adding another brand
        console.log('✅ Background analysis complete for:', profile.name);
      } else {
        // User stayed on the analysis screen - navigate to swiping
        setAppState(AppState.SWIPING);
      }
      
    } catch (error: any) {
      console.error("Analysis failed:", error);
      
      // Check if user moved to background
      const wasMovedToBackground = pendingAnalyses.has(normalisedUrl);
      
      // Mark stages as error (only relevant if user is still viewing)
      setAnalysisStages(prev => prev.map(s => 
        s.status === 'loading' ? { ...s, status: 'error' } : s
      ));
      
      if (wasMovedToBackground) {
        // Update pending analysis status
        updatePendingStatus(normalisedUrl, 'error', { 
          error: error.message || 'Analysis failed' 
        });
        
        // Show error notification
        addNotification({
          type: 'analysis_failed',
          title: 'Analysis failed',
          message: error.message || 'Could not analyse brand.',
          brandUrl: normalisedUrl,
        });
        
        // Don't navigate - user is elsewhere
        console.error('❌ Background analysis failed for:', normalisedUrl);
      } else {
        // User is still on analysis screen - show error and go back to onboarding
        setAnalysisError(error.message || "Analysis failed. Please try again.");
        
        setTimeout(() => {
          setAppState(AppState.ONBOARDING);
        }, 2000);
      }
      
      setCurrentAnalysisUrl(null);
    }
  };

  const startImageGeneration = async (postsToGen: SocialPost[], profile: BrandProfile, overrideBrandId?: string | null) => {
    const MAX_RETRIES = 2;
    // Use override brandId if provided, otherwise fall back to state (may be stale during brand switch)
    const activeBrandId = overrideBrandId !== undefined ? overrideBrandId : currentBrandId;
    
    postsToGen.forEach(async (post) => {
      if (post.imageUrl || loadingImages.has(post.id)) return;

      setLoadingImages(prev => new Set(prev).add(post.id));
      
      let imageUrl: string | undefined;
      let imageSource: 'imagen3' | 'gemini' | 'pexels' | 'placeholder' | 'unknown' = 'unknown';
      let retries = 0;
      
      // PRIORITY 1: Check Supabase for real product images
      // CRITICAL: Only use if URL is validated (many brand assets have fake/hallucinated URLs)
      if (activeBrandId) {
        try {
          // Extract product name from caption/visual prompt for matching
          const searchTerm = post.caption.split(' ').slice(0, 5).join(' ');
          const realAsset = await findRelevantAsset(activeBrandId, searchTerm);
          
          if (realAsset && realAsset.url) {
            // Validate URL: must start with https:// and not be a hallucinated domain URL
            const isValidUrl = realAsset.url.startsWith('https://') && 
              (realAsset.url.includes('images.pexels.com') || 
               realAsset.url.includes('supabase.co') ||
               realAsset.url.includes('cloudinary.com') ||
               realAsset.url.includes('unsplash.com') ||
               realAsset.url.startsWith('data:image/'));
            
            if (isValidUrl) {
              console.log(`🎯 Using REAL product image for post ${post.id}:`, realAsset.label);
              imageUrl = realAsset.url;
              imageSource = 'imagen3'; // Treat real assets as AI-quality
            } else {
              console.warn(`⚠️ Skipping asset with invalid/fake URL: ${realAsset.url.substring(0, 50)}...`);
            }
          }
        } catch (e) {
          console.warn('Asset lookup failed, falling back to AI:', e);
        }
      }
      
      // PRIORITY 2: Generate with AI (with source tracking)
      if (!imageUrl) {
        while (!imageUrl && retries < MAX_RETRIES) {
          try {
            // Use the enhanced function that tracks source
            const result = await generatePostImageWithSource(post.visualPrompt, profile);
            
            if (result.imageUrl && result.imageUrl !== 'undefined') {
              imageUrl = result.imageUrl;
              // Map the source type
              if (result.source === 'imagen3') imageSource = 'imagen3';
              else if (result.source === 'gemini-flash') imageSource = 'gemini';
              else if (result.source === 'pexels') imageSource = 'pexels';
              else if (result.source === 'placeholder') imageSource = 'placeholder';
              
              console.log(`✅ Image for post ${post.id}: source=${imageSource}`);
              
              // Warn if we're using fallbacks
              if (imageSource === 'pexels') {
                console.warn(`⚠️ Post ${post.id} using STOCK photo (AI generation failed)`);
              } else if (imageSource === 'placeholder') {
                console.warn(`⚠️ Post ${post.id} using PLACEHOLDER (all generation failed)`);
              }
            } else {
              retries++;
              console.log(`Image generation attempt ${retries} failed for post ${post.id}, retrying...`);
              await new Promise(r => setTimeout(r, 1000 * retries));
            }
          } catch (error) {
            console.error(`Image generation error for post ${post.id}:`, error);
            retries++;
            await new Promise(r => setTimeout(r, 1000 * retries));
          }
        }
      }
      
      // PRIORITY 3: Final fallback if all retries exhausted
      if (!imageUrl) {
        console.log(`Using branded placeholder for post ${post.id} after all retries`);
        imageUrl = await generatePostImage(post.visualPrompt, profile);
        imageSource = 'placeholder';
      }
      
      // Update posts with both URL and source tracking
      setGeneratedPosts(current => {
        const updated = current.map(p => p.id === post.id ? { ...p, imageUrl, imageSource } : p);
        
        // Update cache with new image (fire and forget)
        if (activeBrandId && imageUrl) {
          updateCachedPosts(activeBrandId, updated).catch(() => {});
        }
        
        return updated;
      });
      
      // Also update liked posts if it exists there
      setLikedPosts(current =>
        current.map(p => p.id === post.id && !p.imageUrl ? { ...p, imageUrl, imageSource } : p)
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
    
    // Remove from generated posts and update cache
    setGeneratedPosts(prev => {
      const updated = prev.filter(p => p.id !== post.id);
      // Update cache with remaining posts
      if (currentBrandId) {
        updateCachedPosts(currentBrandId, updated);
      }
      return updated;
    });
  };

  const handleReject = (post: SocialPost) => {
    // Remove from generated posts and update cache
    setGeneratedPosts(prev => {
      const updated = prev.filter(p => p.id !== post.id);
      // Update cache with remaining posts
      if (currentBrandId) {
        updateCachedPosts(currentBrandId, updated);
      }
      return updated;
    });
  };

  const handleFetchMore = async () => {
    if (isGeneratingMore || !brandProfile) return;
    setIsGeneratingMore(true);
    
    // Generate next batch of 5 posts (cost efficient)
    const newPosts = await generateContentIdeas(brandProfile, 5);
    setGeneratedPosts(prev => [...prev, ...newPosts]);
    
    // Start generating images for all 5 new ones
    startImageGeneration(newPosts.slice(0, 5), brandProfile);
    
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
    
    // Critical: Log the exact image being animated so we can verify
    console.log("🎬 Animating image:", {
      hasImage: !!editingPost.imageUrl,
      imageType: editingPost.imageUrl?.startsWith('data:') ? 'base64' : 
                 editingPost.imageUrl?.startsWith('http') ? 'URL' : 'unknown',
      imagePreview: editingPost.imageUrl?.substring(0, 80) + '...',
      motionPrompt,
    });
    
    try {
      // Pass the source image for image-to-video mode (animates the EXACT image on the card)
      // This ensures the video animation matches what the user sees
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
  // NOW WITH CONTENT CACHING and instant navigation via URL
  const handleSelectBrand = async (brand: StoredBrand) => {
    console.log('📦 Switching to brand:', brand.name);
    
    // CRITICAL: Clear any pending API requests from previous brand
    // This prevents 429 errors and wasted API calls
    clearPendingRequests();
    
    // CLEAR PREVIOUS BRAND STATE IMMEDIATELY - prevents showing stale content
    setGeneratedPosts([]);
    setLikedPosts([]);
    setBrandProfile(null);
    
    // NAVIGATE IMMEDIATELY to brand-specific URL
    // This provides instant visual feedback and clean page transition
    const brandSlug = createBrandSlug(brand.name);
    navigate(`/brand/${brandSlug}`);
    
    // Set app state for the brand workspace
    setAppState(AppState.SWIPING);
    setIsGeneratingMore(true); // Show loading indicator while we fetch
    
    // Update brand ID first (for localStorage sync)
    setCurrentBrandId(brand.id);
    
    // Load workspace from Supabase (quick operation)
    const workspace = await loadBrandWorkspace(brand.id);
    if (!workspace) {
      console.error('Failed to load brand workspace');
      setIsGeneratingMore(false);
      return;
    }
    
    // Set brand profile from stored data
    setBrandProfile(workspace.brand.profile_json);
    
    // Load saved posts
    const likedFromDb = workspace.posts.map(p => ({
      ...p.post_json,
      status: 'liked' as const,
    }));
    setLikedPosts(likedFromDb);
    
    // CHECK CONTENT CACHE FIRST - avoid API calls if we have cached content
    const cacheStatus = await shouldUseCachedContent(brand.id);
    
    if (cacheStatus.useCache) {
      console.log('📦 Using CACHED content for', brand.name);
      console.log(`   Cache age: ${cacheStatus.cacheAge} mins, Posts: ${cacheStatus.postCount}, Images: ${cacheStatus.imagesLoaded}`);
      
      const cachedPosts = await loadCachedContent(brand.id);
      if (cachedPosts && cachedPosts.length > 0) {
        setGeneratedPosts(cachedPosts);
        setIsGeneratingMore(false);
        
        // Only generate images for posts that don't have them yet
        const postsNeedingImages = cachedPosts.filter(p => !p.imageUrl || p.imageUrl.includes('svg+xml'));
        if (postsNeedingImages.length > 0 && postsNeedingImages.length < cachedPosts.length) {
          console.log(`🎨 ${cachedPosts.length - postsNeedingImages.length} images already cached, only generating ${postsNeedingImages.length} more`);
          startImageGeneration(postsNeedingImages.slice(0, 3), workspace.brand.profile_json, brand.id);
        } else if (postsNeedingImages.length > 0) {
          startImageGeneration(postsNeedingImages.slice(0, 3), workspace.brand.profile_json, brand.id);
        }
        return;
      }
    }
    
    // No valid cache - generate fresh content (rate-limited now!)
    console.log('🎨 Generating fresh content for', brand.name, '(no cache)');
    
    try {
      const freshPosts = await generateContentIdeas(workspace.brand.profile_json, 10);
      setGeneratedPosts(freshPosts);
      
      // Cache the generated content for future visits
      await cacheGeneratedContent(brand.id, freshPosts);
      
      // Start image generation (rate-limited, only 3 at a time)
      startImageGeneration(freshPosts.slice(0, 3), workspace.brand.profile_json, brand.id);
    } catch (err) {
      console.error('Failed to generate content:', err);
    }
    
    setIsGeneratingMore(false);
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
      // IMPORTANT: Clear content cache so fresh content will be generated
      // This prevents stale/broken images from being reused
      await clearCachedContent(brand.id);
      console.log('🧹 Content cache cleared for:', brand.name);
      
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
          result.changes.join(' • ') + ' • Content cache cleared'
        );
      } else {
        toast.info(
          'Content Refreshed',
          'Brand profile unchanged, but content cache cleared for fresh generation.'
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

  // Navigate back to brand selector - uses React Router for instant navigation
  const handleBackToBrands = () => {
    // Clear pending API requests to avoid wasted calls
    clearPendingRequests();
    
    // Clear brand state to prevent stale content showing
    setGeneratedPosts([]);
    setLikedPosts([]);
    setBrandProfile(null);
    setCurrentBrandId(null);
    
    navigate('/');
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
      return (
        <Onboarding 
          onStart={handleStartAnalysis} 
          errorMessage={analysisError} 
          onBackToBrands={handleBackToBrands}
          hasExistingBrands={allBrands.length > 0}
        />
      );
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
            {/* Top Left: Home Button */}
            <div className="absolute top-4 left-4 z-20">
              <button
                onClick={handleBackToBrands}
                className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
                title="Back to all brands"
              >
                <Home size={18} />
                <span className="hidden sm:inline text-sm font-medium">All Brands</span>
              </button>
            </div>
            
            {/* Top Right: Notifications & Skip */}
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
                    sourceUrl={currentBrandId ? allBrands.find(b => b.id === currentBrandId)?.url : currentAnalysisUrl || undefined}
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
            onBackToBrands={handleBackToBrands}
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
                onBackToBrands={handleBackToBrands}
                onBackToSwiping={() => setAppState(AppState.SWIPING)}
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
