import React, { useState } from 'react';
import { Channel } from '../types';
import { Play, Bookmark, BookmarkCheck, Tv, Film, Disc } from 'lucide-react';

interface ChannelCardProps {
  key?: string | number;
  channel: Channel;
  isActive: boolean;
  isFavorited: boolean;
  onPlay: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
}

export default function ChannelCard({
  channel,
  isActive,
  isFavorited,
  onPlay,
  onToggleFavorite
}: ChannelCardProps) {
  // Graceful failure trigger for broken/forbidden cross-side channel logos
  const [imgError, setImgError] = useState(false);

  // Return realistic fallback icons based on categories in case logo is missing
  const getFallbackIcon = () => {
    const title = (channel.groupTitle || '').toLowerCase();
    const name = channel.name.toLowerCase();
    if (title.includes('movie') || title.includes('cinema') || name.includes('movie') || name.includes('cinema')) {
      return <Film className="w-10 h-10 text-cyan-400" />;
    }
    if (title.includes('sport') || name.includes('sport')) {
      return <Disc className="w-10 h-10 text-emerald-400" />;
    }
    return <Tv className="w-10 h-10 text-blue-400" />;
  };

  return (
    <div
      id={`channel-card-${channel.id}`}
      className={`relative rounded-xl overflow-hidden bg-[#0D1526] border transition-all duration-300 group ${
        isActive
          ? 'border-[#00E5FF] ring-2 ring-[#00E5FF]/10 shadow-[0_0_20px_rgba(0,229,255,0.15)] bg-[#00E5FF]/5'
          : 'border-slate-800 hover:border-[#00E5FF]/50 hover:shadow-xl hover:-translate-y-1'
      }`}
    >
      {/* Target screen or Thumbnail box with micro-hover blur */}
      <div 
        onClick={() => onPlay(channel)}
        className="aspect-video w-full bg-slate-900 border-b border-slate-800/60 flex items-center justify-center relative cursor-pointer overflow-hidden"
      >
        {channel.logo && !imgError ? (
          <img
            src={channel.logo}
            alt={channel.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-900/65">
            {getFallbackIcon()}
          </div>
        )}

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
          <div className="w-12 h-12 rounded-full bg-[#00E5FF] text-[#050A15] flex items-center justify-center font-bold shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300 active:scale-90">
            <Play className="w-6 h-6 fill-current ml-0.5 text-[#050A15]" />
          </div>
        </div>

        {/* Instant Favorite Toggle Ribbon */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // Avoid triggering video launch
            onToggleFavorite(channel);
          }}
          className={`absolute top-2.5 right-2.5 p-1.5 rounded-lg border backdrop-blur-md z-25 active:scale-90 transition-all ${
            isFavorited
              ? 'bg-[#00E5FF]/10 border-[#00E5FF]/40 text-[#00E5FF]'
              : 'bg-black/40 border-slate-800 text-slate-400 hover:text-white'
          }`}
          title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
        >
          {isFavorited ? (
            <Bookmark className="w-4 h-4 fill-[#00E5FF]" />
          ) : (
            <Bookmark className="w-4 h-4" />
          )}
        </button>

        {/* Quick Group Title Ribbon */}
        {channel.groupTitle && (
          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md border border-slate-800/40 text-[9px] font-mono text-[#00E5FF] tracking-wider font-semibold uppercase max-w-[130px] truncate">
            {channel.groupTitle}
          </span>
        )}
      </div>

      {/* Under-Card Context Labeling */}
      <div className="p-3.5 flex flex-col gap-1 cursor-pointer" onClick={() => onPlay(channel)}>
        <h4 className="text-zinc-100 text-xs font-bold leading-snug line-clamp-1 group-hover:text-[#00E5FF] transition-colors">
          {channel.name}
        </h4>
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-0.5">
          <span className="truncate max-w-[120px]" title={channel.url}>
            IPTV Link Shared
          </span>
          <span className="text-[9px] text-slate-500">
            {channel.tvgId ? `ID: ${channel.tvgId}` : 'No Track'}
          </span>
        </div>
      </div>
    </div>
  );
}
