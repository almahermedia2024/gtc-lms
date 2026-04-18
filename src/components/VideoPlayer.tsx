import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";

interface VideoPlayerProps {
  src: string;
  title: string;
  onProgress?: (watchedSeconds: number, totalDuration: number) => void;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

let ytApiLoaded = false;
let ytApiPromise: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (ytApiLoaded) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    (window as any).onYouTubeIframeAPIReady = () => {
      ytApiLoaded = true;
      resolve();
    };
  });
  return ytApiPromise;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/* ─── YouTube Player ─── */
function YouTubePlayer({ videoId, title, onProgress }: { videoId: string; title: string; onProgress?: VideoPlayerProps["onProgress"] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const maxWatchedRef = useRef(0);
  const progressInterval = useRef<number>();
  const seekCheckInterval = useRef<number>();
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let player: any;
    const init = async () => {
      await loadYouTubeAPI();
      const YT = (window as any).YT;
      player = new YT.Player(`yt-player-${videoId}`, {
        videoId,
        playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, fs: 0, iv_load_policy: 3, playsinline: 1 },
        events: {
          onReady: () => { playerRef.current = player; setDuration(player.getDuration()); setReady(true); },
          onStateChange: (e: any) => {
            const YT2 = (window as any).YT;
            setPlaying(e.data === YT2.PlayerState.PLAYING);
            if (e.data === YT2.PlayerState.PLAYING) player.setPlaybackRate(1);
          },
        },
      });
    };
    init();
    return () => { try { playerRef.current?.destroy(); } catch {} };
  }, [videoId]);

  useEffect(() => {
    if (!ready) return;
    seekCheckInterval.current = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const ct = p.getCurrentTime();
      setCurrent(ct);
      if (ct > maxWatchedRef.current + 3) p.seekTo(maxWatchedRef.current, true);
      else if (ct > maxWatchedRef.current) maxWatchedRef.current = ct;
      if (p.getPlaybackRate() !== 1) p.setPlaybackRate(1);
    }, 500);
    return () => clearInterval(seekCheckInterval.current);
  }, [ready]);

  useEffect(() => {
    progressInterval.current = window.setInterval(() => {
      if (playerRef.current && onProgress) onProgress(maxWatchedRef.current, playerRef.current.getDuration() || 0);
    }, 30000);
    return () => clearInterval(progressInterval.current);
  }, [onProgress]);

  useEffect(() => () => {
    if (onProgress && playerRef.current) onProgress(maxWatchedRef.current, playerRef.current.getDuration() || 0);
  }, [onProgress]);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    const YT = (window as any).YT;
    p.getPlayerState() === YT.PlayerState.PLAYING ? p.pauseVideo() : p.playVideo();
  };

  const handleSeekBar = (e: React.MouseEvent<HTMLDivElement>) => {
    const p = playerRef.current;
    if (!p || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (rect.right - e.clientX) / rect.width;
    const seekTo = ratio * duration;
    if (seekTo <= maxWatchedRef.current + 2) p.seekTo(seekTo, true);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) { containerRef.current.requestFullscreen(); setFullscreen(true); }
    else { document.exitFullscreen(); setFullscreen(false); }
  };

  const progressPct = duration ? (currentTime / duration) * 100 : 0;
  const maxPct = duration ? (maxWatchedRef.current / duration) * 100 : 0;

  return (
    <div ref={containerRef} className="relative bg-foreground rounded-lg overflow-hidden select-none group" dir="ltr" onContextMenu={(e) => e.preventDefault()}>
      <div className="w-full aspect-video"><div id={`yt-player-${videoId}`} className="w-full h-full" /></div>
      <div className="absolute inset-0" style={{ zIndex: 1 }} onClick={togglePlay} onContextMenu={(e) => e.preventDefault()} />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ zIndex: 2 }}>
        <div className="relative h-1.5 bg-white/20 rounded cursor-pointer mb-3" onClick={handleSeekBar}>
          <div className="absolute top-0 right-0 h-full bg-white/30 rounded" style={{ width: `${maxPct}%` }} />
          <div className="absolute top-0 right-0 h-full bg-accent rounded" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-white text-sm">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="hover:text-accent transition-colors">{playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}</button>
            <span className="text-xs font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs opacity-70">{title}</span>
            <button onClick={toggleFullscreen} className="hover:text-accent transition-colors">{fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}</button>
          </div>
        </div>
      </div>
      {!playing && ready && (
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 1 }}>
          <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center backdrop-blur-sm"><Play className="w-7 h-7 text-primary-foreground ml-1" /></div>
        </button>
      )}
    </div>
  );
}

/* ─── Native Video Player ─── */
function NativePlayer({ src, title, onProgress }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const maxWatchedRef = useRef(0);
  const progressInterval = useRef<number>();

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrent(v.currentTime);
    if (v.currentTime > maxWatchedRef.current) maxWatchedRef.current = v.currentTime;
  }, []);

  const handleSeeking = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime > maxWatchedRef.current + 2) v.currentTime = maxWatchedRef.current;
  }, []);

  const handleSeekBar = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (rect.right - e.clientX) / rect.width;
    const seekTo = ratio * duration;
    if (seekTo <= maxWatchedRef.current + 2) v.currentTime = seekTo;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) { containerRef.current.requestFullscreen(); setFullscreen(true); }
    else { document.exitFullscreen(); setFullscreen(false); }
  };

  useEffect(() => {
    progressInterval.current = window.setInterval(() => {
      if (videoRef.current && onProgress) onProgress(maxWatchedRef.current, videoRef.current.duration || 0);
    }, 30000);
    return () => clearInterval(progressInterval.current);
  }, [onProgress]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const preventContext = (e: Event) => e.preventDefault();
    const preventRate = () => { v.playbackRate = 1; };
    v.addEventListener("contextmenu", preventContext);
    v.addEventListener("ratechange", preventRate);
    return () => { v.removeEventListener("contextmenu", preventContext); v.removeEventListener("ratechange", preventRate); };
  }, []);

  useEffect(() => () => {
    if (onProgress && videoRef.current) onProgress(maxWatchedRef.current, videoRef.current.duration || 0);
  }, [onProgress]);

  const progressPct = duration ? (currentTime / duration) * 100 : 0;
  const maxPct = duration ? (maxWatchedRef.current / duration) * 100 : 0;

  return (
    <div ref={containerRef} className="relative bg-foreground rounded-lg overflow-hidden select-none group" dir="ltr">
      <video ref={videoRef} src={src} className="w-full aspect-video" onTimeUpdate={handleTimeUpdate} onSeeking={handleSeeking}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)} onEnded={() => setPlaying(false)}
        controlsList="nodownload noplaybackrate" disablePictureInPicture playsInline />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="relative h-1.5 bg-white/20 rounded cursor-pointer mb-3" onClick={handleSeekBar}>
          <div className="absolute top-0 right-0 h-full bg-white/30 rounded" style={{ width: `${maxPct}%` }} />
          <div className="absolute top-0 right-0 h-full bg-accent rounded" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-white text-sm">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="hover:text-accent transition-colors">{playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}</button>
            <button onClick={() => { setMuted(!muted); if (videoRef.current) videoRef.current.muted = !muted; }} className="hover:text-accent transition-colors">
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <span className="text-xs font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs opacity-70">{title}</span>
            <button onClick={toggleFullscreen} className="hover:text-accent transition-colors">{fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}</button>
          </div>
        </div>
      </div>
      {!playing && (
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center backdrop-blur-sm"><Play className="w-7 h-7 text-primary-foreground ml-1" /></div>
        </button>
      )}
    </div>
  );
}

/* ─── Main Export ─── */
export function VideoPlayer({ src, title, onProgress }: VideoPlayerProps) {
  const youtubeId = extractYouTubeId(src);
  if (youtubeId) return <YouTubePlayer videoId={youtubeId} title={title} onProgress={onProgress} />;
  return <NativePlayer src={src} title={title} onProgress={onProgress} />;
}
