import React from 'react';
import { ShieldCheck, Bookmark, Tv, Grid } from 'lucide-react';

interface StatsDashboardProps {
  activeCount: number;
  totalCount: number;
  categoriesCount: number;
  favoritesCount: number;
  activeFeedName: string | null;
}

export default function StatsDashboard({
  activeCount,
  totalCount,
  categoriesCount,
  favoritesCount,
  activeFeedName
}: StatsDashboardProps) {
  const activePercent = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 100;

  return (
    <div id="stats-ribbon-dashboard" className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6 font-sans">
      
      {/* Stream Health / Active Ratio Card */}
      <div className="bg-[#0D1526] p-3 md:p-4 rounded-xl border border-[#152033] flex items-center gap-2.5 md:gap-4 shadow-lg hover:border-[#152033]/80 transition-all select-none">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/20 flex items-center justify-center text-[#00E5FF] shrink-0">
          <ShieldCheck className="w-4 h-4 md:w-5 md:h-5" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-slate-400 text-[9px] md:text-[10px] uppercase tracking-wider font-mono font-bold truncate">
            Catalog Health
          </span>
          <span className="text-white text-sm md:text-base font-extrabold font-mono mt-0.5 whitespace-nowrap">
            {activePercent}% <span className="text-[10px] md:text-xs font-normal text-slate-500 font-sans">Valid</span>
          </span>
        </div>
      </div>

      {/* Channels Indexed Tile */}
      <div className="bg-[#0D1526] p-3 md:p-4 rounded-xl border border-[#152033] flex items-center gap-2.5 md:gap-4 shadow-lg hover:border-[#152033]/80 transition-all select-none">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-cyan-950/20 border border-cyan-900/40 flex items-center justify-center text-cyan-400 shrink-0">
          <Tv className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-slate-400 text-[9px] md:text-[10px] uppercase tracking-wider font-mono font-bold truncate">
            Live TV Streams
          </span>
          <span className="text-white text-sm md:text-base font-extrabold font-mono mt-0.5 whitespace-nowrap">
            {activeCount} <span className="text-[10px] md:text-xs text-slate-500 font-sans">Live</span>
          </span>
        </div>
      </div>

      {/* Categories parsed Tile */}
      <div className="bg-[#0D1526] p-3 md:p-4 rounded-xl border border-[#152033] flex items-center gap-2.5 md:gap-4 shadow-lg hover:border-[#152033]/80 transition-all select-none">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-blue-950/20 border border-blue-900/40 flex items-center justify-center text-blue-400 shrink-0">
          <Grid className="w-4 h-4 md:w-5 md:h-5" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-slate-400 text-[9px] md:text-[10px] uppercase tracking-wider font-mono font-bold truncate">
            Categories
          </span>
          <span className="text-white text-sm md:text-base font-extrabold font-mono mt-0.5 whitespace-nowrap">
            {categoriesCount} <span className="text-[10px] md:text-xs text-slate-500 font-sans">Groups</span>
          </span>
        </div>
      </div>

      {/* Saved Favorites Tile */}
      <div className="bg-[#0D1526] p-3 md:p-4 rounded-xl border border-[#152033] flex items-center gap-2.5 md:gap-4 shadow-lg hover:border-[#152033]/80 transition-all select-none">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/25 flex items-center justify-center text-[#00E5FF] shrink-0">
          <Bookmark className="w-4 h-4 md:w-5 md:h-5 fill-current" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-slate-400 text-[9px] md:text-[10px] uppercase tracking-wider font-mono font-bold truncate">
            My Favorites
          </span>
          <span className="text-white text-sm md:text-base font-extrabold font-mono mt-0.5 whitespace-nowrap">
            {favoritesCount} <span className="text-[10px] md:text-xs text-slate-500 font-sans">Saved</span>
          </span>
        </div>
      </div>

    </div>
  );
}
