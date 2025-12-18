import { BrandProfile } from '../types';

/**
 * Pexels Image Search Service
 * 
 * Used as a fallback when AI image generation (Imagen) fails.
 * Searches for relevant stock photos based on brand context.
 */

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

// Log API key status
console.log('📷 Pexels API Key:', PEXELS_API_KEY ? '✅ Configured' : '❌ Not set');

/**
 * Check if Pexels is configured
 */
export const isPexelsConfigured = (): boolean => {
  return !!PEXELS_API_KEY;
};

/**
 * Search Pexels for a relevant image based on brand context and visual prompt
 * 
 * IMPORTANT: Industry and brand essence take PRIORITY over visual prompt.
 * This prevents off-brand images (e.g., cosmetics for a digital agency).
 * 
 * @param profile - Brand profile for context
 * @param visualPrompt - The visual description from content generation
 * @param orientation - Image orientation preference
 * @returns Image URL or undefined if not found
 */
export const searchPexelsImage = async (
  profile: BrandProfile,
  visualPrompt: string,
  orientation: 'landscape' | 'portrait' | 'square' = 'square'
): Promise<string | undefined> => {
  if (!PEXELS_API_KEY) {
    console.warn('⚠️ Pexels API key not configured');
    return undefined;
  }

  try {
    // PRIORITY 1: Get industry-specific search terms
    // This ensures we NEVER show cosmetics for a digital agency, etc.
    const industrySearchTerms = getIndustrySearchTerms(profile.industry);
    
    // PRIORITY 2: Extract relevant words from offerings (these ARE the brand)
    const offeringWords = (profile.services || [])
      .slice(0, 2)
      .join(' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 3);
    
    // PRIORITY 3: Only use visual prompt words that are GENERIC/SAFE
    // Avoid product-specific words that could lead to wrong industry images
    const safePromptWords = extractSafePromptWords(visualPrompt, profile.industry);
    
    // Build query with industry FIRST (most important)
    const searchTerms = [
      industrySearchTerms,
      ...offeringWords,
      ...safePromptWords,
    ].filter(Boolean);

    const query = searchTerms.join(' ').substring(0, 100); // Pexels query limit
    
    console.log(`🔍 Pexels search: "${query}" (Industry: ${profile.industry})"`);

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=${orientation}`,
      { 
        headers: { 
          Authorization: PEXELS_API_KEY 
        } 
      }
    );

    if (!response.ok) {
      console.error('Pexels API error:', response.status, response.statusText);
      return undefined;
    }

    const data = await response.json();
    
    if (!data.photos || data.photos.length === 0) {
      console.warn('No Pexels results for query:', query);
      
      // Try a broader fallback search with just the industry
      return await searchPexelsFallback(profile.industry, orientation);
    }

    // Return a random photo from the results for variety
    const randomIndex = Math.floor(Math.random() * Math.min(data.photos.length, 3));
    const photo = data.photos[randomIndex];
    
    // Select appropriate size based on orientation
    let imageUrl: string;
    if (orientation === 'portrait') {
      imageUrl = photo.src?.portrait || photo.src?.large2x || photo.src?.large;
    } else if (orientation === 'landscape') {
      imageUrl = photo.src?.landscape || photo.src?.large2x || photo.src?.large;
    } else {
      // Square - use large and let CSS handle it
      imageUrl = photo.src?.large || photo.src?.medium;
    }

    console.log(`✅ Pexels found image: ${photo.photographer} - ${photo.alt?.substring(0, 50)}...`);
    return imageUrl;

  } catch (error) {
    console.error('Pexels search failed:', error);
    return undefined;
  }
};

/**
 * Comprehensive industry to search terms mapping
 * These terms ensure Pexels returns RELEVANT images for each industry
 */
const INDUSTRY_SEARCH_TERMS: Record<string, string> = {
  // Digital & Tech
  'digital marketing': 'digital marketing laptop office workspace',
  'web development': 'coding developer computer programming',
  'digital marketing and web development': 'digital marketing laptop workspace modern',
  'technology': 'technology laptop computer modern office',
  'software': 'software developer coding screen',
  'it services': 'technology computer network server',
  'saas': 'software dashboard computer modern',
  'e-commerce': 'online shopping ecommerce website',
  
  // Professional Services
  'marketing': 'marketing team meeting creative office',
  'advertising': 'advertising campaign creative team',
  'consulting': 'business consulting meeting professional',
  'finance': 'finance business professional office charts',
  'legal': 'legal professional office documents',
  'accounting': 'accounting finance calculator documents',
  'real estate': 'property home architecture interior',
  
  // Retail & Products
  'athletic apparel and footwear': 'athletic shoes running sports fitness',
  'athletic': 'fitness sports running athlete',
  'footwear': 'shoes sneakers sports style',
  'fashion': 'fashion clothing style model runway',
  'beauty': 'beauty skincare cosmetics wellness',
  'retail': 'shopping retail store products display',
  'jewelry': 'jewelry accessories elegant luxury',
  
  // Travel & Hospitality
  'travel': 'travel vacation destination adventure beach',
  'travel & tourism': 'travel airport vacation journey holiday',
  'hospitality': 'hotel hospitality service luxury',
  'tourism': 'tourism sightseeing destination landmark',
  
  // Food & Beverage
  'food': 'food restaurant delicious meal dining',
  'restaurant': 'restaurant dining food chef cuisine',
  'beverage': 'coffee drinks beverage cafe',
  
  // Health & Wellness
  'health': 'health wellness medical fitness',
  'healthcare': 'healthcare medical doctor hospital',
  'fitness': 'fitness gym workout exercise training',
  'wellness': 'wellness spa relaxation meditation',
  
  // Education & Non-profit
  'education': 'education learning school classroom study',
  'non-profit': 'community charity volunteer helping',
  
  // Entertainment & Media
  'entertainment': 'entertainment media creative arts performance',
  'media': 'media production creative studio',
  'gaming': 'gaming esports controller technology',
  
  // Automotive & Transport
  'automotive': 'car vehicle automotive driving road',
  'transportation': 'transportation logistics vehicle shipping',
  
  // Manufacturing & Industrial
  'manufacturing': 'factory manufacturing industry production',
  'construction': 'construction building architecture engineering',
};

/**
 * Get the best search terms for an industry
 */
const getIndustrySearchTerms = (industry: string): string => {
  const lowerIndustry = industry.toLowerCase().trim();
  
  // Try exact match first
  if (INDUSTRY_SEARCH_TERMS[lowerIndustry]) {
    return INDUSTRY_SEARCH_TERMS[lowerIndustry];
  }
  
  // Try partial match
  for (const [key, terms] of Object.entries(INDUSTRY_SEARCH_TERMS)) {
    if (lowerIndustry.includes(key) || key.includes(lowerIndustry)) {
      return terms;
    }
  }
  
  // Default to the industry itself with "professional"
  return `${industry} professional business`;
};

/**
 * Extract SAFE words from visual prompt that won't lead to wrong industry
 * Filters out product-specific words that could cause irrelevant results
 */
const extractSafePromptWords = (visualPrompt: string, industry: string): string[] => {
  // Words that are SAFE for any industry (settings, moods, compositions)
  const safeWords = new Set([
    'modern', 'minimal', 'professional', 'clean', 'elegant', 'vibrant',
    'dynamic', 'creative', 'innovative', 'successful', 'happy', 'team',
    'workspace', 'office', 'meeting', 'collaboration', 'growth', 'success',
    'bright', 'colorful', 'dramatic', 'cinematic', 'aerial', 'closeup',
    'portrait', 'landscape', 'abstract', 'gradient', 'geometric',
  ]);
  
  // Words that should NEVER be used (lead to wrong results)
  const dangerousWords = new Set([
    'product', 'bottle', 'package', 'cosmetic', 'makeup', 'lipstick',
    'perfume', 'cream', 'serum', 'skincare', 'beauty', 'fashion',
    'shoe', 'sneaker', 'clothing', 'apparel', 'jewelry', 'watch',
    'food', 'meal', 'drink', 'coffee', 'restaurant',
  ]);
  
  // Don't exclude industry-relevant dangerous words
  const industryLower = industry.toLowerCase();
  const industryWords = industryLower.split(/\s+/);
  
  return visualPrompt
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => 
      word.length > 4 && 
      (safeWords.has(word) || industryWords.includes(word)) &&
      !dangerousWords.has(word)
    )
    .slice(0, 2);
};

/**
 * Fallback search with broader industry terms
 */
const searchPexelsFallback = async (
  industry: string,
  orientation: 'landscape' | 'portrait' | 'square'
): Promise<string | undefined> => {
  if (!PEXELS_API_KEY) return undefined;

  const fallbackQuery = getIndustrySearchTerms(industry);

  try {
    console.log(`🔄 Pexels fallback search: "${fallbackQuery}"`);
    
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(fallbackQuery)}&per_page=3&orientation=${orientation}`,
      { 
        headers: { 
          Authorization: PEXELS_API_KEY 
        } 
      }
    );

    if (!response.ok) return undefined;

    const data = await response.json();
    
    if (!data.photos || data.photos.length === 0) {
      return undefined;
    }

    const photo = data.photos[0];
    return photo.src?.large || photo.src?.medium;

  } catch (error) {
    console.error('Pexels fallback failed:', error);
    return undefined;
  }
};

/**
 * Get a curated image for specific use cases
 * Useful for known categories where we want consistent results
 */
export const getCuratedPexelsImage = async (
  category: 'product' | 'lifestyle' | 'abstract' | 'business' | 'social',
  orientation: 'landscape' | 'portrait' | 'square' = 'square'
): Promise<string | undefined> => {
  if (!PEXELS_API_KEY) return undefined;

  const categoryQueries: Record<string, string> = {
    'product': 'product photography minimal',
    'lifestyle': 'lifestyle people happy',
    'abstract': 'abstract gradient colorful',
    'business': 'business professional modern',
    'social': 'social media content creator',
  };

  const query = categoryQueries[category] || category;

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=${orientation}`,
      { 
        headers: { 
          Authorization: PEXELS_API_KEY 
        } 
      }
    );

    if (!response.ok) return undefined;

    const data = await response.json();
    
    if (!data.photos || data.photos.length === 0) {
      return undefined;
    }

    // Random selection for variety
    const randomIndex = Math.floor(Math.random() * data.photos.length);
    const photo = data.photos[randomIndex];
    return photo.src?.large || photo.src?.medium;

  } catch (error) {
    console.error('Curated Pexels search failed:', error);
    return undefined;
  }
};

