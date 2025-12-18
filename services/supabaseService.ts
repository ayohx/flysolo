import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BrandProfile, SocialPost } from '../types';

/**
 * Supabase Configuration
 * FlySolo uses Supabase for:
 * 1. Brand Asset Storage - Real product images scraped during analysis
 * 2. Brand Memory - Persistent brand profiles across sessions
 * 3. Post Library - Saved/liked posts for calendar scheduling
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tjgpzzgmgcwqsxxubvsd.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqZ3B6emdtZ2N3cXN4eHVidnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzY3ODksImV4cCI6MjA4MTYxMjc4OX0.B_DECoX9TcBe72K9y0ojf8kWdBgGE-IEiUtoco8u4k4';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client instance
 */
export const getSupabase = (): SupabaseClient => {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('🗄️ Supabase client initialized');
  }
  return supabaseClient;
};

/**
 * Check if Supabase is configured and reachable
 */
export const isSupabaseConfigured = async (): Promise<boolean> => {
  try {
    const client = getSupabase();
    const { error } = await client.from('brands').select('count', { count: 'exact', head: true });
    // If table doesn't exist yet, that's OK - we'll create it
    if (error && !error.message.includes('does not exist')) {
      console.warn('Supabase health check failed:', error.message);
    }
    return true;
  } catch (e) {
    console.error('Supabase not reachable:', e);
    return false;
  }
};

// ============================================================================
// BRAND OPERATIONS
// ============================================================================

export interface StoredBrand {
  id: string;
  url: string;
  name: string;
  industry: string;
  profile_json: BrandProfile;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Save or update a brand profile in the database
 */
export const saveBrand = async (url: string, profile: BrandProfile): Promise<StoredBrand | null> => {
  const client = getSupabase();
  
  // Normalise URL for consistent lookup
  const normalisedUrl = url.toLowerCase().replace(/\/$/, '').replace(/^https?:\/\//, '');
  
  const brandData = {
    url: normalisedUrl,
    name: profile.name,
    industry: profile.industry,
    profile_json: profile,
    logo_url: profile.logoUrl,
    updated_at: new Date().toISOString(),
  };
  
  try {
    // Upsert: update if exists, insert if new
    const { data, error } = await client
      .from('brands')
      .upsert(brandData, { onConflict: 'url' })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to save brand:', error);
      return null;
    }
    
    console.log('✅ Brand saved to database:', profile.name);
    return data as StoredBrand;
  } catch (e) {
    console.error('Brand save error:', e);
    return null;
  }
};

/**
 * Retrieve a brand profile by URL
 */
export const getBrandByUrl = async (url: string): Promise<StoredBrand | null> => {
  const client = getSupabase();
  const normalisedUrl = url.toLowerCase().replace(/\/$/, '').replace(/^https?:\/\//, '');
  
  try {
    const { data, error } = await client
      .from('brands')
      .select('*')
      .eq('url', normalisedUrl)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - brand not found
        return null;
      }
      console.error('Brand lookup error:', error);
      return null;
    }
    
    return data as StoredBrand;
  } catch (e) {
    console.error('Brand fetch error:', e);
    return null;
  }
};

/**
 * List all saved brands
 */
export const listBrands = async (): Promise<StoredBrand[]> => {
  const client = getSupabase();
  
  try {
    const { data, error } = await client
      .from('brands')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Failed to list brands:', error);
      return [];
    }
    
    return data as StoredBrand[];
  } catch (e) {
    console.error('Brand list error:', e);
    return [];
  }
};

// ============================================================================
// BRAND ASSET OPERATIONS (Product/Service Images)
// ============================================================================

export interface BrandAsset {
  id: string;
  brand_id: string;
  url: string;
  label: string;
  asset_type: 'product' | 'hero' | 'lifestyle' | 'logo' | 'other';
  source_page?: string;
  created_at: string;
}

/**
 * Save discovered image assets for a brand
 */
export const saveBrandAssets = async (
  brandId: string, 
  assets: Array<{ url: string; label: string; type?: string }>
): Promise<number> => {
  const client = getSupabase();
  
  if (!assets || assets.length === 0) return 0;
  
  const assetRows = assets.map(asset => ({
    brand_id: brandId,
    url: asset.url,
    label: asset.label,
    asset_type: asset.type || 'product',
    created_at: new Date().toISOString(),
  }));
  
  try {
    const { data, error } = await client
      .from('brand_assets')
      .upsert(assetRows, { onConflict: 'brand_id,url' })
      .select();
    
    if (error) {
      console.error('Failed to save assets:', error);
      return 0;
    }
    
    console.log(`✅ Saved ${data?.length || 0} assets for brand`);
    return data?.length || 0;
  } catch (e) {
    console.error('Asset save error:', e);
    return 0;
  }
};

/**
 * Get all assets for a brand
 */
export const getBrandAssets = async (brandId: string): Promise<BrandAsset[]> => {
  const client = getSupabase();
  
  try {
    const { data, error } = await client
      .from('brand_assets')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Failed to get assets:', error);
      return [];
    }
    
    return data as BrandAsset[];
  } catch (e) {
    console.error('Asset fetch error:', e);
    return [];
  }
};

/**
 * Find a relevant asset for a specific product/service
 * Uses fuzzy matching to find images that match the content topic
 */
export const findRelevantAsset = async (
  brandId: string, 
  productOrService: string
): Promise<BrandAsset | null> => {
  const client = getSupabase();
  
  // Normalise search term
  const searchTerm = productOrService.toLowerCase();
  const keywords = searchTerm.split(/\s+/).filter(w => w.length > 2);
  
  try {
    const { data, error } = await client
      .from('brand_assets')
      .select('*')
      .eq('brand_id', brandId);
    
    if (error || !data || data.length === 0) {
      return null;
    }
    
    // Score each asset by keyword matches
    const scored = data.map(asset => {
      const label = asset.label.toLowerCase();
      const matchCount = keywords.filter(kw => label.includes(kw)).length;
      const exactMatch = label.includes(searchTerm) ? 10 : 0;
      return { asset, score: matchCount + exactMatch };
    });
    
    // Sort by score, return best match if score > 0
    scored.sort((a, b) => b.score - a.score);
    
    if (scored[0] && scored[0].score > 0) {
      console.log(`🎯 Found relevant asset for "${productOrService}":`, scored[0].asset.label);
      return scored[0].asset as BrandAsset;
    }
    
    // No good match - return a random product image as fallback
    const productAssets = data.filter(a => a.asset_type === 'product');
    if (productAssets.length > 0) {
      const random = productAssets[Math.floor(Math.random() * productAssets.length)];
      console.log(`🔄 Using random product asset:`, random.label);
      return random as BrandAsset;
    }
    
    return null;
  } catch (e) {
    console.error('Asset search error:', e);
    return null;
  }
};

// ============================================================================
// SAVED POSTS OPERATIONS
// ============================================================================

export interface SavedPost {
  id: string;
  brand_id: string;
  post_json: SocialPost;
  scheduled_date?: string;
  status: 'liked' | 'scheduled' | 'published';
  created_at: string;
}

/**
 * Save a liked post to the database
 */
export const savePost = async (brandId: string, post: SocialPost): Promise<SavedPost | null> => {
  const client = getSupabase();
  
  const postData = {
    brand_id: brandId,
    post_json: post,
    scheduled_date: post.scheduledDate,
    status: post.scheduledDate ? 'scheduled' : 'liked',
    created_at: new Date().toISOString(),
  };
  
  try {
    const { data, error } = await client
      .from('saved_posts')
      .insert(postData)
      .select()
      .single();
    
    if (error) {
      console.error('Failed to save post:', error);
      return null;
    }
    
    console.log('✅ Post saved to database');
    return data as SavedPost;
  } catch (e) {
    console.error('Post save error:', e);
    return null;
  }
};

/**
 * Get all saved posts for a brand
 */
export const getSavedPosts = async (brandId: string): Promise<SavedPost[]> => {
  const client = getSupabase();
  
  try {
    const { data, error } = await client
      .from('saved_posts')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Failed to get saved posts:', error);
      return [];
    }
    
    return data as SavedPost[];
  } catch (e) {
    console.error('Saved posts fetch error:', e);
    return [];
  }
};

/**
 * Update post schedule
 */
export const updatePostSchedule = async (postId: string, scheduledDate: string): Promise<boolean> => {
  const client = getSupabase();
  
  try {
    const { error } = await client
      .from('saved_posts')
      .update({ 
        scheduled_date: scheduledDate, 
        status: 'scheduled' 
      })
      .eq('id', postId);
    
    if (error) {
      console.error('Failed to update schedule:', error);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Schedule update error:', e);
    return false;
  }
};

// ============================================================================
// DATABASE SCHEMA CREATION (Run once on first setup)
// ============================================================================

// ============================================================================
// WORKSPACE OPERATIONS (Multi-Brand Support)
// ============================================================================

/**
 * Load complete workspace for a brand (profile + posts + assets)
 * Used when switching between brands
 */
export const loadBrandWorkspace = async (brandId: string): Promise<{
  brand: StoredBrand;
  posts: SavedPost[];
  assets: BrandAsset[];
} | null> => {
  const client = getSupabase();
  
  try {
    // Fetch brand
    const { data: brand, error: brandError } = await client
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single();
    
    if (brandError || !brand) {
      console.error('Failed to load brand:', brandError);
      return null;
    }
    
    // Fetch posts and assets in parallel
    const [postsResult, assetsResult] = await Promise.all([
      client.from('saved_posts').select('*').eq('brand_id', brandId).order('created_at', { ascending: false }),
      client.from('brand_assets').select('*').eq('brand_id', brandId).order('created_at', { ascending: false }),
    ]);
    
    const posts = (postsResult.data || []) as SavedPost[];
    const assets = (assetsResult.data || []) as BrandAsset[];
    
    console.log(`📦 Loaded workspace for ${brand.name}: ${posts.length} posts, ${assets.length} assets`);
    
    return {
      brand: brand as StoredBrand,
      posts,
      assets,
    };
  } catch (e) {
    console.error('Workspace load error:', e);
    return null;
  }
};

/**
 * Get count of saved posts for a brand
 */
export const getBrandPostCount = async (brandId: string): Promise<number> => {
  const client = getSupabase();
  
  try {
    const { count, error } = await client
      .from('saved_posts')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId);
    
    if (error) return 0;
    return count || 0;
  } catch (e) {
    return 0;
  }
};

/**
 * Delete a brand and all associated data (cascading delete)
 */
export const deleteBrand = async (brandId: string): Promise<boolean> => {
  const client = getSupabase();
  
  try {
    const { error } = await client
      .from('brands')
      .delete()
      .eq('id', brandId);
    
    if (error) {
      console.error('Failed to delete brand:', error);
      return false;
    }
    
    console.log('✅ Brand deleted:', brandId);
    return true;
  } catch (e) {
    console.error('Brand delete error:', e);
    return false;
  }
};

/**
 * SQL to create the required tables.
 * Run this in the Supabase SQL editor if tables don't exist.
 */
export const DATABASE_SCHEMA = `
-- Brands table: Stores analyzed brand profiles
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  profile_json JSONB NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brand Assets table: Stores scraped product/service images
CREATE TABLE IF NOT EXISTS brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT NOT NULL,
  asset_type TEXT DEFAULT 'product',
  source_page TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, url)
);

-- Saved Posts table: Stores liked/scheduled posts
CREATE TABLE IF NOT EXISTS saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  post_json JSONB NOT NULL,
  scheduled_date TIMESTAMPTZ,
  status TEXT DEFAULT 'liked',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_brands_url ON brands(url);
CREATE INDEX IF NOT EXISTS idx_brand_assets_brand_id ON brand_assets(brand_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_brand_id ON saved_posts(brand_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_scheduled ON saved_posts(scheduled_date);

-- Row Level Security (Optional - enable if needed)
-- ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE brand_assets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;
`;

/**
 * Check if tables exist and log status
 */
export const checkDatabaseSetup = async (): Promise<{
  brands: boolean;
  brand_assets: boolean;
  saved_posts: boolean;
}> => {
  const client = getSupabase();
  const results = { brands: false, brand_assets: false, saved_posts: false };
  
  try {
    // Check brands table
    const { error: brandsError } = await client.from('brands').select('count', { count: 'exact', head: true });
    results.brands = !brandsError;
    
    // Check brand_assets table
    const { error: assetsError } = await client.from('brand_assets').select('count', { count: 'exact', head: true });
    results.brand_assets = !assetsError;
    
    // Check saved_posts table
    const { error: postsError } = await client.from('saved_posts').select('count', { count: 'exact', head: true });
    results.saved_posts = !postsError;
    
    console.log('🗄️ Database status:', results);
    
    if (!results.brands || !results.brand_assets || !results.saved_posts) {
      console.warn('⚠️ Some tables missing. Run the schema SQL in Supabase dashboard.');
      console.log('Schema SQL:\n', DATABASE_SCHEMA);
    }
    
    return results;
  } catch (e) {
    console.error('Database check failed:', e);
    return results;
  }
};

