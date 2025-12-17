import React, { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Maximize2, Download, RotateCcw, ExternalLink } from 'lucide-react';
import { fetchVideoAsBlob, revokeBlobUrl } from '../services/geminiService';

interface VideoPlayerProps {
  videoUrl: string;
  posterImage?: string;
  onClose?: () => void;
  isModal?: boolean;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videoUrl, 
  posterImage, 
  onClose, 
  isModal = false,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isFetchingBlob, setIsFetchingBlob] = useState(false);

  // Fetch video as blob to bypass CORS restrictions
  useEffect(() => {
    let mounted = true;
    
    const loadVideo = async () => {
      // If already a blob URL or data URL, use directly
      if (videoUrl.startsWith('blob:') || videoUrl.startsWith('data:')) {
        setBlobUrl(videoUrl);
        return;
      }
      
      setIsFetchingBlob(true);
      const blob = await fetchVideoAsBlob(videoUrl);
      
      if (mounted) {
        if (blob) {
          setBlobUrl(blob);
        } else {
          // If blob fetch fails, try direct URL anyway (might work for some videos)
          setBlobUrl(videoUrl);
        }
        setIsFetchingBlob(false);
      }
    };
    
    loadVideo();
    
    // Cleanup: revoke blob URL when component unmounts
    return () => {
      mounted = false;
      if (blobUrl && blobUrl.startsWith('blob:') && blobUrl !== videoUrl) {
        revokeBlobUrl(blobUrl);
      }
    };
  }, [videoUrl]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setProgress((current / total) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      videoRef.current.currentTime = percentage * videoRef.current.duration;
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `flysolo-video-${Date.now()}.mp4`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playerContent = (
    <div className={`relative bg-black rounded-xl overflow-hidden ${className}`}>
      {/* Video Element - only render when we have a URL to play */}
      {blobUrl && (
        <video
          ref={videoRef}
          src={blobUrl}
          poster={posterImage}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={handleError}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
        />
      )}

      {/* Loading Overlay - show during blob fetch OR video loading */}
      {(isFetchingBlob || (isLoading && blobUrl)) && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">
              {isFetchingBlob ? 'Preparing video...' : 'Loading video...'}
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
          <div className="flex flex-col items-center gap-3 text-center p-4">
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
              <X className="text-red-400" size={24} />
            </div>
            <p className="text-gray-300 text-sm">Unable to play video in browser</p>
            <p className="text-gray-500 text-xs max-w-xs">
              VEO videos may have playback restrictions. Try downloading or opening directly.
            </p>
            <div className="flex gap-2 mt-2">
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
              >
                <ExternalLink size={12} />
                Open in new tab
              </a>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors"
              >
                <Download size={12} />
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Play Button Overlay (when paused) */}
      {!isPlaying && !isLoading && !hasError && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 group"
        >
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
            <Play className="text-white ml-1" size={32} fill="white" />
          </div>
        </button>
      )}

      {/* Controls Bar */}
      {!hasError && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          {/* Progress Bar */}
          <div 
            className="w-full h-1 bg-gray-600 rounded-full mb-3 cursor-pointer group"
            onClick={handleSeek}
          >
            <div 
              className="h-full bg-indigo-500 rounded-full relative transition-all"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="text-white hover:text-indigo-400 transition-colors"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>

              {/* Mute/Unmute */}
              <button
                onClick={toggleMute}
                className="text-white hover:text-indigo-400 transition-colors"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>

              {/* Time Display */}
              <span className="text-white text-xs font-mono">
                {formatTime((progress / 100) * duration)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Download */}
              <button
                onClick={handleDownload}
                className="text-white hover:text-indigo-400 transition-colors"
                title="Download video"
              >
                <Download size={18} />
              </button>

              {/* Fullscreen */}
              <button
                onClick={handleFullscreen}
                className="text-white hover:text-indigo-400 transition-colors"
                title="Fullscreen"
              >
                <Maximize2 size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // If modal mode, wrap in modal container
  if (isModal && onClose) {
    return (
      <div 
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
        onClick={(e) => {
          // Close on backdrop click
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="relative w-full max-w-2xl">
          {/* Close Button - positioned inside the container for better accessibility */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 text-white transition-colors p-2 rounded-full"
          >
            <X size={20} />
          </button>
          
          {playerContent}
        </div>
      </div>
    );
  }

  return playerContent;
};

export default VideoPlayer;

