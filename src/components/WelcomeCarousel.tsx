import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tv, Sparkles, Grid, Bookmark, History, ChevronRight, Play } from 'lucide-react';
import { User } from 'firebase/auth';

interface WelcomeCarouselProps {
  user: User | null;
  activeChannelCount: number;
  favoritesCount: number;
  historyCount: number;
  onChangeTab: (tab: 'home' | 'livetv' | 'categories' | 'search' | 'favorites' | 'history' | 'settings') => void;
}

export default function WelcomeCarousel({
  user,
  activeChannelCount,
  favoritesCount,
  historyCount,
  onChangeTab
}: WelcomeCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const cards = [
    {
      id: 'greeting',
      title: user ? `Welcome back, ${user.displayName || 'Friend'}` : 'Welcome to StreamDDB',
      subtitle: 'Premium TV Live Streaming experience',
      desc: 'Optimized for mobile-first playback with automated latency check and ultra-fast BDIX streams.',
      badge: 'PROFILES',
      color: 'from-[#00E5FF]/20 to-[#0083B0]/10',
      icon: Sparkles,
      actionText: 'Explore App Settings',
      action: () => onChangeTab('settings'),
    },
    {
      id: 'livetv',
      title: 'Live TV is Online',
      subtitle: `${activeChannelCount || 40}+ active streams validated`,
      desc: 'Automatic HEAD requests block dead links. Premium catalog uptime checks complete in real-time.',
      badge: 'LIVE BROADCASTS',
      color: 'from-emerald-500/10 to-teal-500/5',
      icon: Tv,
      actionText: 'Watch Live TV Now',
      action: () => onChangeTab('livetv'),
    },
    {
      id: 'categories',
      title: 'Explore Categories',
      subtitle: 'Browse regional, cinema & news',
      desc: 'Instant access to global themed channels. Grouped collections sorted based on your region.',
      badge: 'GENRES',
      color: 'from-blue-500/10 to-indigo-500/5',
      icon: Grid,
      actionText: 'Browse Genres',
      action: () => onChangeTab('categories'),
    },
    {
      id: 'favorites',
      title: 'Quick Bookmark Access',
      subtitle: `${favoritesCount} Saved Channels`,
      desc: 'Synchronize your bookmarks across apps. Click the bookmark overlay on any card to add.',
      badge: 'FAVORITES',
      color: 'from-pink-500/10 to-purple-500/5',
      icon: Bookmark,
      actionText: 'View My favorites',
      action: () => onChangeTab('favorites'),
    },
    {
      id: 'history',
      title: 'Recently Experienced',
      subtitle: `${historyCount} items in history`,
      desc: 'Log back into your last played streams instantly with single-click history recall tracking.',
      badge: 'CONTINUE PLAYING',
      color: 'from-amber-500/10 to-yellow-500/5',
      icon: History,
      actionText: 'Browse Watch History',
      action: () => onChangeTab('history'),
    }
  ];

  // Auto-advance
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [cards.length]);

  const currentCard = cards[currentIndex];
  const IconComponent = currentCard.icon;

  return (
    <div className="relative rounded-2xl border border-[#152033] bg-[#090F1E] overflow-hidden select-none shadow-xl">
      {/* Background slide/fade wrapper */}
      <div className={`p-5 md:p-6 bg-gradient-to-br ${currentCard.color} transition-colors duration-500 min-h-[160px] md:min-h-[190px] flex flex-col justify-between relative`}>
        
        {/* Animated Badge & Action Indicator */}
        <div className="flex justify-between items-center mb-2 z-10">
          <span className="text-[10px] font-mono font-bold tracking-widest text-[#00E5FF] uppercase bg-[#00E5FF]/10 px-2.5 py-1 rounded-full border border-[#00E5FF]/20">
            {currentCard.badge}
          </span>
          <div className="flex gap-1">
            {cards.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  currentIndex === idx ? 'bg-[#00E5FF] w-4' : 'bg-slate-700 hover:bg-slate-600'
                }`}
                title={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Info & Icon Column */}
        <div className="flex gap-4 items-start z-10">
          <div className="w-10 h-10 rounded-xl bg-[#090F1E] border border-[#152033] flex items-center justify-center text-[#00E5FF] shrink-0 mt-1 shadow-md">
            <IconComponent className="w-5 h-5" />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="text-base md:text-lg font-extrabold text-white tracking-tight leading-snug">
              {currentCard.title}
            </h2>
            <p className="text-xs text-[#00E5FF]/90 font-semibold font-mono tracking-wide leading-none">
              {currentCard.subtitle}
            </p>
            <p className="text-slate-450 text-[11px] leading-relaxed mt-1 hidden md:block max-w-xl">
              {currentCard.desc}
            </p>
          </div>
        </div>

        {/* Call-to-action button */}
        <div className="flex justify-end mt-4 z-10">
          <button
            onClick={currentCard.action}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-950/80 hover:bg-[#00E5FF] hover:text-[#050A15] border border-[#152033] hover:border-[#00E5FF] text-white text-[11px] font-bold tracking-wide rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg"
          >
            <span>{currentCard.actionText}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Accent light flare */}
        <div className="absolute right-0 bottom-0 w-44 h-44 bg-[#00E5FF]/5 blur-[60px] rounded-full pointer-events-none" />
      </div>
    </div>
  );
}
