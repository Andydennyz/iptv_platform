import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Loader2, AlertTriangle, Tv, Wifi, Volume2, VolumeX, Settings, RotateCcw, Maximize, Minimize } from "lucide-react";
import { cn } from "@/libs/utils.ts";
import { motion, AnimatePresence } from "motion/react";
import type { Channel } from "../_lib/types.ts";
import "./VideoPlayer.css";

type AspectRatio = "16:9" | "4:3" | "21:9" | "1:1" | "fit" | "fill";

type Props = {
  channel: Channel | null;
  isAppLoading: boolean;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

export default function VideoPlayer({ channel, isAppLoading }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBarFillRef = useRef<HTMLDivElement>(null);
  const progressIndicatorRef = useRef<HTMLDivElement>(null);
  const bottomProgressBarFillRef = useRef<HTMLDivElement>(null);

  const [isStreamLoading, setIsStreamLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("fit");
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const maxRetries = 3;

  // Get object-fit class based on aspect ratio
  const getObjectFitClass = (ratio: AspectRatio): string => {
    switch (ratio) {
      case "16:9": return "object-contain aspect-video";
      case "4:3": return "object-contain aspect-[4/3]";
      case "21:9": return "object-contain aspect-[21/9]";
      case "1:1": return "object-contain aspect-square";
      case "fill": return "object-cover";
      case "fit": return "object-contain";
      default: return "object-contain";
    }
  };

  // Volume control functions
  const handleVolumeChange = useCallback((newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted) {
        setVolume(videoRef.current.volume);
      }
    }
  }, [isMuted]);

  // Seek functionality
  const handleSeek = useCallback((newTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  // Format time as MM:SS
  const formatTime = useCallback((time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Toggle fullscreen using Fullscreen API
  const toggleFullscreen = useCallback(() => {
    const container = videoRef.current?.parentElement;
    if (!container) return;

    if (!isFullscreen) {
      // Request fullscreen
      container.requestFullscreen?.().catch((err) => {
        console.error(`Error requesting fullscreen: ${err.message}`);
        // Fallback to CSS fullscreen if API fails
        setIsFullscreen(true);
      });
    } else {
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      } else {
        setIsFullscreen(false);
      }
    }
  }, [isFullscreen]);

  // Retry stream loading
  const retryStream = useCallback(() => {
    if (retryCount < maxRetries && channel) {
      setRetryCount(prev => prev + 1);
      setHasError(false);
      setIsStreamLoading(true);

      // Retry after a delay
      retryTimerRef.current = setTimeout(() => {
        if (hlsRef.current) {
          hlsRef.current.startLoad();
        }
      }, 2000);
    }
  }, [retryCount, channel]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Destroy the previous HLS instance before creating a new one
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (!channel) {
      video.src = "";
      return;
    }

    setIsStreamLoading(true);
    setHasError(false);
    setRetryCount(0);
    setIsBuffering(false);
    setCurrentTime(0);
    setDuration(0);

    // Briefly show "Now Playing" overlay on channel switch
    setShowOverlay(true);
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(() => setShowOverlay(false), 4500);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        levelLoadingMaxRetry: 4,
        levelLoadingMaxRetryTimeout: 4000,
        fragLoadingMaxRetry: 6,
        fragLoadingMaxRetryTimeout: 4000,
        startLevel: -1,
        autoStartLoad: true,
        debug: false,
      });
      hlsRef.current = hls;

      hls.loadSource(channel.streamUrl);
      hls.attachMedia(video);

      // Enhanced event handlers for better stability
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsStreamLoading(false);
        setRetryCount(0);
        // Autoplay – may be blocked by browser policy until user interacts
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.BUFFER_APPENDED, () => {
        setIsBuffering(false);
      });

      hls.on(Hls.Events.BUFFER_EOS, () => {
        setIsBuffering(false);
      });

      hls.on(Hls.Events.BUFFER_FLUSHING, () => {
        setIsBuffering(true);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.log('HLS Error:', data);

        if (!data.fatal) {
          setIsBuffering(true);
          return;
        }

        setIsStreamLoading(false);
        setIsBuffering(false);

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          // Attempt network recovery
          if (retryCount < maxRetries) {
            console.log(`Network error, retrying... (${retryCount + 1}/${maxRetries})`);
            setTimeout(() => hls.startLoad(), 2000);
          } else {
            setHasError(true);
          }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          console.log('Media error, attempting recovery...');
          hls.recoverMediaError();
        } else {
          setHasError(true);
          hls.destroy();
        }
      });

      // Handle video events for better UX
      video.addEventListener('waiting', () => setIsBuffering(true));
      video.addEventListener('playing', () => setIsBuffering(false));
      video.addEventListener('canplay', () => setIsBuffering(false));
      video.addEventListener('timeupdate', () => {
        if (!isDragging) {
          setCurrentTime(video.currentTime);
        }
      });
      video.addEventListener('loadedmetadata', () => {
        setDuration(video.duration);
      });
      video.addEventListener('durationchange', () => {
        setDuration(video.duration);
      });

    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari supports HLS natively
      video.src = channel.streamUrl;
      video.addEventListener("loadedmetadata", () => {
        setIsStreamLoading(false);
        setRetryCount(0);
        video.play().catch(() => {});
      }, { once: true });
      video.addEventListener("error", () => {
        setIsStreamLoading(false);
        setHasError(true);
      }, { once: true });
    } else {
      setIsStreamLoading(false);
      setHasError(true);
    }

    return () => {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel, retryCount]);

  // Mouse movement to show/hide controls
  useEffect(() => {
    let hideControlsTimer: ReturnType<typeof setTimeout>;

    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(hideControlsTimer);
      hideControlsTimer = setTimeout(() => setShowControls(false), 3000);
    };

    const container = videoRef.current?.parentElement;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      return () => {
        container.removeEventListener('mousemove', handleMouseMove);
        clearTimeout(hideControlsTimer);
      };
    }
  }, []);

  // Handle fullscreen changes and Escape key
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen?.();
        } else {
          setIsFullscreen(false);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  // Update progress bar widths
  useEffect(() => {
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    if (progressBarFillRef.current) {
      progressBarFillRef.current.style.width = `${progressPercent}%`;
    }
    if (progressIndicatorRef.current) {
      progressIndicatorRef.current.style.width = `${progressPercent}%`;
    }
    if (bottomProgressBarFillRef.current) {
      bottomProgressBarFillRef.current.style.width = `${progressPercent}%`;
    }
  }, [currentTime, duration]);

  return (
    <div className={cn(
      "flex-1 flex flex-col bg-black overflow-hidden relative min-w-0"
    )}>
      {/* Main video element */}
      <video
        ref={videoRef}
        className={cn("w-full h-full", getObjectFitClass(aspectRatio))}
        controls={false}
        playsInline
        muted={isMuted}
        onVolumeChange={(e) => {
          const video = e.target as HTMLVideoElement;
          setVolume(video.volume);
          setIsMuted(video.muted);
        }}
      />

      {/* Always visible progress bar */}
      {channel && !isStreamLoading && !hasError && duration > 0 && (
        <div className="progress-bar">
          <div ref={progressBarFillRef} className="progress-bar-fill" />
        </div>
      )}
      <AnimatePresence>
        {showControls && channel && !isStreamLoading && !hasError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4"
          >
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="relative w-full h-1 bg-white/20 rounded-full cursor-pointer group">
                <div ref={progressIndicatorRef} className="progress-indicator" />
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  value={currentTime}
                  onChange={(e) => {
                    const newTime = parseFloat(e.target.value);
                    setCurrentTime(newTime);
                    handleSeek(newTime);
                  }}
                  onMouseDown={() => setIsDragging(true)}
                  onMouseUp={() => setIsDragging(false)}
                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Video progress"
                />
                {/* Hover preview */}
                <div className="absolute top-0 left-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute top-[-30px] left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {formatTime(currentTime)}
                  </div>
                </div>
              </div>
              {/* Time displays */}
              <div className="flex justify-between items-center mt-2 text-white/80 text-sm">
                <span className="font-mono">{formatTime(currentTime)}</span>
                <span className="font-mono">
                  -{formatTime(Math.max(0, duration - currentTime))}
                </span>
                <span className="font-mono">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-white">
              {/* Volume Control */}
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleMute}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
                    aria-label="Volume control"
                  />
                  <span className="text-sm font-mono w-8">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                </div>
              </div>

              {/* Aspect Ratio & Settings */}
              <div className="flex items-center gap-2">
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                  className="bg-black/50 text-white text-sm px-3 py-1 rounded border border-white/20"
                  aria-label="Aspect ratio"
                >
                  <option value="fit">Fit</option>
                  <option value="16:9">16:9</option>
                  <option value="4:3">4:3</option>
                  <option value="21:9">21:9</option>
                  <option value="1:1">1:1</option>
                  <option value="fill">Fill</option>
                </select>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize className="w-5 h-5" />
                  ) : (
                    <Maximize className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => setShowControls(false)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  aria-label="Hide controls"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Always visible progress bar */}
      {channel && !isStreamLoading && !hasError && duration > 0 && (
        <div className="progress-bar">
          <div ref={bottomProgressBarFillRef} className="progress-bar-fill" />
        </div>
      )}

      {/* ── Overlay states ── */}

      {/* No signal – nothing selected yet */}
      {!channel && !isAppLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070710]">
          {/* Subtle TV scan-line texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04] video-player-scanline"
          />
          <Tv className="w-20 h-20 text-white/8 mb-5" />
          <p className="text-white/20 text-base font-light tracking-[0.4em] uppercase">
            No Signal
          </p>
          <p className="text-white/10 text-xs mt-2 tracking-wider">
            Select a channel from the list
          </p>
        </div>
      )}

      {/* App loading – fetching data */}
      {isAppLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
          <Loader2 className="w-8 h-8 text-white animate-spin mb-3" />
          <p className="text-white text-sm tracking-wide">Loading channels…</p>
        </div>
      )}

      {/* Stream connecting */}
      {channel && isStreamLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
          <Loader2 className="w-10 h-10 text-white animate-spin mb-3" />
          <p className="text-white text-sm">
            Connecting to{" "}
            <span className="text-white font-medium">{channel.name}</span>…
          </p>
          {retryCount > 0 && (
            <p className="text-white/60 text-xs mt-1">
              Retry {retryCount}/{maxRetries}
            </p>
          )}
        </div>
      )}

      {/* Buffering indicator */}
      {channel && isBuffering && !isStreamLoading && (
        <div className="absolute top-4 right-4 bg-gray-600 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 text-black">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Buffering...</span>
          </div>
        </div>
      )}

      {/* Stream error */}
      {channel && hasError && !isStreamLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95">
          <AlertTriangle className="w-12 h-12 text-yellow-500/80 mb-4" />
          <p className="text-white font-semibold text-lg tracking-wide">Stream Unavailable</p>
          <p className="text-white/60 text-sm mt-1.5 text-center max-w-md">
            Could not connect to{" "}
            <span className="text-white/80">{channel.name}</span>
          </p>
          {retryCount < maxRetries && (
            <button
              onClick={retryStream}
              className="mt-4 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Retry ({retryCount}/{maxRetries})
            </button>
          )}
          <p className="text-white/40 text-xs mt-4 tracking-wider">
            Try selecting another channel
          </p>
        </div>
      )}

      {/* Now Playing overlay – fades in on channel switch, auto-dismisses */}
      <AnimatePresence>
        {showOverlay && channel && !isStreamLoading && !hasError && (
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn(
              "absolute bottom-20 left-5 flex items-center gap-3",
              "bg-black/70 backdrop-blur-md rounded-xl px-4 py-3",
              "border border-white/10 shadow-xl"
            )}
          >
            {/* Channel logo badge */}
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0",
                `bg-[${channel.logoColor}]`,
              )}
            >
              {getInitials(channel.name)}
            </div>

            {/* Info */}
            <div>
              <p className="text-white/40 text-[9px] uppercase tracking-widest mb-0.5">
                Now Playing
              </p>
              <p className="text-white font-semibold text-sm leading-tight">{channel.name}</p>
              <p className="text-white/30 text-[10px] mt-0.5">CH {channel.number}</p>
            </div>

            {/* Live badge */}
            {channel.isLive && (
              <div className="ml-1 flex items-center gap-1.5 text-red-400 border-l border-white/10 pl-3">
                <Wifi className="w-3.5 h-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-widest">Live</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Channel number badge – top-right corner while overlay is shown */}
      <AnimatePresence>
        {showOverlay && channel && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute top-5 right-5 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10"
          >
            <p className="text-white/30 text-[9px] uppercase tracking-widest">CH</p>
            <p className="text-white font-bold text-lg tabular-nums leading-tight">
              {channel.number}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

