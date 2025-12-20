import React, { useState } from 'react';
import { ArrowRight, Globe, Sparkles, AlertCircle, Loader2, ArrowLeft, Home } from 'lucide-react';
import { validateUrlAccessibility } from '../services/geminiService';

interface OnboardingProps {
  onStart: (url: string) => void;
  errorMessage?: string | null;
  onBackToBrands?: () => void;
  hasExistingBrands?: boolean;
}

const Onboarding: React.FC<OnboardingProps> = ({ onStart, errorMessage: externalError, onBackToBrands, hasExistingBrands }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Combine external error with local error
  const displayError = error || externalError;

  const isValidUrl = (string: string) => {
    try {
        // Regex for flexible URL validation (allows domain.com without http)
        const pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
          '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
          '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
          '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
          '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
          '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
        return !!pattern.test(string);
    } catch (err) {
        return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!url.trim()) {
        setError("Please enter a website URL.");
        return;
    }

    if (!isValidUrl(url.trim())) {
        setError("That doesn't look like a valid URL. Please check for typos (e.g., example.com).");
        return;
    }

    // Basic cleanup
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    
    // NETWORK VALIDATION: Check if URL is actually accessible
    setIsValidating(true);
    
    try {
      const validation = await validateUrlAccessibility(cleanUrl);
      
      if (!validation.valid) {
        setError(validation.error || "Website is not accessible. Please check the URL.");
        setIsValidating(false);
        return;
      }
      
      // URL is valid and accessible - proceed
      setIsValidating(false);
      onStart(cleanUrl);
      
    } catch (err) {
      setError("Could not verify website. Please check your connection and try again.");
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-gradient-to-br from-black via-gray-900 to-indigo-950">
      {/* Back to Brands Button */}
      {onBackToBrands && hasExistingBrands && (
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={onBackToBrands}
            className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800 rounded-xl transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back to Brands</span>
          </button>
        </div>
      )}
      
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500 rounded-full blur-[80px]"></div>
      </div>

      <div className="z-10 max-w-2xl w-full text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-sm text-indigo-300 mb-4 animate-float">
          <Sparkles size={16} />
          <span>AI-Powered Marketing Agency</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
          Turn your website into <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">viral content.</span>
        </h1>

        <p className="text-lg text-gray-400 max-w-lg mx-auto leading-relaxed">
          Enter your website. We'll research your brand, stalk your competitors, and generate weeks of agency-quality content in seconds.
        </p>

        <form onSubmit={handleSubmit} className="relative max-w-lg mx-auto mt-12 group">
          <div className={`absolute -inset-1 bg-gradient-to-r ${displayError ? 'from-red-500 to-red-600' : isValidating ? 'from-indigo-500 to-purple-600 animate-pulse' : 'from-indigo-500 to-purple-600'} rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200`}></div>
          <div className={`relative flex items-center bg-gray-900 rounded-xl border ${displayError ? 'border-red-500/50' : 'border-gray-700'} shadow-2xl overflow-hidden transition-colors`}>
            <div className={`pl-4 ${displayError ? 'text-red-400' : 'text-gray-500'}`}>
              {isValidating ? (
                <Loader2 size={20} className="animate-spin text-indigo-400" />
              ) : (
                <Globe size={20} />
              )}
            </div>
            <input
              type="text"
              placeholder="example.com"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if(error) setError(null);
              }}
              disabled={isValidating}
              className="w-full bg-transparent border-none px-4 py-5 text-white placeholder-gray-500 focus:outline-none focus:ring-0 text-lg disabled:opacity-50"
              autoFocus
            />
            <button
              type="submit"
              disabled={!url || isValidating}
              className={`mr-2 px-6 py-3 ${displayError ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'} text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px] justify-center`}
            >
              {isValidating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span className="hidden sm:inline">Checking...</span>
                </>
              ) : (
                <>
                  Start
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
          
          {/* Error Message */}
          {displayError && (
            <div className="absolute top-full left-0 w-full mt-3 flex items-center justify-center gap-2 text-red-400 text-sm animate-fade-in-up">
              <AlertCircle size={14} />
              <span>{displayError}</span>
            </div>
          )}
          
          {/* Validating Message */}
          {isValidating && !displayError && (
            <div className="absolute top-full left-0 w-full mt-3 flex items-center justify-center gap-2 text-indigo-400 text-sm animate-pulse">
              <span>Verifying website is accessible...</span>
            </div>
          )}
        </form>

        <div className="pt-12 flex items-center justify-center gap-8 text-gray-500 text-sm flex-wrap">
          <span>Google Gemini 2.5 Flash</span>
          <span className="w-1 h-1 bg-gray-700 rounded-full hidden sm:block"></span>
          <span>Competitor Analysis</span>
          <span className="w-1 h-1 bg-gray-700 rounded-full hidden sm:block"></span>
          <span>Viral Engine</span>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
