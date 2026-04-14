import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";

interface VideoPlayerProps {
  src: string;
  title: string;
  onProgress?: (watchedSeconds: number, totalDuration: number) => void;
}

export function VideoPlayer({ src, title, onProgress }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const maxWatchedRef = useRef(0);
  const progressInterval = useRef<number>();

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrent(v.currentTime);
    if (v.currentTime > maxWatchedRef.current) {
      maxWatchedRef.current = v.currentTime;
    }
  }, []);

  // Prevent seeking ahead of max watched
  const handleSeeking = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime > maxWatchedRef.current + 2) {
      v.currentTime = maxWatchedRef.current;
    }
  }, []);

  const handleSeekBar = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // RTL aware - calculate from right
    const clickX = rect.right - e.clientX;
    const ratio = clickX / rect.width;
    const seekTo = ratio * duration;
    if (seekTo <= maxWatchedRef.current + 2) {
      v.currentTime = seekTo;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  // Track progress periodically
  useEffect(() => {
    progressInterval.current = window.setInterval(() => {
      if (videoRef.current && onProgress) {
        onProgress(maxWatchedRef.current, videoRef.current.duration || 0);
      }
    }, 10000);
    return () => clearInterval(progressInterval.current);
  }, [onProgress]);

  // Prevent right click & speed change
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const preventContext = (e: Event) => e.preventDefault();
    const preventRate = () => { v.playbackRate = 1; };
    v.addEventListener("contextmenu", preventContext);
    v.addEventListener("ratechange", preventRate);
    return () => {
      v.removeEventListener("contextmenu", preventContext);
      v.removeEventListener("ratechange", preventRate);
    };
  }, []);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (onProgress && videoRef.current) {
        onProgress(maxWatchedRef.current, videoRef.current.duration || 0);
      }
    };
  }, [onProgress]);

  const progressPct = duration ? (currentTime / duration) * 100 : 0;
  const maxPct = duration ? (maxWatchedRef.current / duration) * 100 : 0;

  return (
    <div ref={containerRef} className="relative bg-foreground rounded-lg overflow-hidden select-none group" dir="ltr">
      <video
        ref={videoRef}
        src={src}
        className="w-full aspect-video"
        onTimeUpdate={handleTimeUpdate}
        onSeeking={handleSeeking}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        playsInline
      />

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Seek bar */}
        <div className="relative h-1.5 bg-white/20 rounded cursor-pointer mb-3" onClick={handleSeekBar}>
          <div className="absolute top-0 right-0 h-full bg-white/30 rounded" style={{ width: `${maxPct}%` }} />
          <div className="absolute top-0 right-0 h-full bg-accent rounded" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="flex items-center justify-between text-white text-sm">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="hover:text-accent transition-colors">
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={() => { setMuted(!muted); if (videoRef.current) videoRef.current.muted = !muted; }} className="hover:text-accent transition-colors">
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <span className="text-xs font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs opacity-70">{title}</span>
            <button onClick={toggleFullscreen} className="hover:text-accent transition-colors">
              {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Center play button */}
      {!playing && (
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center backdrop-blur-sm">
            <Play className="w-7 h-7 text-primary-foreground ml-1" />
          </div>
        </button>
      )}
    </div>
  );
}
