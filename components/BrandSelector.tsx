import React, { useState, useEffect } from 'react';
import { 
  Building2, Plus, RefreshCw, RotateCcw, Trash2, Loader2, 
  Calendar, ImageIcon, Clock, ChevronRight, Sparkles
} from 'lucide-react';
import { StoredBrand, listBrands, getBrandPostCount, deleteBrand } from '../services/supabaseService';

interface BrandSelectorProps {
  onSelectBrand: (brand: StoredBrand) => void;
  onNewBrand: () => void;
  onHardRefresh: (brand: StoredBrand) => void;
  onSoftRefresh: (brand: StoredBrand) => void;
}

const BrandSelector: React.FC<BrandSelectorProps> = ({
  onSelectBrand,
  onNewBrand,
  onHardRefresh,
  onSoftRefresh,
}) => {
  const [brands, setBrands] = useState<StoredBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const [refreshingBrand, setRefreshingBrand] = useState<string | null>(null);
  const [deletingBrand, setDeletingBrand] = useState<string | null>(null);

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
            {brands.map((brand) => (
              <div
                key={brand.id}
                onClick={() => onSelectBrand(brand)}
                className="group relative bg-gray-900 border border-gray-800 rounded-2xl p-5 cursor-pointer hover:border-gray-700 hover:shadow-xl transition-all duration-200"
              >
                {/* Color accent bar */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                  style={{ backgroundColor: getBrandColor(brand) }}
                />

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
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
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
            ))}

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

