import React, { useEffect, useState, useRef, useMemo } from 'react';
import { AnalysisStage } from '../types';
import { Loader2, CheckCircle2, Search, BrainCircuit, PenTool, XCircle, ArrowLeft } from 'lucide-react';

interface AnalysisLoaderProps {
  stages: AnalysisStage[];
  onContinueInBackground?: () => void;
}

const AnalysisLoader: React.FC<AnalysisLoaderProps> = ({ stages, onContinueInBackground }) => {
  // Matrix rain effect - multiple columns
  const [columns, setColumns] = useState<string[][]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const numColumns = 35; // Number of matrix columns
  const rowsPerColumn = 30; // More rows for better effect

  // Calculate progress based on completed stages
  const progress = useMemo(() => {
    const completedStages = stages.filter(s => s.status === 'done').length;
    const totalStages = stages.length;
    return completedStages / totalStages;
  }, [stages]);

  // Dynamic animation speed - starts slow, speeds up as progress increases
  const animationSpeed = useMemo(() => {
    // Start at 200ms, go down to 40ms as progress increases
    const baseSpeed = 200;
    const fastSpeed = 40;
    return Math.round(baseSpeed - (progress * (baseSpeed - fastSpeed)));
  }, [progress]);

  useEffect(() => {
    // Initialize columns with more characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,.<>?/~`';
    const initialColumns = Array.from({ length: numColumns }, () => 
      Array.from({ length: rowsPerColumn }, () => chars[Math.floor(Math.random() * chars.length)])
    );
    setColumns(initialColumns);
  }, []);

  // Separate effect for animation that responds to speed changes
  useEffect(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,.<>?/~`';
    
    const interval = setInterval(() => {
      setColumns(prev => prev.map(column => {
        // Shift column down and add new character at top
        const newChar = chars[Math.floor(Math.random() * chars.length)];
        return [newChar, ...column.slice(0, -1)];
      }));
    }, animationSpeed);

    return () => clearInterval(interval);
  }, [animationSpeed]);

  const hasError = stages.some(s => s.status === 'error');

  const getIcon = (label: string, status: string) => {
    if (status === 'error') return <XCircle className="text-red-400" size={16} />;
    if (status === 'done') return <CheckCircle2 size={16} className="text-green-400" />;
    if (label.includes('Scanning')) return <Search className="text-blue-400" size={16} />;
    if (label.includes('Competitor') || label.includes('Analysing')) return <BrainCircuit className="text-purple-400" size={16} />;
    return <PenTool className="text-pink-400" size={16} />;
  };

  // Calculate glow intensity based on progress
  const glowIntensity = 10 + (progress * 20);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden"
      style={{ zIndex: 50 }}
    >
      {/* Full-screen Matrix Rain Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="flex w-full h-full">
          {columns.map((column, colIndex) => (
            <div 
              key={colIndex} 
              className="flex-1 flex flex-col text-center font-mono"
              style={{ 
                animationDelay: `${colIndex * 30}ms`,
              }}
            >
              {column.map((char, charIndex) => {
                const isFirst = charIndex === 0;
                const isSecond = charIndex === 1;
                const isFading = charIndex <= 4;
                
                // Increase opacity based on progress for more dramatic effect at end
                const baseOpacity = isFirst ? 1 : isSecond ? 0.8 : isFading ? 0.5 - (charIndex * 0.08) : Math.max(0.03, 0.2 - (charIndex * 0.01));
                const opacity = baseOpacity * (0.7 + (progress * 0.3));
                
                const color = hasError ? 
                  (isFirst ? '#ff4444' : isSecond ? '#ff3333' : '#ff222220') : 
                  (isFirst ? '#00ff88' : isSecond ? '#00dd77' : '#00ff8815');
                
                return (
                  <span 
                    key={charIndex}
                    className="leading-none"
                    style={{ 
                      color,
                      opacity,
                      textShadow: isFirst ? `0 0 ${glowIntensity}px ${color}, 0 0 ${glowIntensity * 2}px ${color}` : 
                                  isSecond ? `0 0 ${glowIntensity / 2}px ${color}` : 'none',
                      fontSize: '16px',
                      transition: 'opacity 0.5s ease',
                    }}
                  >
                    {char}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        
        {/* Gradient overlays for depth and readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50" />
        
        {/* Radial gradient for center focus */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_50%,rgba(0,0,0,0.8)_100%)]" />
      </div>

      {/* Central Dialog Box */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-gray-950/95 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
        {/* Animated border glow based on progress */}
        <div 
          className={`absolute inset-0 rounded-2xl transition-opacity duration-500 ${hasError ? 'bg-red-500/10' : 'bg-indigo-500/10'}`}
          style={{ opacity: 0.5 + (progress * 0.5) }}
        />
        <div className={`absolute inset-px rounded-2xl border ${hasError ? 'border-red-500/30' : 'border-indigo-500/30'}`} />
        
        <div className="relative">
          <h2 className={`text-2xl font-bold mb-6 flex items-center gap-3 ${hasError ? 'text-red-400' : 'text-white'}`}>
            {hasError ? (
              <>
                <XCircle className="text-red-500" />
                Analysis Failed
              </>
            ) : (
              <>
                <Loader2 className="animate-spin text-indigo-500" style={{ animationDuration: `${1500 - (progress * 1000)}ms` }} />
                Building Brand DNA...
              </>
            )}
          </h2>

          {/* Progress indicator */}
          {!hasError && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Analysis Progress</span>
                <span className="text-xs font-bold text-indigo-400">{Math.round(progress * 100)}%</span>
              </div>
              <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-700"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}

          {hasError && (
            <p className="text-gray-400 text-sm mb-6">
              Returning to start...
            </p>
          )}

          <div className="space-y-5">
            {stages.map((stage, index) => (
              <div key={index} className="flex items-start gap-4 transition-all duration-500">
                <div className={`mt-0.5 p-2 rounded-full border ${
                  stage.status === 'done' ? 'bg-green-500/10 border-green-500/50' : 
                  stage.status === 'error' ? 'bg-red-500/10 border-red-500/50' :
                  stage.status === 'loading' ? 'bg-indigo-500/10 border-indigo-500/50 animate-pulse' : 
                  'bg-gray-800 border-gray-700'
                }`}>
                  {getIcon(stage.label, stage.status)}
                </div>
                <div className="flex-1">
                  <p className={`font-medium text-sm ${
                    stage.status === 'done' ? 'text-gray-300' : 
                    stage.status === 'error' ? 'text-red-400' :
                    stage.status === 'loading' ? 'text-white' : 
                    'text-gray-600'
                  }`}>
                    {stage.label}
                  </p>
                  {stage.status === 'loading' && (
                    <div className="w-full bg-gray-800 h-0.5 mt-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse"
                        style={{ 
                          width: '60%',
                          animation: `shimmer ${1.5 - (progress * 0.5)}s ease-in-out infinite`
                        }}
                      />
                    </div>
                  )}
                  {stage.status === 'error' && (
                    <div className="w-full bg-red-900/30 h-0.5 mt-2 rounded-full" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Continue in Background Button */}
          {!hasError && onContinueInBackground && (
            <div className="mt-8 pt-6 border-t border-gray-800">
              <button
                onClick={onContinueInBackground}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl font-medium transition-all group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Continue in Background
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">
                We'll notify you when this brand is ready
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisLoader;
