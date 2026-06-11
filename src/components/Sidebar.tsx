import React from 'react';
import {
  Home, Tv, Grid, Search, Bookmark, History, Settings as SettingsIcon, LogIn, LogOut, Activity
} from 'lucide-react';

interface SidebarProps {
  user: any;
  activeTab: 'home' | 'livetv' | 'categories' | 'search' | 'favorites' | 'history' | 'settings';
  onChangeTab: (tab: 'home' | 'livetv' | 'categories' | 'search' | 'favorites' | 'history' | 'settings') => void;
  onTriggerAuth: () => void;
  onTriggerLogout: () => void;
  favoritesCount: number;
}

export default function Sidebar({
  user,
  activeTab,
  onChangeTab,
  onTriggerAuth,
  onTriggerLogout,
  favoritesCount
}: SidebarProps) {
  const menuItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'livetv', label: 'Live TV', icon: Tv },
    { id: 'categories', label: 'Categories', icon: Grid },
    { id: 'search', label: 'Search Catalog', icon: Search },
    { id: 'favorites', label: 'My Favorites', icon: Bookmark, badge: favoritesCount > 0 ? favoritesCount : undefined },
    { id: 'history', label: 'Recently Watched', icon: History },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ] as const;

  return (
    <aside id="streamddb-sidebar" className="hidden md:flex md:w-72 bg-[#090F1E] border-r border-[#152033] flex-col h-full font-sans select-none shrink-0 text-white">
      {/* Brand Header */}
      <div className="p-6 border-b border-[#152033] flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF] to-[#0083B0] rounded-xl flex items-center justify-center shadow-lg shadow-[#00E5FF]/10">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
            Stream<span className="text-[#00E5FF]">DDB</span>
          </span>
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold font-mono">LABDDB PREMIUM</span>
        </div>
      </div>

      {/* User Session Controller */}
      <div className="px-5 py-4 border-b border-[#152033] bg-[#090F1E]">
        {user ? (
          <div className="flex items-center justify-between gap-3 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/60 hover:bg-slate-900/60 transition-colors">
            <div className="flex items-center gap-2.5 overflow-hidden">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-8 h-8 rounded-full border border-[#00E5FF]/40"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-850 border border-slate-700 font-bold flex items-center justify-center text-xs text-zinc-350">
                  {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                </div>
              )}
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-semibold text-zinc-200 truncate pr-0.5">
                  {user.displayName || 'Authenticated User'}
                </span>
                <span className="text-[10px] text-slate-400 truncate font-mono">
                  {user.email || 'firebase-auth'}
                </span>
              </div>
            </div>
            <button
              id="sidebar-logout-btn"
              onClick={onTriggerLogout}
              title="Logout Session"
              className="p-1.5 text-slate-450 hover:text-red-400 hover:bg-slate-800/40 rounded-lg transition-all active:scale-90 shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-slate-400 leading-normal font-medium mb-1.5">
              Sign in with your Google Account to cloud synchronise your Watch History, Favorites, and personalized categories.
            </p>
            <button
              id="sidebar-login-btn"
              onClick={onTriggerAuth}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3.5 text-xs font-bold bg-[#00E5FF] text-[#050A15] hover:bg-[#00E5FF]/90 font-sans rounded-xl shadow-lg shadow-cyan-500/10 active:scale-[98%] transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              Sign In with Google
            </button>
          </div>
        )}
      </div>

      {/* Modern Scrolling Menu Nav */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-1.5">
        <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase px-3 py-1.5">
          Navigation
        </span>
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isSelected = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all text-xs font-semibold cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-[#00E5FF]/10 to-transparent text-[#00E5FF] border-l-4 border-[#00E5FF]'
                  : 'text-slate-400 hover:text-white hover:bg-[#152033]/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <IconComponent className={`w-4 h-4 shrink-0 transition-colors ${isSelected ? 'text-[#00E5FF]' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {'badge' in item && item.badge && (
                <span className="bg-[#00E5FF] text-[#050A15] text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full min-w-4 text-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sticky Status Footer */}
      <div className="p-4 border-t border-[#152033] bg-[#090F1E]">
        <div className="bg-[#152033]/20 rounded-xl p-3 border border-[#152033]/40 flex items-center justify-between gap-1.5 select-none text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-mono text-slate-400 font-medium">BDIX CATALOG STREAM</span>
          </div>
          <span className="text-[9px] text-[#00E5FF] font-mono font-semibold bg-[#00E5FF]/10 px-2 py-0.5 rounded">
            ONLINE
          </span>
        </div>
      </div>
    </aside>
  );
}
