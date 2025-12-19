export interface BrandProfile {
  name: string;
  industry: string;
  colors: string[];
  vibe: string;
  competitors: string[];
  strategy: string;
  products: string; // Broad description
  services: string[]; // Specific list of 5-20 items (e.g. "Bali Tour", "Flight Booking")
  imageAssets?: Array<{ url: string; label: string }>; // Scraped images mapped to products
  socialHandles?: string[]; // URLs or handles found (Optional)
  visualStyle: string; // Art direction
  essence?: string; // One-line summary of what the business does
  confidence?: number; // 0-100 score on data quality
  logoUrl?: string; // URL to official company logo
  assets?: string[]; // List of detected product/brand image URLs
}

export interface SocialPost {
  id: string;
  platform: 'Instagram' | 'LinkedIn' | 'Twitter/X' | 'TikTok';
  caption: string;
  hashtags: string[];
  visualPrompt: string;
  imageUrl?: string; // Base64 or URL
  status: 'pending' | 'generating_image' | 'ready' | 'liked' | 'discarded';
  scheduledDate?: string; // ISO String
  // Video fields for animated content
  videoUrl?: string; // URL to generated video
  videoStatus?: 'pending' | 'generating' | 'ready' | 'failed';
  videoOperationName?: string; // For polling VEO status
}

export enum AppState {
  BRAND_SELECTOR = 'BRAND_SELECTOR',  // Landing page showing all saved brands
  ONBOARDING = 'ONBOARDING',
  ANALYZING = 'ANALYZING',
  SWIPING = 'SWIPING',
  EDITOR = 'EDITOR',
  CALENDAR = 'CALENDAR',
  DASHBOARD = 'DASHBOARD'
}

export interface AnalysisStage {
  label: string;
  status: 'waiting' | 'loading' | 'done' | 'error';
}

export interface AnalysisError {
  message: string;
  type: 'validation' | 'network' | 'analysis';
}

// ============================================================================
// BACKGROUND ANALYSIS & NOTIFICATION SYSTEM
// ============================================================================

/**
 * Status of a background brand analysis
 */
export type AnalysisStatus = 'idle' | 'starting' | 'analysing' | 'complete' | 'error';

/**
 * Tracks a brand analysis running in the background
 */
export interface PendingAnalysis {
  id: string;
  url: string;
  brandName?: string;        // Populated once known from analysis
  status: AnalysisStatus;
  progress: number;          // 0-100
  startedAt: Date;
  completedAt?: Date;
  profile?: BrandProfile;    // Populated on completion
  posts?: SocialPost[];      // Populated on completion
  error?: string;            // Error message if failed
}

/**
 * Notification types for the app
 */
export type NotificationType = 'analysis_complete' | 'analysis_failed' | 'video_ready';

/**
 * App notification displayed in the notification bell and toast
 */
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  brandId?: string;
  brandUrl?: string;
  createdAt: Date;
  read: boolean;
}
