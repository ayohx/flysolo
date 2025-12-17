export interface BrandProfile {
  name: string;
  industry: string;
  colors: string[];
  vibe: string;
  competitors: string[];
  strategy: string;
  products: string; // Broad description
  services: string[]; // Specific list of 5-20 items (e.g. "Bali Tour", "Flight Booking")
  socialHandles?: string[]; // URLs or handles found (Optional)
  visualStyle: string; // Art direction
  essence?: string; // One-line summary of what the business does
  confidence?: number; // 0-100 score on data quality
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
