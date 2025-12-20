/**
 * Content Cache Service for FlySolo
 * 
 * Caches generated content (posts + images) in Supabase to prevent
 * unnecessary API calls on page reload.
 * 
 * TWO-TIER CONTENT SYSTEM:
 * 
 * 1. GENERATED CONTENT CACHE (brand_content_cache table)
 *    - Ephemeral: auto-expires after 24 hours
 *    - Stores AI-generated posts + images
 *    - Reused on page refresh to avoid API calls
 *    - Cleared when user requests "refresh" or switches brands
 * 
 * 2. SAVED ASSETS (saved_posts table - already exists)
 *    - Permanent: user's liked/scheduled content
 *    - Never auto-deleted
 *    - Used for calendar scheduling and publishing
 */

import { getSupabase } from './supabaseService';
import { SocialPost } from '../types';

// Cache TTL (time to live) in hours
const CACHE_TTL_HOURS = 24;

export interface CachedContent {
  id: string;
  brand_id: string;
  posts_json: SocialPost[];
  created_at: string;
  expires_at: string;
  post_count: number;
  images_loaded: number;
}

/**
 * Save generated content to cache
 * This is called after generating new content via API
 */
export const cacheGeneratedContent = async (
  brandId: string,
  posts: SocialPost[]
): Promise<boolean> => {
  const client = getSupabase();
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);
  
  // Count posts with images
  const imagesLoaded = posts.filter(p => p.imageUrl && !p.imageUrl.includes('svg+xml')).length;
  
  const cacheData = {
    brand_id: brandId,
    posts_json: posts,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    post_count: posts.length,
    images_loaded: imagesLoaded,
  };
  
  try {
    // Upsert: replace existing cache for this brand
    const { error } = await client
      .from('brand_content_cache')
      .upsert(cacheData, { onConflict: 'brand_id' });
    
    if (error) {
      // Table might not exist yet - that's OK, we'll create it
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('⚠️ brand_content_cache table does not exist. Run the schema SQL.');
        return false;
      }
      console.error('Failed to cache content:', error);
      return false;
    }
    
    console.log(`💾 Cached ${posts.length} posts (${imagesLoaded} with images) for brand ${brandId}`);
    console.log(`   Cache expires: ${expiresAt.toLocaleString()}`);
    return true;
  } catch (e) {
    console.error('Cache save error:', e);
    return false;
  }
};

/**
 * Load cached content for a brand
 * Returns null if no valid cache exists
 */
export const loadCachedContent = async (
  brandId: string
): Promise<SocialPost[] | null> => {
  const client = getSupabase();
  
  try {
    const { data, error } = await client
      .from('brand_content_cache')
      .select('*')
      .eq('brand_id', brandId)
      .single();
    
    if (error) {
      // No cache found or table doesn't exist
      if (error.code === 'PGRST116' || error.code === '42P01') {
        console.log('📭 No cached content found for brand');
        return null;
      }
      console.error('Cache load error:', error);
      return null;
    }
    
    if (!data) return null;
    
    // Check if cache has expired
    const expiresAt = new Date(data.expires_at);
    const now = new Date();
    
    if (expiresAt < now) {
      console.log('⏰ Cache expired, will regenerate content');
      // Optionally delete expired cache
      await clearCachedContent(brandId);
      return null;
    }
    
    // Calculate cache age
    const cacheAge = now.getTime() - new Date(data.created_at).getTime();
    const cacheAgeMinutes = Math.round(cacheAge / (60 * 1000));
    
    console.log(`📦 Loaded ${data.post_count} cached posts (${data.images_loaded} with images)`);
    console.log(`   Cache age: ${cacheAgeMinutes} minutes`);
    
    return data.posts_json as SocialPost[];
  } catch (e) {
    console.error('Cache load error:', e);
    return null;
  }
};

/**
 * Update cached content with new image URLs
 * Called as images are generated to persist them
 */
export const updateCachedImage = async (
  brandId: string,
  postId: string,
  imageUrl: string,
  imageSource?: string
): Promise<boolean> => {
  const client = getSupabase();
  
  try {
    // Load existing cache
    const { data, error } = await client
      .from('brand_content_cache')
      .select('posts_json, images_loaded')
      .eq('brand_id', brandId)
      .single();
    
    if (error || !data) return false;
    
    // Update the specific post
    const posts = data.posts_json as SocialPost[];
    const updatedPosts = posts.map(p => {
      if (p.id === postId) {
        return { ...p, imageUrl, imageSource: imageSource as any };
      }
      return p;
    });
    
    // Count images
    const imagesLoaded = updatedPosts.filter(p => p.imageUrl && !p.imageUrl.includes('svg+xml')).length;
    
    // Update cache
    const { error: updateError } = await client
      .from('brand_content_cache')
      .update({ 
        posts_json: updatedPosts,
        images_loaded: imagesLoaded,
      })
      .eq('brand_id', brandId);
    
    if (updateError) {
      console.error('Failed to update cached image:', updateError);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Cache image update error:', e);
    return false;
  }
};

/**
 * Bulk update cached posts (more efficient than updating one at a time)
 * Now with proper error logging instead of silent failures
 */
export const updateCachedPosts = async (
  brandId: string,
  posts: SocialPost[]
): Promise<boolean> => {
  const client = getSupabase();
  
  const imagesLoaded = posts.filter(p => p.imageUrl && !p.imageUrl.includes('svg+xml')).length;
  
  try {
    const { error } = await client
      .from('brand_content_cache')
      .update({ 
        posts_json: posts,
        post_count: posts.length,
        images_loaded: imagesLoaded,
      })
      .eq('brand_id', brandId);
    
    if (error) {
      console.error('❌ Failed to update cached posts:', error.code, error.message);
      return false;
    }
    
    console.log(`📝 Cache updated: ${posts.length} posts (${imagesLoaded} with images)`);
    return true;
  } catch (e) {
    console.error('❌ Cache posts update error:', e);
    return false;
  }
};

/**
 * AGGRESSIVELY delete a post from cache
 * 
 * If the graceful update fails (timeout), we NUKE the entire cache.
 * Better to regenerate fresh content than show stale rejected posts.
 * 
 * @param brandId - The brand's UUID
 * @param postId - The post ID to remove
 * @returns true if deletion succeeded (or cache was nuked), false only if everything failed
 */
export const deletePostFromCache = async (
  brandId: string,
  postId: string
): Promise<boolean> => {
  const client = getSupabase();
  
  try {
    // Step 1: Load current cache
    const { data, error: loadError } = await client
      .from('brand_content_cache')
      .select('posts_json')
      .eq('brand_id', brandId)
      .single();
    
    if (loadError) {
      // No cache exists - that's fine, nothing to delete
      if (loadError.code === 'PGRST116' || loadError.code === '42P01') {
        console.log('📭 No cache exists, nothing to delete');
        return true;
      }
      // Any other error - nuke the cache to be safe
      console.warn(`⚠️ Cache load failed, nuking entire cache: ${loadError.message}`);
      return await nukeCacheForBrand(brandId);
    }
    
    if (!data || !data.posts_json) {
      console.log('📭 Cache empty, nothing to delete');
      return true;
    }
    
    // Step 2: Filter out the deleted post
    const currentPosts = data.posts_json as SocialPost[];
    const updatedPosts = currentPosts.filter(p => p.id !== postId);
    
    // Check if post was actually in the cache
    if (updatedPosts.length === currentPosts.length) {
      console.log(`⚠️ Post ${postId} not found in cache`);
      return true;
    }
    
    // Step 3: Try to update - with a SHORT timeout expectation
    const imagesLoaded = updatedPosts.filter(p => p.imageUrl && !p.imageUrl.includes('svg+xml')).length;
    
    const { error: updateError } = await client
      .from('brand_content_cache')
      .update({ 
        posts_json: updatedPosts,
        post_count: updatedPosts.length,
        images_loaded: imagesLoaded,
      })
      .eq('brand_id', brandId);
    
    if (updateError) {
      // UPDATE FAILED (likely timeout) - NUKE THE ENTIRE CACHE
      console.error(`❌ Cache update failed (${updateError.code}), NUKING entire cache to prevent stale data`);
      return await nukeCacheForBrand(brandId);
    }
    
    console.log(`🗑️ Post ${postId.slice(0, 8)}... deleted from cache (${updatedPosts.length} remaining)`);
    return true;
    
  } catch (e) {
    // Any exception - NUKE IT
    console.error('❌ Cache deletion error, NUKING cache:', e);
    return await nukeCacheForBrand(brandId);
  }
};

/**
 * Nuclear option: DELETE the entire cache row for a brand
 * Called when graceful updates fail - better to regenerate than show stale content
 */
export const nukeCacheForBrand = async (brandId: string): Promise<boolean> => {
  const client = getSupabase();
  
  try {
    const { error } = await client
      .from('brand_content_cache')
      .delete()
      .eq('brand_id', brandId);
    
    if (error && !error.message?.includes('does not exist')) {
      console.error('❌ Failed to nuke cache:', error);
      return false;
    }
    
    console.log('💥 NUKED content cache for brand - will regenerate fresh content');
    return true;
  } catch (e) {
    console.error('❌ Cache nuke error:', e);
    return false;
  }
};

/**
 * PURGE EVERYTHING - Nuclear option for when things are really broken
 * Clears: Supabase cache + localStorage + sessionStorage
 */
export const purgeAllCachesForBrand = async (brandId: string): Promise<void> => {
  console.log('🔥 PURGING ALL CACHES for brand', brandId);
  
  // 1. Nuke Supabase cache
  await nukeCacheForBrand(brandId);
  
  // 2. Clear any localStorage items related to this brand
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes(brandId) || key.includes('posts') || key.includes('cache'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    if (keysToRemove.length > 0) {
      console.log(`🧹 Cleared ${keysToRemove.length} localStorage items`);
    }
  } catch (e) {
    // localStorage might not be available
  }
  
  // 3. Clear any sessionStorage items
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes(brandId) || key.includes('posts') || key.includes('cache'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    if (keysToRemove.length > 0) {
      console.log(`🧹 Cleared ${keysToRemove.length} sessionStorage items`);
    }
  } catch (e) {
    // sessionStorage might not be available
  }
  
  console.log('✅ All caches purged for brand');
};

/**
 * Helper: Sleep for a specified duration
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Clear cached content for a brand
 * Called when user requests a refresh or switches away
 */
export const clearCachedContent = async (brandId: string): Promise<boolean> => {
  const client = getSupabase();
  
  try {
    const { error } = await client
      .from('brand_content_cache')
      .delete()
      .eq('brand_id', brandId);
    
    if (error && !error.message?.includes('does not exist')) {
      console.error('Failed to clear cache:', error);
      return false;
    }
    
    console.log('🧹 Cleared content cache for brand');
    return true;
  } catch (e) {
    console.error('Cache clear error:', e);
    return false;
  }
};

/**
 * Clear all expired caches (housekeeping)
 * Can be called periodically or on app startup
 */
export const clearExpiredCaches = async (): Promise<number> => {
  const client = getSupabase();
  
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await client
      .from('brand_content_cache')
      .delete()
      .lt('expires_at', now)
      .select('brand_id');
    
    if (error && !error.message?.includes('does not exist')) {
      console.error('Failed to clear expired caches:', error);
      return 0;
    }
    
    const count = data?.length || 0;
    if (count > 0) {
      console.log(`🧹 Cleared ${count} expired content caches`);
    }
    return count;
  } catch (e) {
    console.error('Expired cache clear error:', e);
    return 0;
  }
};

/**
 * Check if we should use cached content or regenerate
 */
export const shouldUseCachedContent = async (brandId: string): Promise<{
  useCache: boolean;
  cacheAge?: number; // in minutes
  postCount?: number;
  imagesLoaded?: number;
}> => {
  const client = getSupabase();
  
  try {
    const { data, error } = await client
      .from('brand_content_cache')
      .select('created_at, expires_at, post_count, images_loaded')
      .eq('brand_id', brandId)
      .single();
    
    if (error || !data) {
      return { useCache: false };
    }
    
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    
    if (expiresAt < now) {
      return { useCache: false };
    }
    
    const cacheAge = Math.round((now.getTime() - new Date(data.created_at).getTime()) / (60 * 1000));
    
    return {
      useCache: true,
      cacheAge,
      postCount: data.post_count,
      imagesLoaded: data.images_loaded,
    };
  } catch (e) {
    return { useCache: false };
  }
};

/**
 * SQL schema for the brand_content_cache table
 * Run this in Supabase SQL editor if the table doesn't exist
 */
export const CONTENT_CACHE_SCHEMA = `
-- Brand Content Cache table: Stores generated content temporarily
-- Content auto-expires after 24 hours to ensure freshness while avoiding API spam
CREATE TABLE IF NOT EXISTS brand_content_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID UNIQUE REFERENCES brands(id) ON DELETE CASCADE,
  posts_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  post_count INTEGER DEFAULT 0,
  images_loaded INTEGER DEFAULT 0
);

-- Index for efficient lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_content_cache_brand_id ON brand_content_cache(brand_id);
CREATE INDEX IF NOT EXISTS idx_content_cache_expires ON brand_content_cache(expires_at);

-- Optional: Auto-cleanup function (runs every hour)
-- CREATE OR REPLACE FUNCTION cleanup_expired_caches()
-- RETURNS void AS $$
-- BEGIN
--   DELETE FROM brand_content_cache WHERE expires_at < NOW();
-- END;
-- $$ LANGUAGE plpgsql;
`;

