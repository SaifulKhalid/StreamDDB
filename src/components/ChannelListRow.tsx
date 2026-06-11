import React from 'react';
import { Play, Bookmark, BookmarkCheck, ExternalLink, ShieldAlert } from 'lucide-react';
import { Channel } from '../types';

interface ChannelListRowProps {
  key?: string | number;
  channel: Channel;
  isActive: boolean;
  isFavorited: boolean;
  onPlay: (channel: Channel) => any;
  onToggleFavorite: (channel: Channel) => any;
}

export default function ChannelListRow({
  channel,
  isActive,
  isFavorited,
  onPlay,
  onToggleFavorite
}: ChannelListRowProps) {
  // Gracefully handle images falling back to premium geometric avatars
  const getFallbackInitials = (name: string) => {
    return name ? name.substring(0, 2).toUpperCase() : 'TV';
  };

  return (
    <div
      id={`channel-row-${channel.id}`}
      className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 select-none ${
        isActive
          ? 'bg-gradient-to-r from-[#00E5FF]/15 to-[#0083B0]/5 border-[#00E5FF]/50 shadow-[0_0_15px_rgba(0,229,255,0.08)]'
          : 'bg-[#0D1526]/70 border-[#152033]/60 hover:border-slate-800 hover:bg-[#152033]/30'
      }`}
    >
      {/* Tappable core segment mapping directly to triggering play streams */}
      <div 
        onClick={() => onPlay(channel)}
        className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer h-12"
        id={`channel-row-taptarget-${channel.id}`}
      >
        {/* Channel Artwork Container */}
        <div className="w-11 h-11 rounded-lg bg-[#050A15] border border-[#152033] flex items-center justify-center relative overflow-hidden shrink-0 shadow-sm">
          {channel.logo ? (
            <img
              src={channel.logo}
              alt={channel.name}
              className="w-10 h-10 object-contain p-1 group-hover:scale-105 transition-transform"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Remove broken image src and trigger fallback UI
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-[10px] font-extrabold font-mono text-slate-500 uppercase tracking-widest pointer-events-none">
            {getFallbackInitials(channel.name)}
          </div>
          
          {/* Glowing active pulse on image corner */}
          {isActive && (
            <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-[#00E5FF] animate-ping" />
          )}
        </div>

        {/* Text Details layout */}
        <div className="flex flex-col min-w-0 gap-0.5">
          <span className={`text-xs font-bold leading-tight truncate transition-colors ${
            isActive ? 'text-[#00E5FF]' : 'text-slate-100 group-hover:text-white'
          }`}>
            {channel.name}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-mono tracking-wide text-slate-500 font-bold uppercase truncate max-w-[130px]">
              {channel.groupTitle || 'General'}
            </span>
            <span className="text-[10px] text-zinc-650">•</span>
            <span className="text-[9px] font-mono text-slate-550 font-semibold uppercase truncate">
              {channel.country || 'Global'}
            </span>
          </div>
        </div>
      </div>

      {/* Control Buttons Container (Tap action buttons) */}
      <div className="flex items-center gap-2 shrink-0 select-none">
        {/* Favorites bookmark trigger */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(channel);
          }}
          className={`p-2.5 rounded-xl border transition-all active:scale-90 cursor-pointer group/fav ${
            isFavorited
              ? 'bg-[#00E5FF]/10 border-[#00E5FF]/30 text-[#00E5FF]'
              : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-300'
          }`}
          title={isFavorited ? 'Remove Bookmark' : 'Save Program Bookmark'}
          style={{ minWidth: '40px', minHeight: '40px' }}
        >
          <Bookmark className={`w-4 h-4 transition-transform group-hover/fav:scale-105 ${
            isFavorited ? 'fill-current' : ''
          }`} />
        </button>

        {/* Direct Play Streaming Shortcut button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay(channel);
          }}
          className={`p-2.5 rounded-xl border transition-all active:scale-95 cursor-pointer ${
            isActive
              ? 'bg-[#00E5FF] text-[#050A15] border-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.2)] font-bold'
              : 'bg-slate-900 border-slate-800 text-slate-350 hover:bg-[#152033]/50 hover:text-white'
          }`}
          title="Play Stream Video"
          style={{ minWidth: '40px', minHeight: '40px' }}
        >
          <Play className={`w-4 h-4 ${isActive ? 'fill-current' : ''}`} />
        </button>
      </div>
    </div>
  );
}
