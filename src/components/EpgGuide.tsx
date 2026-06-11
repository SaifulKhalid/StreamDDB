import React, { useEffect, useState } from 'react';
import { Channel, EpgProgram } from '../types';
import { Play, Tv, Clock, HelpCircle, ChevronRight, Bookmark } from 'lucide-react';

interface EpgGuideProps {
  channel: Channel | null;
  onSelectUpcoming?: (ch: Channel) => void;
}

// Deterministic seed helper to generate realistic but fixed programs based on channel identity
function getChannelPrograms(channelName: string, category: string): EpgProgram[] {
  const seedStr = channelName + category;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Pick program pool based on matches
  let pool = [
    { title: 'Prime Time Live Broadcast', desc: 'Comprehensive coverage of breaking updates, news reviews, and interviews with expert correspondents.' },
    { title: 'Global Cinema Special', desc: 'An outstanding selection of localized independent and global cinematic features for movie enthusiast communities.' },
    { title: 'Nature Wildlife Chronicles', desc: 'Journey into the wilderness as explorers capture stunning visual reports of Earth’s complex ecosystems.' },
    { title: 'Cosmic Science & Beyond', desc: 'A futuristic exploration of deep space networks, advanced physics structures, and stellar systems.' },
    { title: 'Retro Action Classics', desc: 'High-octane retro movies loaded with suspense, action chases, and dramatic showdowns.' },
  ];

  if (category.toLowerCase().includes('news') || channelName.toLowerCase().includes('news')) {
    pool = [
      { title: 'Global News Roundup', desc: 'Live breaking bulletins and continuous dispatches from journalists in major capitals around the planet.' },
      { title: 'The Political Arena', desc: 'In-depth debates and interviews dissecting policy drafts, bills, and geopolitical shifts.' },
      { title: 'Business Report & Markets', desc: 'Daily stock tracker, corporate results summaries, and reviews of international supply networks.' },
      { title: 'Tech Frontiers Weekly', desc: 'Looking at how wearable devices, AI neural interfaces, and biotechnology are altering lifestyle parameters.' },
      { title: 'Evening Editorial Dispatch', desc: 'Thoughtful analysis on state policies, civic campaigns, and major structural events.' }
    ];
  } else if (category.toLowerCase().includes('movie') || category.toLowerCase().includes('cinema') || channelName.toLowerCase().includes('movie')) {
    pool = [
      { title: 'Midnight Action Thriller', desc: 'A fast-paced crime movie centering on counter-intelligence ops and cyber heist groups.' },
      { title: 'Vintage Hollywood Showcase', desc: 'Rediscover the golden age with beautifully remastered black-and-white visual masterpieces.' },
      { title: 'Sci-Fi Nexus Chronicles', desc: 'Earth astronomers establish communication lines with colony ships running inside the Andromeda system.' },
      { title: 'Indie Directors Shortlist', desc: 'Exploring experimental cinematic editing, sound designs, and storytelling formats by new creators.' },
      { title: 'Cyberpunk Neon Future', desc: 'Robotic synthetics debate legal boundaries under glowing advertising towers of dystopian metropolis sectors.' }
    ];
  } else if (category.toLowerCase().includes('sport') || channelName.toLowerCase().includes('sport')) {
    pool = [
      { title: 'Championship Live Match Day', desc: 'Live regional broadcast of high-stakes football leagues with full pitch side audio and commentary.' },
      { title: 'Extreme Sports Special', desc: 'Adrenaline junkies tackle steep mountain peaks, dangerous wave tubes, and desert track timelines.' },
      { title: 'Weekly Formula Racing Digest', desc: 'Detailed paddock telemetry logs, grid positioning updates, and pitstop tactical reviews.' },
      { title: 'Retro Boxing Classics', desc: 'Historic heavyweights trade blows in legendary arena cards that redefined professional athletics.' },
      { title: 'Inside the Grid', desc: 'Interviews with coaches and athletic trainers tracking fitness metrics, speed recovery, and player cards.' }
    ];
  }

  // Construct programs starting from 4 hours ago, each lasting between 30 and 120 mins
  const programs: EpgProgram[] = [];
  const now = new Date();
  
  // Set start to 4 hours ago
  let currentTime = new Date(now.getTime() - 4 * 3600 * 1000);
  currentTime.setMinutes(currentTime.getMinutes() - (currentTime.getMinutes() % 15)); // Align to 15-min intervals
  currentTime.setSeconds(0);

  // Generate 8 consecutive programs to cover details
  for (let i = 0; i < 8; i++) {
    const itemSeed = Math.abs(Math.sin(hash + i));
    const durationMins = 30 + (Math.floor(itemSeed * 6) * 15); // 30, 45, 60, 75, 90, 105, 120 mins
    
    // Choose title deterministically
    const poolIndex = Math.floor(itemSeed * pool.length);
    const selected = pool[poolIndex] || pool[0];

    // Alter title lightly for variety
    const qualifiers = ['', ' - Live', ' HD', ' Special', ' Series', ' Special Edition'];
    const qIndex = Math.floor(itemSeed * qualifiers.length);
    const fullTitle = selected.title + qualifiers[qIndex];

    const endTime = new Date(currentTime.getTime() + durationMins * 60000);

    programs.push({
      title: fullTitle,
      description: selected.desc,
      start: new Date(currentTime),
      end: new Date(endTime),
      durationMins,
    });

    currentTime = endTime;
  }

  return programs;
}

export default function EpgGuide({ channel, onSelectUpcoming }: EpgGuideProps) {
  const [now, setNow] = useState(new Date());
  const [programs, setPrograms] = useState<EpgProgram[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | 'all'>('current');

  // Keep clock running
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Recalculate programs when active channel shifts
  useEffect(() => {
    if (channel) {
      const generated = getChannelPrograms(channel.name, channel.groupTitle || 'Uncategorized');
      setPrograms(generated);
    } else {
      setPrograms([]);
    }
  }, [channel]);  if (!channel) {
    return (
      <div className="bg-[#0D1526] border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center font-sans shadow-lg">
        <Tv className="w-10 h-10 text-[#00E5FF]/50 mb-3" />
        <h4 className="text-zinc-200 text-sm font-semibold">No Guide Selected</h4>
        <p className="text-slate-400 text-xs mt-1 max-w-xs leading-relaxed">
          Open an active streaming channel to populate the live electronic program guide timelines.
        </p>
      </div>
    );
  }

  // Find the exact active program running right now
  const activeProgram = programs.find(p => now >= p.start && now < p.end);
  const futurePrograms = programs.filter(p => p.start > now);

  // Math helper for progress bar inside active program
  const getProgressPercentage = (prog: EpgProgram) => {
    const totalMs = prog.end.getTime() - prog.start.getTime();
    const elapsedMs = now.getTime() - prog.start.getTime();
    const progress = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
    return parseFloat(progress.toFixed(1));
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div id="epg-guide-container" className="bg-[#0D1526] border border-slate-800 rounded-xl overflow-hidden font-sans shadow-xl">
      {/* Visual Tab controller */}
      <div className="flex bg-[#0D1526] px-4 py-3 border-b border-slate-800 justify-between items-center">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#00E5FF]" />
          <h3 className="text-zinc-200 text-xs font-bold uppercase tracking-wider font-mono">
            GUIDE (EPG)
          </h3>
        </div>
        
        <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('current')}
            className={`px-3 py-1 text-[11px] font-mono font-bold rounded-md transition-all ${
              activeTab === 'current'
                ? 'bg-[#00E5FF] text-[#050A15]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            NOW
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 text-[11px] font-mono font-bold rounded-md transition-all ${
              activeTab === 'all'
                ? 'bg-[#00E5FF] text-[#050A15]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            GRID
          </button>
        </div>
      </div>

      {activeTab === 'current' ? (
        <div className="p-5 flex flex-col gap-4">
          {activeProgram ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-start gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#00E5FF] font-mono font-semibold tracking-wider bg-[#00E5FF]/10 border border-[#00E5FF]/20 px-2.5 py-0.5 rounded-full w-fit">
                    {formatTime(activeProgram.start)} - {formatTime(activeProgram.end)} ({activeProgram.durationMins}m)
                  </span>
                  <h4 className="text-zinc-100 text-base font-bold mt-2 hover:text-[#00E5FF] transition-colors">
                    {activeProgram.title}
                  </h4>
                </div>
                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 shrink-0 p-1 bg-slate-900 border border-slate-850 rounded">
                  <span>Progress: {getProgressPercentage(activeProgram)}%</span>
                </div>
              </div>

              {/* Progress Slider */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-gradient-to-r from-[#00E5FF] to-blue-500 rounded-full transition-all duration-1000"
                  style={{ width: `${getProgressPercentage(activeProgram)}%` }}
                />
              </div>

              <p className="text-slate-400 text-xs leading-relaxed mt-1">
                {activeProgram.description}
              </p>

              {/* Next Program Preview */}
              {futurePrograms.length > 0 && (
                <div className="mt-4 border-t border-slate-800 pt-4">
                  <h5 className="text-[10px] text-slate-500 font-mono font-bold tracking-widest uppercase mb-2">
                    Up Next on this Stream
                  </h5>
                  <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 hover:bg-slate-800/40 transition-all flex items-center justify-between group cursor-pointer">
                    <div className="flex items-start gap-2.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500 mt-1" />
                      <div>
                        <p className="text-xs font-semibold text-zinc-200 group-hover:text-[#00E5FF] transition-colors">
                          {futurePrograms[0].title}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Starts at {formatTime(futurePrograms[0].start)} (Duration: {futurePrograms[0].durationMins}m)
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-[#00E5FF] transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-slate-500 text-xs">No active content indexed. Standard scheduling underway.</p>
            </div>
          )}
        </div>
      ) : (
        /* Full schedule timelines list */
        <div className="divide-y divide-slate-800/80 max-h-72 overflow-y-auto custom-scrollbar">
          {programs.map((prog, idx) => {
            const isNowPlaying = now >= prog.start && now < prog.end;
            const isOver = now >= prog.end;

            return (
              <div
                key={idx}
                className={`p-4 flex flex-col gap-1 hover:bg-slate-850/40 transition-colors relative ${
                  isNowPlaying ? 'bg-[#00E5FF]/10 border-l border-[#00E5FF]' : ''
                } ${isOver ? 'opacity-40' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-zinc-450 font-semibold">
                      {formatTime(prog.start)} - {formatTime(prog.end)}
                    </span>
                    {isNowPlaying && (
                      <span className="bg-red-650 text-[9px] text-white px-1.5 py-0.2 rounded font-bold uppercase font-mono tracking-widest leading-none">
                        NOW
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {prog.durationMins} mins
                  </span>
                </div>
                <h4 className={`text-xs font-semibold mt-1 ${isNowPlaying ? 'text-[#00E5FF]' : 'text-[#00E5FF]'}`}>
                  {prog.title}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                  {prog.description}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
