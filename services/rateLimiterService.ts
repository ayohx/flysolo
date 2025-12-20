/**
 * Rate Limiter Service for FlySolo
 * 
 * Handles request throttling to avoid 429 (Too Many Requests) errors from
 * Google's Gemini and Imagen APIs.
 * 
 * API Rate Limits (approximate):
 * - Gemini Flash: 15-60 RPM (requests per minute) depending on tier
 * - Imagen 3/4: 2-10 RPM (much stricter)
 * - VEO: 2-5 RPM
 * 
 * This service implements:
 * 1. Request queuing with priority levels
 * 2. Configurable rate limits per API type
 * 3. Automatic retry with exponential backoff on 429 errors
 * 4. Request staggering to spread load over time
 */

export type ApiType = 'gemini' | 'imagen' | 'veo';

interface QueuedRequest<T> {
  id: string;
  apiType: ApiType;
  priority: number; // Lower = higher priority
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  retries: number;
  maxRetries: number;
  addedAt: number;
}

interface RateLimitConfig {
  requestsPerMinute: number;
  minDelayMs: number; // Minimum delay between requests
  maxConcurrent: number; // Max concurrent requests
  retryDelayMs: number; // Base delay for retries (exponential)
}

// Conservative rate limits to avoid 429s
const RATE_LIMITS: Record<ApiType, RateLimitConfig> = {
  gemini: {
    requestsPerMinute: 30, // Conservative: actual limit may be 60
    minDelayMs: 2000, // 2 seconds between requests
    maxConcurrent: 2,
    retryDelayMs: 5000,
  },
  imagen: {
    requestsPerMinute: 5, // Very conservative for image generation
    minDelayMs: 12000, // 12 seconds between requests
    maxConcurrent: 1, // Only 1 at a time
    retryDelayMs: 15000,
  },
  veo: {
    requestsPerMinute: 3, // Video generation is most limited
    minDelayMs: 20000, // 20 seconds between requests
    maxConcurrent: 1,
    retryDelayMs: 30000,
  },
};

class RateLimiter {
  private queues: Map<ApiType, QueuedRequest<any>[]> = new Map();
  private processing: Map<ApiType, boolean> = new Map();
  private lastRequestTime: Map<ApiType, number> = new Map();
  private activeRequests: Map<ApiType, number> = new Map();
  private requestCountWindow: Map<ApiType, number[]> = new Map(); // Timestamps of recent requests
  
  constructor() {
    // Initialise queues for each API type
    for (const apiType of Object.keys(RATE_LIMITS) as ApiType[]) {
      this.queues.set(apiType, []);
      this.processing.set(apiType, false);
      this.lastRequestTime.set(apiType, 0);
      this.activeRequests.set(apiType, 0);
      this.requestCountWindow.set(apiType, []);
    }
    
    console.log('🚦 Rate limiter initialised with limits:', RATE_LIMITS);
  }
  
  /**
   * Queue a request for rate-limited execution
   */
  async enqueue<T>(
    apiType: ApiType,
    execute: () => Promise<T>,
    options: {
      priority?: number; // 0 = highest, 10 = lowest
      maxRetries?: number;
    } = {}
  ): Promise<T> {
    const { priority = 5, maxRetries = 3 } = options;
    
    return new Promise((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: crypto.randomUUID(),
        apiType,
        priority,
        execute,
        resolve,
        reject,
        retries: 0,
        maxRetries,
        addedAt: Date.now(),
      };
      
      // Add to queue and sort by priority
      const queue = this.queues.get(apiType)!;
      queue.push(request);
      queue.sort((a, b) => a.priority - b.priority);
      
      console.log(`📥 Request queued for ${apiType} (queue length: ${queue.length}, priority: ${priority})`);
      
      // Start processing if not already
      this.processQueue(apiType);
    });
  }
  
  /**
   * Process the queue for a specific API type
   */
  private async processQueue(apiType: ApiType): Promise<void> {
    if (this.processing.get(apiType)) return;
    
    this.processing.set(apiType, true);
    const queue = this.queues.get(apiType)!;
    const config = RATE_LIMITS[apiType];
    
    while (queue.length > 0) {
      // Check if we can make a request
      const canProceed = this.canMakeRequest(apiType);
      
      if (!canProceed) {
        // Wait before checking again
        const waitTime = this.getWaitTime(apiType);
        console.log(`⏳ ${apiType}: Waiting ${Math.round(waitTime / 1000)}s before next request...`);
        await this.sleep(waitTime);
        continue;
      }
      
      // Get next request from queue
      const request = queue.shift();
      if (!request) break;
      
      // Track active request
      this.activeRequests.set(apiType, (this.activeRequests.get(apiType) || 0) + 1);
      
      try {
        console.log(`🚀 ${apiType}: Executing request ${request.id.slice(0, 8)}...`);
        
        // Record request time
        this.recordRequest(apiType);
        
        // Execute the request
        const result = await request.execute();
        
        // Success!
        request.resolve(result);
        console.log(`✅ ${apiType}: Request ${request.id.slice(0, 8)} succeeded`);
        
      } catch (error: any) {
        // Check if it's a rate limit error
        if (this.is429Error(error)) {
          console.warn(`⚠️ ${apiType}: 429 Rate limit hit, will retry request ${request.id.slice(0, 8)}`);
          
          if (request.retries < request.maxRetries) {
            // Retry with exponential backoff
            request.retries++;
            const retryDelay = config.retryDelayMs * Math.pow(2, request.retries - 1);
            
            console.log(`🔄 Retry ${request.retries}/${request.maxRetries} in ${Math.round(retryDelay / 1000)}s`);
            
            // Add back to queue with higher priority for retry
            request.priority = Math.max(0, request.priority - 1);
            queue.unshift(request);
            queue.sort((a, b) => a.priority - b.priority);
            
            // Wait before retry
            await this.sleep(retryDelay);
          } else {
            console.error(`❌ ${apiType}: Request ${request.id.slice(0, 8)} failed after ${request.maxRetries} retries`);
            request.reject(error);
          }
        } else {
          // Non-429 error, reject immediately
          console.error(`❌ ${apiType}: Request ${request.id.slice(0, 8)} failed:`, error.message);
          request.reject(error);
        }
      } finally {
        // Decrement active requests
        this.activeRequests.set(apiType, (this.activeRequests.get(apiType) || 1) - 1);
      }
      
      // Minimum delay between requests
      await this.sleep(config.minDelayMs);
    }
    
    this.processing.set(apiType, false);
  }
  
  /**
   * Check if we can make a request (within rate limits)
   */
  private canMakeRequest(apiType: ApiType): boolean {
    const config = RATE_LIMITS[apiType];
    const active = this.activeRequests.get(apiType) || 0;
    
    // Check concurrent limit
    if (active >= config.maxConcurrent) {
      return false;
    }
    
    // Check requests per minute
    const now = Date.now();
    const windowStart = now - 60000; // Last 60 seconds
    const timestamps = this.requestCountWindow.get(apiType) || [];
    const recentRequests = timestamps.filter(t => t > windowStart);
    this.requestCountWindow.set(apiType, recentRequests);
    
    if (recentRequests.length >= config.requestsPerMinute) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Calculate wait time before next request is allowed
   */
  private getWaitTime(apiType: ApiType): number {
    const config = RATE_LIMITS[apiType];
    const now = Date.now();
    const windowStart = now - 60000;
    const timestamps = this.requestCountWindow.get(apiType) || [];
    const recentRequests = timestamps.filter(t => t > windowStart);
    
    if (recentRequests.length >= config.requestsPerMinute) {
      // Wait until oldest request expires from window
      const oldestRequest = Math.min(...recentRequests);
      return (oldestRequest + 60000) - now + 1000; // +1s buffer
    }
    
    // Otherwise just wait minimum delay
    const lastRequest = this.lastRequestTime.get(apiType) || 0;
    const timeSinceLastRequest = now - lastRequest;
    
    if (timeSinceLastRequest < config.minDelayMs) {
      return config.minDelayMs - timeSinceLastRequest;
    }
    
    return 0;
  }
  
  /**
   * Record a request timestamp
   */
  private recordRequest(apiType: ApiType): void {
    const now = Date.now();
    this.lastRequestTime.set(apiType, now);
    
    const timestamps = this.requestCountWindow.get(apiType) || [];
    timestamps.push(now);
    this.requestCountWindow.set(apiType, timestamps);
  }
  
  /**
   * Check if an error is a 429 rate limit error
   */
  private is429Error(error: any): boolean {
    if (!error) return false;
    
    const message = error.message?.toLowerCase() || '';
    const status = error.status || error.code || error.statusCode;
    
    return (
      status === 429 ||
      status === '429' ||
      message.includes('429') ||
      message.includes('too many requests') ||
      message.includes('rate limit') ||
      message.includes('quota exceeded') ||
      message.includes('resource exhausted')
    );
  }
  
  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get current queue status (for debugging/UI)
   */
  getStatus(): Record<ApiType, { queueLength: number; activeRequests: number; requestsInLastMinute: number }> {
    const status: Record<string, any> = {};
    const now = Date.now();
    const windowStart = now - 60000;
    
    for (const apiType of Object.keys(RATE_LIMITS) as ApiType[]) {
      const queue = this.queues.get(apiType) || [];
      const active = this.activeRequests.get(apiType) || 0;
      const timestamps = this.requestCountWindow.get(apiType) || [];
      const recentRequests = timestamps.filter(t => t > windowStart);
      
      status[apiType] = {
        queueLength: queue.length,
        activeRequests: active,
        requestsInLastMinute: recentRequests.length,
      };
    }
    
    return status as Record<ApiType, any>;
  }
  
  /**
   * Clear all queues (e.g., when switching brands)
   */
  clearQueues(): void {
    for (const apiType of Object.keys(RATE_LIMITS) as ApiType[]) {
      const queue = this.queues.get(apiType) || [];
      // Reject all pending requests
      for (const request of queue) {
        request.reject(new Error('Queue cleared'));
      }
      this.queues.set(apiType, []);
    }
    console.log('🧹 All rate limiter queues cleared');
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Convenience wrappers
export const queueGeminiRequest = <T>(
  execute: () => Promise<T>,
  priority: number = 5
): Promise<T> => {
  return rateLimiter.enqueue('gemini', execute, { priority });
};

export const queueImagenRequest = <T>(
  execute: () => Promise<T>,
  priority: number = 5
): Promise<T> => {
  return rateLimiter.enqueue('imagen', execute, { priority });
};

export const queueVeoRequest = <T>(
  execute: () => Promise<T>,
  priority: number = 5
): Promise<T> => {
  return rateLimiter.enqueue('veo', execute, { priority });
};

export default rateLimiter;

