import React, { useState, useEffect } from 'react';
import { 
  Building2, Plus, RefreshCw, RotateCcw, Trash2, Loader2, 
  Calendar, ImageIcon, Clock, ChevronRight, Sparkles, AlertCircle, CheckCircle2
} from 'lucide-react';
import { StoredBrand, listBrands, getBrandPostCount, deleteBrand } from '../services/supabaseService';
import { PendingAnalysis, AppNotification } from '../types';

interface BrandSelectorProps {
  onSelectBrand: (brand: StoredBrand) => void;
  onNewBrand: () => void;
  onHardRefresh: (brand: StoredBrand) => void;
  onSoftRefresh: (brand: StoredBrand) => void;
  pendingAnalyses?: Map<string, PendingAnalysis>;
  onPendingAnalysisClick?: (notification: AppNotification) => void;
}

const BrandSelector: React.FC<BrandSelectorProps> = ({
  onSelectBrand,
  onNewBrand,
  onHardRefresh,
  onSoftRefresh,
  pendingAnalyses = new Map(),
  onPendingAnalysisClick,
}) => {
  const [brands, setBrands] = useState<StoredBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const [refreshingBrand, setRefreshingBrand] = useState<string | null>(null);
  const [deletingBrand, setDeletingBrand] = useState<string | null>(null);

  // Helper to normalise URLs for matching
  const normaliseUrl = (url: string): string => {
    return url.toLowerCase().replace(/\/$/, '').replace(/^https?:\/\//, '');
  };

  // Get status bar colour based on pending analysis state
  const getStatusBarStyle = (brand: StoredBrand): { color: string; animate: boolean; status?: string } => {
    const normalisedUrl = normaliseUrl(brand.url);
    const pending = pendingAnalyses.get(normalisedUrl);
    
    if (!pending) {
      // No pending analysis - use brand colour (normal state)
      return { color: getBrandColor(brand), animate: false };
    }
    
    switch (pending.status) {
      case 'complete':
        return { color: '#22c55e', animate: false, status: 'complete' };  // Green
      case 'analysing':
        return { color: '#f59e0b', animate: true, status: 'analysing' };   // Amber (pulsing)
      case 'starting':
        return { color: '#ef4444', animate: true, status: 'starting' };    // Red (pulsing)
      case 'error':
        return { color: '#ef4444', animate: false, status: 'error' };      // Red (static)
      default:
        return { color: getBrandColor(brand), animate: false };
    }
  };

  // Get pending analysis for a URL (for cards without saved brands yet)
  const getPendingForUrl = (url: string): PendingAnalysis | undefined => {
    return pendingAnalyses.get(normaliseUrl(url));
  };

  // Load brands on mount
  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    setLoading(true);
    const allBrands = await listBrands();
    setBrands(allBrands);
    
    // Fetch post counts for each brand
    const counts: Record<string, number> = {};
    await Promise.all(
      allBrands.map(async (brand) => {
        counts[brand.id] = await getBrandPostCount(brand.id);
      })
    );
    setPostCounts(counts);
    setLoading(false);
  };

  const handleDelete = async (brandId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this brand and all its saved posts?')) return;
    
    setDeletingBrand(brandId);
    const success = await deleteBrand(brandId);
    if (success) {
      setBrands(prev => prev.filter(b => b.id !== brandId));
    }
    setDeletingBrand(null);
  };

  const handleSoftRefresh = async (brand: StoredBrand, e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshingBrand(brand.id);
    await onSoftRefresh(brand);
    setRefreshingBrand(null);
  };

  const handleHardRefresh = (brand: StoredBrand, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Re-analyze this brand from scratch? Saved posts will be kept.')) {
      onHardRefresh(brand);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  // Get primary color from brand profile
  const getBrandColor = (brand: StoredBrand): string => {
    const colors = brand.profile_json?.colors || [];
    return colors[0] || '#6366f1';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your brands...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6 md:p-10">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">FlySolo</h1>
          </div>
          <button
            onClick={onNewBrand}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">New Brand</span>
          </button>
        </div>
        <p className="text-gray-500">Select a brand to continue or start fresh</p>
      </div>

      {/* Brand Grid */}
      <div className="max-w-6xl mx-auto">
        {brands.length === 0 ? (
          // Empty state
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-10 h-10 text-gray-600" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No brands yet</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Analyze your first brand to start generating AI-powered social media content
            </p>
            <button
              onClick={onNewBrand}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
            >
              <Plus size={20} />
              Analyze Your First Brand
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Pending Analysis Cards (for brands being analyzed that aren't saved yet) */}
            {Array.from(pendingAnalyses.entries())
              .filter(([url, pending]) => !brands.some(b => normaliseUrl(b.url) === url))
              .map(([url, pending]) => (
                <div
                  key={pending.id}
                  onClick={() => {
                    if (pending.status === 'complete' && onPendingAnalysisClick) {
                      onPendingAnalysisClick({
                        id: pending.id,
                        type: 'analysis_complete',
                        title: `${pending.brandName || 'Brand'} is ready!`,
                        message: 'Tap to view your brand DNA.',
                        brandUrl: url,
                        createdAt: pending.completedAt || new Date(),
                        read: false,
                      });
                    }
                  }}
                  className={`group relative bg-gray-900 border border-gray-800 rounded-2xl p-5 ${
                    pending.status === 'complete' ? 'cursor-pointer hover:border-gray-700 hover:shadow-xl' : ''
                  } transition-all duration-200`}
                >
                  {/* Status bar */}
                  <div 
                    className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl transition-colors ${
                      pending.status === 'analysing' || pending.status === 'starting' ? 'animate-pulse' : ''
                    }`}
                    style={{ 
                      backgroundColor: pending.status === 'complete' ? '#22c55e' : 
                                       pending.status === 'error' ? '#ef4444' : '#f59e0b'
                    }}
                  />

                  {/* Status Badge */}
                  <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full ${
                    pending.status === 'complete' ? 'bg-green-500/20' :
                    pending.status === 'error' ? 'bg-red-500/20' : 'bg-amber-500/20'
                  }`}>
                    {pending.status === 'complete' ? (
                      <>
                        <CheckCircle2 size={12} className="text-green-400" />
                        <span className="text-xs text-green-400 font-medium">Ready</span>
                      </>
                    ) : pending.status === 'error' ? (
                      <>
                        <AlertCircle size={12} className="text-red-400" />
                        <span className="text-xs text-red-400 font-medium">Error</span>
                      </>
                    ) : (
                      <>
                        <Loader2 size={12} className="animate-spin text-amber-400" />
                        <span className="text-xs text-amber-400 font-medium">Analysing...</span>
                      </>
                    )}
                  </div>

                  {/* Pending Brand Header */}
                  <div className="flex items-start gap-4 mb-4 mt-2">
                    <div className="w-14 h-14 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
                      {pending.status === 'analysing' || pending.status === 'starting' ? (
                        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
                      ) : pending.status === 'complete' ? (
                        <CheckCircle2 className="w-7 h-7 text-green-400" />
                      ) : (
                        <AlertCircle className="w-7 h-7 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white truncate">
                        {pending.brandName || 'Analysing brand...'}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">{url}</p>
                    </div>
                    {pending.status === 'complete' && (
                      <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-green-400 transition-colors flex-shrink-0" />
                    )}
                  </div>

                  {/* Error message */}
                  {pending.status === 'error' && pending.error && (
                    <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2 mb-4">
                      {pending.error}
                    </p>
                  )}
                </div>
              ))}

            {/* Saved Brand Cards */}
            {brands.map((brand) => {
              const statusBar = getStatusBarStyle(brand);
              const pending = getPendingForUrl(brand.url);
              
              return (
              <div
                key={brand.id}
                onClick={() => {
                  if (pending?.status === 'complete' && onPendingAnalysisClick) {
                    // If there's a completed pending analysis, handle it
                    onPendingAnalysisClick({
                      id: pending.id,
                      type: 'analysis_complete',
                      title: `${pending.brandName || brand.name} is ready!`,
                      message: 'Tap to view your brand DNA.',
                      brandUrl: normaliseUrl(brand.url),
                      createdAt: pending.completedAt || new Date(),
                      read: false,
                    });
                  } else {
                    onSelectBrand(brand);
                  }
                }}
                className="group relative bg-gray-900 border border-gray-800 rounded-2xl p-5 cursor-pointer hover:border-gray-700 hover:shadow-xl transition-all duration-200"
              >
                {/* Status-aware accent bar */}
                <div 
                  className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl transition-colors ${
                    statusBar.animate ? 'animate-pulse' : ''
                  }`}
                  style={{ backgroundColor: statusBar.color }}
                />

                {/* Status Badge for pending analyses */}
                {statusBar.status === 'analysing' && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/20 rounded-full">
                    <Loader2 size={12} className="animate-spin text-amber-400" />
                    <span className="text-xs text-amber-400 font-medium">Analysing...</span>
                  </div>
                )}
                {statusBar.status === 'complete' && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 bg-green-500/20 rounded-full">
                    <CheckCircle2 size={12} className="text-green-400" />
                    <span className="text-xs text-green-400 font-medium">Ready</span>
                  </div>
                )}
                {statusBar.status === 'error' && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 rounded-full">
                    <AlertCircle size={12} className="text-red-400" />
                    <span className="text-xs text-red-400 font-medium">Error</span>
                  </div>
                )}
                {statusBar.status === 'starting' && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 rounded-full">
                    <Loader2 size={12} className="animate-spin text-red-400" />
                    <span className="text-xs text-red-400 font-medium">Starting...</span>
                  </div>
                )}

                {/* Brand Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={{ backgroundColor: `${getBrandColor(brand)}20` }}
                  >
                    {brand.logo_url ? (
                      <img 
                        src={brand.logo_url} 
                        alt={brand.name} 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Building2 
                        className="w-7 h-7" 
                        style={{ color: getBrandColor(brand) }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                      {brand.name}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">{brand.industry}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-1" />
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-gray-500" />
                    <span>{postCounts[brand.id] || 0} posts</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-gray-500" />
                    <span>{formatDate(brand.updated_at)}</span>
                  </div>
                </div>

                {/* Color Palette Preview */}
                <div className="flex gap-1.5 mb-4">
                  {(brand.profile_json?.colors || []).slice(0, 5).map((color, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full border border-white/10"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-800">
                  <button
                    onClick={(e) => handleSoftRefresh(brand, e)}
                    disabled={refreshingBrand === brand.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Soft refresh - look for new data"
                  >
                    {refreshingBrand === brand.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={(e) => handleHardRefresh(brand, e)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                    title="Hard refresh - re-analyze from scratch"
                  >
                    <RotateCcw size={14} />
                    <span>Re-analyze</span>
                  </button>
                  <button
                    onClick={(e) => handleDelete(brand.id, e)}
                    disabled={deletingBrand === brand.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-auto disabled:opacity-50"
                    title="Delete brand"
                  >
                    {deletingBrand === brand.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            );
            })}

            {/* Add New Brand Card */}
            <div
              onClick={onNewBrand}
              className="group bg-gray-900/50 border border-dashed border-gray-700 rounded-2xl p-5 cursor-pointer hover:border-indigo-500 hover:bg-gray-900 transition-all duration-200 flex flex-col items-center justify-center min-h-[220px]"
            >
              <div className="w-14 h-14 rounded-xl bg-gray-800 group-hover:bg-indigo-500/20 flex items-center justify-center mb-4 transition-colors">
                <Plus className="w-7 h-7 text-gray-500 group-hover:text-indigo-400 transition-colors" />
              </div>
              <h3 className="text-lg font-medium text-gray-400 group-hover:text-white transition-colors">
                Add New Brand
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Analyze another website
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BrandSelector;

