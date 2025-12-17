import React, { useState, useCallback } from 'react';
import { BrandProfile } from '../types';
import { 
  Building2, Palette, Globe, Tag, Sparkles, Save, Plus, Link, Loader2, 
  Instagram, Linkedin, Twitter, AtSign, CheckCircle2, Youtube, Facebook,
  ChevronDown, ChevronUp, X, Music2, Globe2, Pencil
} from 'lucide-react';

interface BrandInfoCardProps {
  profile: BrandProfile;
  onUpdate: (updatedProfile: BrandProfile) => void;
  onAddSource: (url: string) => void;
  isMerging: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Platform detection with icons and names
const detectPlatform = (handle: string): { name: string; icon: React.ReactNode; color: string } => {
  const lower = handle.toLowerCase();
  if (lower.includes('instagram') || lower.includes('insta')) 
    return { name: 'Instagram', icon: <Instagram size={14} />, color: 'text-pink-400' };
  if (lower.includes('linkedin')) 
    return { name: 'LinkedIn', icon: <Linkedin size={14} />, color: 'text-blue-400' };
  if (lower.includes('twitter') || lower.includes('x.com')) 
    return { name: 'X (Twitter)', icon: <Twitter size={14} />, color: 'text-sky-400' };
  if (lower.includes('tiktok')) 
    return { name: 'TikTok', icon: <Music2 size={14} />, color: 'text-cyan-400' };
  if (lower.includes('facebook') || lower.includes('fb.com')) 
    return { name: 'Facebook', icon: <Facebook size={14} />, color: 'text-blue-500' };
  if (lower.includes('youtube') || lower.includes('youtu.be')) 
    return { name: 'YouTube', icon: <Youtube size={14} />, color: 'text-red-500' };
  if (lower.includes('pinterest')) 
    return { name: 'Pinterest', icon: <Globe2 size={14} />, color: 'text-red-400' };
  if (lower.includes('threads')) 
    return { name: 'Threads', icon: <AtSign size={14} />, color: 'text-white' };
  return { name: 'Social', icon: <AtSign size={14} />, color: 'text-gray-400' };
};

// Format handle for display
const formatHandle = (handle: string) => {
  if (handle.startsWith('http')) {
    try {
      const url = new URL(handle);
      const path = url.pathname.replace(/^\//, '').replace(/\/$/, '');
      const extracted = path.split('/').pop() || path;
      return '@' + extracted;
    } catch {
      return handle;
    }
  }
  if (handle.startsWith('@')) return handle;
  return '@' + handle;
};

const BrandInfoCard: React.FC<BrandInfoCardProps> = ({ 
  profile, onUpdate, onAddSource, isMerging, isCollapsed = false, onToggleCollapse 
}) => {
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<BrandProfile>(profile);
  
  // New social/colour add states
  const [showAddSocial, setShowAddSocial] = useState(false);
  const [newSocialUrl, setNewSocialUrl] = useState('');
  const [showAddColour, setShowAddColour] = useState(false);
  const [newColour, setNewColour] = useState('#6366f1');
  
  // Collapsible sections - OFFERINGS and STRATEGY now expanded by default
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    essence: true,
    social: true,
    palette: true,
    offerings: true,  // FIX: Changed from false to true - users need to see this!
    strategy: true,   // FIX: Changed from false to true - critical for content generation
  });

  // Sync when prop updates
  React.useEffect(() => {
    setEditedProfile(profile);
  }, [profile]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleSave = () => {
    onUpdate(editedProfile);
    setIsEditing(false);
  };

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSourceUrl.trim()) {
      onAddSource(newSourceUrl);
      setNewSourceUrl('');
    }
  };

  const handleAddSocial = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSocialUrl.trim()) {
      const updatedHandles = [...(editedProfile.socialHandles || []), newSocialUrl.trim()];
      const updated = { ...editedProfile, socialHandles: updatedHandles };
      setEditedProfile(updated);
      onUpdate(updated);
      setNewSocialUrl('');
      setShowAddSocial(false);
    }
  };

  const handleRemoveSocial = (index: number) => {
    const updatedHandles = editedProfile.socialHandles?.filter((_, i) => i !== index) || [];
    const updated = { ...editedProfile, socialHandles: updatedHandles };
    setEditedProfile(updated);
    onUpdate(updated);
  };

  const handleAddColour = (e: React.FormEvent) => {
    e.preventDefault();
    if (newColour) {
      const updatedColours = [...editedProfile.colors, newColour];
      const updated = { ...editedProfile, colors: updatedColours };
      setEditedProfile(updated);
      onUpdate(updated);
      setShowAddColour(false);
      setNewColour('#6366f1');
    }
  };

  const handleRemoveColour = (index: number) => {
    const updatedColours = editedProfile.colors.filter((_, i) => i !== index);
    const updated = { ...editedProfile, colors: updatedColours };
    setEditedProfile(updated);
    onUpdate(updated);
  };

  // Calculate confidence display
  const confidence = profile.confidence || 70;
  const confidenceColor = confidence >= 70 ? 'text-green-400' : confidence >= 40 ? 'text-amber-400' : 'text-red-400';
  const confidenceBg = confidence >= 70 ? 'bg-green-500' : confidence >= 40 ? 'bg-amber-500' : 'bg-red-500';

  // Section header component
  const SectionHeader = ({ title, icon, section, count }: { title: string; icon: React.ReactNode; section: string; count?: number }) => (
    <button 
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 hover:text-gray-300 transition-colors group"
    >
      <span className="flex items-center gap-2">
        {icon} {title}
        {count !== undefined && <span className="text-gray-600 font-normal">({count})</span>}
      </span>
      {expandedSections[section] ? 
        <ChevronUp size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" /> : 
        <ChevronDown size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      }
    </button>
  );

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-2xl shadow-xl transition-all duration-300 ${
      isCollapsed ? 'p-3' : 'p-6 h-full flex flex-col'
    }`}>
      
      {/* Collapse toggle for mobile */}
      {onToggleCollapse && (
        <button 
          onClick={onToggleCollapse}
          className="lg:hidden w-full flex items-center justify-between mb-4 pb-4 border-b border-gray-800"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 w-12 h-12 flex items-center justify-center overflow-hidden">
              {profile.logoUrl ? (
                <img src={profile.logoUrl} alt={`${profile.name} logo`} className="w-full h-full object-contain" />
              ) : (
                <Building2 className="text-indigo-400" size={20} />
              )}
            </div>
            <div className="text-left">
              <h2 className="font-bold text-white">{profile.name}</h2>
              <p className="text-gray-500 text-xs">{profile.industry}</p>
            </div>
          </div>
          {isCollapsed ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronUp size={20} className="text-gray-400" />}
        </button>
      )}

      {/* Collapsible content */}
      {!isCollapsed && (
        <>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5">
            
            {/* Header (Desktop) */}
            <div className="hidden lg:flex items-center gap-3">
              <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20 w-16 h-16 flex items-center justify-center overflow-hidden">
                {profile.logoUrl ? (
                  <img src={profile.logoUrl} alt={`${profile.name} logo`} className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="text-indigo-400" size={24} />
                )}
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <input 
                    className="bg-gray-800 text-white font-bold text-lg px-2 py-1 rounded w-full border border-gray-700 focus:border-indigo-500 focus:outline-none"
                    value={editedProfile.name}
                    onChange={(e) => setEditedProfile({...editedProfile, name: e.target.value})}
                  />
                ) : (
                  <h2 className="text-xl font-bold text-white leading-tight">{profile.name}</h2>
                )}
                <p className="text-gray-500 text-sm font-medium">{profile.industry}</p>
              </div>
            </div>

            {/* Essence Summary */}
            {profile.essence && (
              <div>
                <SectionHeader title="Essence" icon={<Sparkles size={12} />} section="essence" />
                {expandedSections.essence && (
                  <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 animate-fadeIn">
                    {isEditing ? (
                      <textarea 
                        className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-gray-300 min-h-[60px] focus:border-indigo-500 focus:outline-none"
                        value={editedProfile.essence || ''}
                        onChange={(e) => setEditedProfile({...editedProfile, essence: e.target.value})}
                      />
                    ) : (
                      <p className="text-gray-300 text-sm leading-relaxed">{profile.essence}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Confidence Indicator */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Data Confidence</span>
                  <span className={`text-xs font-bold ${confidenceColor}`}>{confidence}%</span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${confidenceBg} transition-all duration-500`}
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>
              {confidence >= 70 && (
                <CheckCircle2 className="text-green-400 flex-shrink-0" size={18} />
              )}
            </div>

            {/* Social Handles */}
            <div>
              <SectionHeader 
                title="Social Intelligence" 
                icon={<Globe size={14} />} 
                section="social" 
                count={profile.socialHandles?.length || 0}
              />
              {expandedSections.social && (
                <div className="space-y-2 animate-fadeIn">
                  {profile.socialHandles && profile.socialHandles.length > 0 ? (
                    profile.socialHandles.map((handle, i) => {
                      const platform = detectPlatform(handle);
                      return (
                        <div 
                          key={i}
                          className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-800 rounded-lg border border-gray-700/50 transition-colors group"
                        >
                          <span className={`${platform.color}`}>{platform.icon}</span>
                          <span className="text-gray-500 text-xs uppercase font-medium w-20">{platform.name}</span>
                          <a 
                            href={handle.startsWith('http') ? handle : `https://${handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-300 text-sm group-hover:text-indigo-400 transition-colors truncate flex-1"
                          >
                            {formatHandle(handle)}
                          </a>
                          {isEditing && (
                            <button 
                              onClick={() => handleRemoveSocial(i)}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-gray-500 text-xs italic">No social handles detected</p>
                  )}
                  
                  {/* Add Social Handle */}
                  {showAddSocial ? (
                    <form onSubmit={handleAddSocial} className="flex gap-2 mt-2">
                      <input 
                        type="text"
                        placeholder="Enter social URL or @handle..."
                        className="flex-1 bg-gray-950 border border-gray-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        value={newSocialUrl}
                        onChange={(e) => setNewSocialUrl(e.target.value)}
                        autoFocus
                      />
                      <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs">
                        Add
                      </button>
                      <button type="button" onClick={() => setShowAddSocial(false)} className="text-gray-500 hover:text-white px-2">
                        <X size={14} />
                      </button>
                    </form>
                  ) : (
                    <button 
                      onClick={() => setShowAddSocial(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-700 hover:border-indigo-500 rounded-lg text-gray-500 hover:text-indigo-400 text-xs transition-colors group"
                    >
                      <Plus size={14} />
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">Add social link</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Colours */}
            <div>
              <SectionHeader 
                title="Brand Palette" 
                icon={<Palette size={14} />} 
                section="palette"
                count={editedProfile.colors.length}
              />
              {expandedSections.palette && (
                <div className="animate-fadeIn">
                  <div className="flex gap-2 flex-wrap">
                    {editedProfile.colors.map((color, i) => (
                      <div key={i} className="group relative">
                        <div 
                          className="w-10 h-10 rounded-full border-2 border-white/10 shadow-lg transition-transform hover:scale-110 cursor-pointer"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                        {isEditing && (
                          <button 
                            onClick={() => handleRemoveColour(i)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={10} className="text-white" />
                          </button>
                        )}
                        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {color}
                        </span>
                      </div>
                    ))}
                    
                    {/* Add Colour Button */}
                    {showAddColour ? (
                      <form onSubmit={handleAddColour} className="flex items-center gap-2">
                        <input 
                          type="color"
                          value={newColour}
                          onChange={(e) => setNewColour(e.target.value)}
                          className="w-10 h-10 rounded-full border-2 border-gray-700 cursor-pointer"
                        />
                        <button type="submit" className="text-xs text-indigo-400 hover:text-indigo-300">
                          Add
                        </button>
                        <button type="button" onClick={() => setShowAddColour(false)} className="text-gray-500 hover:text-white">
                          <X size={14} />
                        </button>
                      </form>
                    ) : (
                      <button 
                        onClick={() => setShowAddColour(true)}
                        className="w-10 h-10 rounded-full border-2 border-gray-700 border-dashed flex items-center justify-center text-gray-500 hover:text-indigo-400 hover:border-indigo-500 transition-colors group"
                        title="Add colour"
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Services / Products */}
            <div>
              <SectionHeader 
                title="Identified Offerings" 
                icon={<Tag size={14} />} 
                section="offerings"
                count={editedProfile.services.length}
              />
              {expandedSections.offerings && (
                <div className="flex flex-wrap gap-2 animate-fadeIn">
                  {editedProfile.services.slice(0, isEditing ? editedProfile.services.length : 8).map((service, i) => (
                    isEditing ? (
                      <div key={i} className="relative group">
                        <input 
                          className="px-3 py-1 bg-gray-800 text-gray-300 text-xs rounded-full border border-gray-700 max-w-[140px] focus:border-indigo-500 focus:outline-none pr-6"
                          value={service}
                          onChange={(e) => {
                            const newServices = [...editedProfile.services];
                            newServices[i] = e.target.value;
                            setEditedProfile({...editedProfile, services: newServices});
                          }}
                        />
                        <button 
                          onClick={() => {
                            const newServices = editedProfile.services.filter((_, idx) => idx !== i);
                            setEditedProfile({...editedProfile, services: newServices});
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <span key={i} className="px-3 py-1 bg-gray-800 text-gray-300 text-xs rounded-full border border-gray-700">
                        {service}
                      </span>
                    )
                  ))}
                  {!isEditing && editedProfile.services.length > 8 && (
                    <button 
                      onClick={() => toggleSection('offerings')}
                      className="px-3 py-1 text-indigo-400 text-xs hover:text-indigo-300"
                    >
                      +{editedProfile.services.length - 8} more
                    </button>
                  )}
                  {isEditing && (
                    <button 
                      onClick={() => setEditedProfile({...editedProfile, services: [...editedProfile.services, '']})}
                      className="px-3 py-1 border border-dashed border-gray-700 hover:border-indigo-500 text-gray-500 hover:text-indigo-400 text-xs rounded-full flex items-center gap-1 transition-colors"
                    >
                      <Plus size={12} /> Add
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Strategy / Vibe */}
            <div>
              <SectionHeader title="Strategy" icon={<Sparkles size={14} />} section="strategy" />
              {expandedSections.strategy && (
                <div className="animate-fadeIn">
                  {isEditing ? (
                    <textarea 
                      className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-gray-300 min-h-[80px] focus:border-indigo-500 focus:outline-none"
                      value={editedProfile.strategy}
                      onChange={(e) => setEditedProfile({...editedProfile, strategy: e.target.value})}
                    />
                  ) : (
                    <p className="text-gray-400 text-sm leading-relaxed border-l-2 border-gray-700 pl-3">
                      {profile.strategy}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Add Source URL */}
            <div className="pt-4 border-t border-gray-800">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Link size={14} /> Connect Knowledge
              </h3>
              <form onSubmit={handleAddSource} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Add blog/page URL to analyse..."
                  className="flex-1 bg-gray-950 border border-gray-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                />
                <button 
                  type="submit" 
                  disabled={isMerging || !newSourceUrl}
                  className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded transition-colors disabled:opacity-50"
                >
                  {isMerging ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16} />}
                </button>
              </form>
              {isMerging && <p className="text-xs text-indigo-400 mt-2 animate-pulse">Reading new content...</p>}
            </div>

          </div>

          {/* Edit/Save Actions */}
          <div className="mt-4 pt-4 border-t border-gray-800 flex gap-2">
            {isEditing ? (
              <>
                <button 
                  onClick={() => {
                    setEditedProfile(profile);
                    setIsEditing(false);
                  }}
                  className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg font-medium transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Save size={14} /> Apply Changes
                </button>
              </>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Pencil size={14} /> Edit Profile Strategy
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BrandInfoCard;
