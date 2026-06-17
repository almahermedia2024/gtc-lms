import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";

// Minimal YouTube IFrame API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YouTubePlayerHandle {
  pause: () => void;
  play: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface Props {
  videoId: string;
  onReady?: () => void;
  onTimeUpdate?: (seconds: number) => void;
  onEnded?: () => void;
}

let apiLoadingPromise: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiLoadingPromise) return apiLoadingPromise;
  apiLoadingPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  });
  return apiLoadingPromise;
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, Props>(function YouTubePlayer(
  { videoId, onReady, onTimeUpdate, onEnded },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    pause: () => playerRef.current?.pauseVideo?.(),
    play: () => playerRef.current?.playVideo?.(),
    seekTo: (s: number) => playerRef.current?.seekTo?.(s, true),
    getCurrentTime: () => playerRef.current?.getCurrentTime?.() ?? 0,
    getDuration: () => playerRef.current?.getDuration?.() ?? 0,
  }));

  useEffect(() => {
    let destroyed = false;
    loadYouTubeAPI().then(() => {
      if (destroyed || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
        },
        events: {
          onReady: () => {
            onReady?.();
            intervalRef.current = window.setInterval(() => {
              const t = playerRef.current?.getCurrentTime?.() ?? 0;
              onTimeUpdate?.(t);
            }, 250);
          },
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.ENDED) onEnded?.();
          },
        },
      });
    });
    return () => {
      destroyed = true;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      try { playerRef.current?.destroy?.(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div className="w-full aspect-video bg-black rounded-md overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
});

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  // Patterns: youtu.be/ID, youtube.com/watch?v=ID, /embed/ID, /shorts/ID
  const patterns = [
    /youtu\.be\/([\w-]{6,})/,
    /[?&]v=([\w-]{6,})/,
    /\/embed\/([\w-]{6,})/,
    /\/shorts\/([\w-]{6,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  // Maybe already an id
  if (/^[\w-]{6,}$/.test(url)) return url;
  return null;
}
