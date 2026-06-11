import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, PictureInPicture, HelpCircle, Activity, LayoutGrid, RotateCw } from 'lucide-react';

interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
}

interface VideoPlayerProps {
  url: string;
  name: string;
  onRecordHistory?: () => void;
  externalShowControls?: boolean;
}

type AspectRatio = 'fit' | 'fill' | '16-9' | '4-3';

export default function VideoPlayer({ url, name, onRecordHistory, externalShowControls }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // States
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showAspectMenu, setShowAspectMenu] = useState(false);

  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 is Auto
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('fit');

  // Activity timer to hide controllers
  const [showControls, setShowControls] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const keyForVolume = 'streamddb-volume';

  // Load volume preference
  useEffect(() => {
    const saved = localStorage.getItem(keyForVolume);
    if (saved) {
      const parsed = parseFloat(saved);
      setVolume(parsed);
      setIsMuted(parsed === 0);
    }
  }, []);

  // Track stream loading
  useEffect(() => {
    setErrorMsg(null);
    setIsBuffering(true);
    setQualities([]);
    setCurrentQuality(-1);

    const video = videoRef.current;
    if (!video) return;

    // Destroy existing HLS wrapper
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (onRecordHistory) {
      onRecordHistory();
    }

    // Check of direct playback (native safari support) OR Hls.js
    if (Hls.isSupported() && url.endsWith('.m3u8')) {
      const hls = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setIsBuffering(false);
        setErrorMsg(null);
        // Map qualities
        const mappedLevels = hls.levels.map((lvl, index) => ({
          index,
          height: lvl.height,
          bitrate: lvl.bitrate,
        }));
        // Sort in descending order
        mappedLevels.sort((a, b) => b.height - a.height);
        setQualities(mappedLevels);

        video.play().catch(() => {
          setIsPlaying(false);
        });
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        // Track current quality level
        if (hls.autoLevelEnabled) {
          setCurrentQuality(-1);
        } else {
          setCurrentQuality(data.level);
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn("Fatal network error in Hls feed - Retrying loadSource");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("Fatal media error in Hls feed - Recovering");
              hls.recoverMediaError();
              break;
            default:
              setErrorMsg("Playback error: Failed to parse or load live stream.");
              hls.destroy();
              setIsBuffering(false);
              break;
          }
        }
      });
    } else {
      // Direct MP4 / native HLS
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        setIsBuffering(false);
        setErrorMsg(null);
        video.play().catch(() => {
          setIsPlaying(false);
        });
      });

      video.addEventListener('error', () => {
        setErrorMsg("The stream URL is dead, unreachable or doesn't allow cross-origin sharing (CORS).");
        setIsBuffering(false);
      });
    }

    // Video events
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setIsBuffering(false);
      setErrorMsg(null);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [url]);

  // Volume operations
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = isMuted ? 0 : volume;
      video.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Hide controllers timer on mouse inactivity
  const resetTimer = () => {
    setShowControls(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (isPlaying && !showQualityMenu && !showAspectMenu) {
        setShowControls(false);
      }
    }, 3000);
  };

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, showQualityMenu, showAspectMenu]);

  // Toggle state
  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(e => console.log(e));
    }
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    localStorage.setItem(keyForVolume, String(val));
  };

  const handleFullscreen = () => {
    const playerContainer = videoRef.current?.parentElement;
    if (!playerContainer) return;
    if (!document.fullscreenElement) {
      playerContainer.requestFullscreen().catch(err => {
        console.error("Fullscreen error: ", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handlePip = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch (e) {
      console.warn("PIP not supported or failed: ", e);
    }
  };

  const changeLevel = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentQuality(levelIndex);
      setShowQualityMenu(false);
    }
  };

  // Switch Aspect ratio classes
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'fill':
        return 'w-full h-full object-cover';
      case '16-9':
        return 'w-full aspect-video object-contain';
      case '4-3':
        return 'w-full aspect-[4/3] object-contain';
      case 'fit':
      default:
        return 'w-full h-full object-contain';
    }
  };

  return (
    <div
      id="stream-video-container"
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-blue-900/40 group flex items-center justify-center font-sans"
      onMouseMove={resetTimer}
      onMouseLeave={() => setShowControls(false)}
      onMouseEnter={() => setShowControls(true)}
    >
      {/* Actual HTML5 Video Tag with customizable ratios */}
      <video
        ref={videoRef}
        className={`${getAspectRatioClass()} transition-all duration-300`}
        playsInline
        onClick={handlePlayPause}
      />

      {/* Buffering Indicator */}
      {isBuffering && !errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-30 transition-all">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-4" />
          <p className="text-cyan-300 text-sm font-medium tracking-wider font-mono animate-pulse">
            BUFFERING CHANNELS...
          </p>
        </div>
      )}

      {/* Error Fallback Banner */}
      {errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 p-6 text-center z-40 border border-red-500/30">
          <div className="w-14 h-14 rounded-full bg-red-950/50 border border-red-500/40 flex items-center justify-center mb-4 text-red-400 animate-bounce">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h4 className="text-white text-lg font-bold">Stream Failed to Load</h4>
          <p className="text-zinc-400 text-xs max-w-md mt-1 mb-4 leading-relaxed font-mono select-all">
            {url}
          </p>
          <div className="flex gap-2">
            <button
              id="btn-retry-stream"
              onClick={() => {
                setErrorMsg(null);
                setIsBuffering(true);
                const video = videoRef.current;
                if (video) {
                  video.load();
                }
              }}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 border border-blue-400/20 active:scale-95 transition-all"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Reset Source Connections
            </button>
          </div>
        </div>
      )}

      {/* Custom Controls UI (Overlayed) */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-5 z-20 transition-all duration-300 flex flex-col gap-3 ${
          (externalShowControls !== undefined ? (externalShowControls && showControls) : showControls)
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Stream metadata header info inside overlay */}
        <div className="flex items-center justify-between text-white border-b border-zinc-800/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping shrink-0" />
            <span className="text-red-500 font-mono text-[10px] font-bold uppercase tracking-widest shrink-0">
              LIVE BROADCAST
            </span>
            <h3 className="text-sm font-semibold truncate max-w-xs md:max-w-xl text-zinc-100 flex items-center gap-2 ml-1">
              {name}
            </h3>
          </div>
          <div className="text-[11px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
            <Activity className="w-3 h-3" />
            HLS
          </div>
        </div>

        {/* Dynamic Controllers row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Play / Pause */}
            <button
              id="player-play-pause-btn"
              onClick={handlePlayPause}
              className="text-zinc-200 hover:text-cyan-400 transition-colors p-1.5 hover:bg-white/10 rounded-lg"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 group/volume relative">
              <button
                id="player-volume-toggle-btn"
                onClick={handleMuteToggle}
                className="text-zinc-200 hover:text-cyan-400 transition-colors p-1.5 hover:bg-white/10 rounded-lg"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                id="player-volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeSlider}
                className="w-16 md:w-24 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 group-hover/volume:w-20 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Aspect Ratio Correction Selector */}
            <div className="relative">
              <button
                id="player-aspect-ratio-btn"
                title="Aspect Ratio"
                onClick={() => {
                  setShowAspectMenu(!showAspectMenu);
                  setShowQualityMenu(false);
                }}
                className={`text-zinc-200 hover:text-cyan-300 p-1.5 hover:bg-white/10 rounded-lg transition-all ${
                  aspectRatio !== 'fit' ? 'text-cyan-400 bg-cyan-950/40 border border-cyan-800/20' : ''
                }`}
              >
                <LayoutGrid className="w-4.5 h-4.5" />
              </button>
              {showAspectMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-32 bg-zinc-950/95 border border-zinc-800 rounded-lg shadow-xl py-1 z-30 font-mono text-xs">
                  <div className="px-3 py-1.5 font-bold text-zinc-500 border-b border-zinc-900 uppercase tracking-widest text-[9px]">
                    Aspect Ratio
                  </div>
                  {[
                    { value: 'fit', label: 'Fit Screen' },
                    { value: 'fill', label: 'Stretch Fill' },
                    { value: '16-9', label: '16:9 Standard' },
                    { value: '4-3', label: '4:3 Legacy' },
                  ].map(ar => (
                    <button
                      key={ar.value}
                      onClick={() => {
                        setAspectRatio(ar.value as AspectRatio);
                        setShowAspectMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-zinc-800/80 transition-colors flex justify-between items-center ${
                        aspectRatio === ar.value ? 'text-cyan-400 font-bold bg-cyan-950/20' : 'text-zinc-300'
                      }`}
                    >
                      {ar.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Adaptive stream quality levels dropdown (Hls levels) */}
            {qualities.length > 0 && (
              <div className="relative">
                <button
                  id="player-quality-menu-btn"
                  onClick={() => {
                    setShowQualityMenu(!showQualityMenu);
                    setShowAspectMenu(false);
                  }}
                  className={`text-zinc-200 hover:text-cyan-300 p-1.5 hover:bg-white/10 rounded-lg transition-all flex items-center gap-1 text-xs font-mono font-medium ${
                    currentQuality !== -1 ? 'text-cyan-400 bg-cyan-950/40 border border-cyan-800/20' : ''
                  }`}
                  title="Quality Settings"
                >
                  <Settings className="w-4 h-4" />
                  <span>
                    {currentQuality === -1
                      ? 'Auto'
                      : `${qualities.find(q => q.index === currentQuality)?.height || ''}p`}
                  </span>
                </button>
                {showQualityMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-44 bg-zinc-950/95 border border-zinc-800 rounded-lg shadow-xl py-1 z-30 font-mono text-xs">
                    <div className="px-3 py-1.5 font-bold text-zinc-500 border-b border-zinc-900 uppercase tracking-widest text-[9px]">
                      Video Quality
                    </div>
                    {/* Auto block */}
                    <button
                      onClick={() => changeLevel(-1)}
                      className={`w-full text-left px-3 py-2 hover:bg-zinc-800/80 transition-colors flex justify-between items-center border-b border-zinc-900 ${
                        currentQuality === -1 ? 'text-cyan-400 font-bold bg-cyan-950/20' : 'text-zinc-300'
                      }`}
                    >
                      <span>Adaptive / Auto</span>
                    </button>
                    {/* Level map */}
                    {qualities.map(lvl => (
                      <button
                        key={lvl.index}
                        onClick={() => changeLevel(lvl.index)}
                        className={`w-full text-left px-3 py-1.5 hover:bg-zinc-800 transition-colors flex justify-between items-center ${
                          currentQuality === lvl.index ? 'text-cyan-400 font-bold bg-cyan-950/20' : 'text-zinc-300'
                        }`}
                      >
                        <span>{lvl.height}p HD</span>
                        <span className="text-[10px] text-zinc-500">
                          {(lvl.bitrate / 1000000).toFixed(1)} Mbps
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Picture-In-Picture button */}
            <button
              id="player-pip-btn"
              onClick={handlePip}
              title="Mini Player (PiP)"
              className="text-zinc-200 hover:text-cyan-400 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <PictureInPicture className="w-4.5 h-4.5" />
            </button>

            {/* Fullscreen button */}
            <button
              id="player-fullscreen-btn"
              onClick={handleFullscreen}
              title="Cinematic Mode"
              className="text-zinc-200 hover:text-cyan-400 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Maximize className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
