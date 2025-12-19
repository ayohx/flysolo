/**
 * Logo Service - Reliable company logo fetching
 * 
 * Priority chain:
 * 1. Logo.dev API (if configured) - highest quality
 * 2. Google Favicon API (free, always works)
 * 3. Returns null for initials fallback
 */

// Environment variable for Logo.dev API key (optional)
const LOGO_DEV_API_KEY = import.meta.env.VITE_LOGO_DEV_API_KEY || '';

/**
 * Extract domain from a URL
 * e.g., "https://www.nike.com/gb/running" → "nike.com"
 */
export const extractDomain = (url: string): string => {
  try {
    // Add protocol if missing
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    
    const urlObj = new URL(cleanUrl);
    let domain = urlObj.hostname;
    
    // Remove 'www.' prefix
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    
    return domain;
  } catch (error) {
    console.warn('Failed to extract domain from URL:', url, error);
    // Fallback: try to extract domain from string directly
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/);
    return match ? match[1] : url;
  }
};

/**
 * Get logo URL using Logo.dev API
 * Returns high-quality company logos
 * Free tier: 1,000 requests/month
 */
export const getLogoDev = (domain: string): string | null => {
  if (!LOGO_DEV_API_KEY) {
    return null;
  }
  
  return `https://img.logo.dev/${domain}?token=${LOGO_DEV_API_KEY}&format=png`;
};

/**
 * Get favicon URL using Google's Favicon API
 * Always works, but returns favicons (not full logos)
 * Free and unlimited
 */
export const getGoogleFavicon = (domain: string, size: number = 128): string => {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
};

/**
 * Get the best available logo URL for a domain
 * Tries multiple sources in order of quality
 */
export const getLogoUrl = async (urlOrDomain: string): Promise<string | null> => {
  const domain = extractDomain(urlOrDomain);
  
  console.log(`🖼️ Fetching logo for domain: ${domain}`);
  
  // Option 1: Logo.dev (highest quality)
  if (LOGO_DEV_API_KEY) {
    const logoDevUrl = getLogoDev(domain);
    if (logoDevUrl) {
      // Verify the logo exists
      try {
        const response = await fetch(logoDevUrl, { method: 'HEAD' });
        if (response.ok) {
          console.log(`✅ Logo.dev returned logo for ${domain}`);
          return logoDevUrl;
        }
      } catch (error) {
        console.warn(`Logo.dev failed for ${domain}:`, error);
      }
    }
  }
  
  // Option 2: Google Favicon (always works)
  const faviconUrl = getGoogleFavicon(domain, 128);
  console.log(`📌 Using Google Favicon for ${domain}`);
  return faviconUrl;
};

/**
 * Get logo URL synchronously (no validation)
 * Use when you need immediate URL without async check
 */
export const getLogoUrlSync = (urlOrDomain: string): string => {
  const domain = extractDomain(urlOrDomain);
  
  // Prefer Logo.dev if configured
  if (LOGO_DEV_API_KEY) {
    return `https://img.logo.dev/${domain}?token=${LOGO_DEV_API_KEY}&format=png`;
  }
  
  // Fallback to Google Favicon
  return getGoogleFavicon(domain, 128);
};

/**
 * Check if Logo.dev API is configured
 */
export const hasLogoDevApi = (): boolean => {
  return !!LOGO_DEV_API_KEY;
};

/**
 * Get brand initials for fallback display
 * e.g., "Holiday Extras" → "HE", "Nike" → "NI"
 */
export const getBrandInitials = (brandName: string): string => {
  if (!brandName) return '??';
  
  const words = brandName.trim().split(/\s+/);
  
  if (words.length === 1) {
    // Single word: take first two letters
    return words[0].substring(0, 2).toUpperCase();
  }
  
  // Multiple words: take first letter of first two words
  return (words[0][0] + words[1][0]).toUpperCase();
};

export default {
  extractDomain,
  getLogoUrl,
  getLogoUrlSync,
  getGoogleFavicon,
  getLogoDev,
  hasLogoDevApi,
  getBrandInitials,
};

