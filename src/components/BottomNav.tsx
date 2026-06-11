import React from 'react';
import { Home, Tv, Search, Bookmark, Settings, Grid } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'home' | 'livetv' | 'categories' | 'search' | 'favorites' | 'history' | 'settings';
  onChangeTab: (tab: 'home' | 'livetv' | 'categories' | 'search' | 'favorites' | 'history' | 'settings') => void;
  favoritesCount: number;
  isHidden?: boolean;
}

export default function BottomNav({ activeTab, onChangeTab, favoritesCount, isHidden }: BottomNavProps) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home, badge: undefined },
    { id: 'livetv', label: 'Live TV', icon: Tv, badge: undefined },
    { id: 'categories', label: 'Genres', icon: Grid, badge: undefined },
    { id: 'favorites', label: 'Favorites', icon: Bookmark, badge: favoritesCount > 0 ? favoritesCount : undefined },
    { id: 'settings', label: 'Settings', icon: Settings, badge: undefined }
  ] as const;

  return (
    <div 
      id="mobile-bottom-navbar" 
      className={`md:hidden fixed bottom-1.5 left-1.5 right-1.5 h-16 bg-[#090F1E]/95 backdrop-blur-md border border-[#152033]/80 flex justify-around items-center z-[110] px-2 rounded-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.8)] transition-all duration-500 ease-in-out ${
        isHidden 
          ? 'translate-y-[150%] opacity-0 pointer-events-none scale-95' 
          : 'translate-y-0 opacity-100 pointer-events-auto scale-100'
      }`}
    >
      {navItems.map((item) => {
        const IconComponent = item.icon;
        const isSelected = activeTab === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => onChangeTab(item.id)}
            className="flex flex-col items-center justify-center flex-1 h-full min-h-[48px] relative transition-transform active:scale-95 cursor-pointer"
            id={`bottom-nav-btn-${item.id}`}
          >
            {/* Nav Icon Container */}
            <div className="relative p-1">
              <IconComponent 
                className={`w-5 h-5 transition-colors duration-250 ${
                  isSelected ? 'text-[#00E5FF]' : 'text-slate-450'
                }`} 
              />
              {/* Optional dynamic bubble badge counts */}
              {item.badge !== undefined && (
                <span className="absolute -top-1 -right-2 bg-[#00E5FF] text-[#050A15] text-[8px] font-bold font-mono px-1 py-0.2 rounded-full min-w-[14px] text-center">
                  {item.badge}
                </span>
              )}
            </div>
            
            {/* Visual textual title */}
            <span 
              className={`text-[10px] font-medium tracking-tight mt-0.5 leading-none transition-colors ${
                isSelected ? 'text-[#00E5FF] font-semibold' : 'text-slate-450'
              }`}
            >
              {item.label}
            </span>
            
            {/* Tiny highlight strip at the bottom of active item */}
            {isSelected && (
              <span className="absolute bottom-1 w-5 h-0.5 bg-[#00E5FF] rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
