import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection, query, where, getDocs, setDoc, deleteDoc, doc,
  orderBy, limit, serverTimestamp
} from 'firebase/firestore';
import { AnimatePresence, motion } from 'motion/react';
import {
  Play, Tv, Bookmark, History, Sparkles, SlidersHorizontal, LogIn,
  Activity, Info, X, Shield, RefreshCw, ChevronLeft, ChevronRight, HelpCircle,
  Search, ArrowRight, ChevronDown, Clock, Grid
} from 'lucide-react';

import { db, auth, signInWithGoogle, logoutUser, handleFirestoreError, OperationType, validateConnection } from './firebase';
import { Channel, Favorite, WatchHistory } from './types';

// Components
import Sidebar from './components/Sidebar';
import ChannelCard from './components/ChannelCard';
import VideoPlayer from './components/VideoPlayer';
import EpgGuide from './components/EpgGuide';
import StatsDashboard from './components/StatsDashboard';
import BottomNav from './components/BottomNav';
import WelcomeCarousel from './components/WelcomeCarousel';
import ChannelListRow from './components/ChannelListRow';

export default function App() {
  // Authentication pool
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Tabs structure: home, livetv, categories, search, favorites, history, settings
  const [activeTab, setActiveTab ] = useState<'home' | 'livetv' | 'categories' | 'search' | 'favorites' | 'history' | 'settings'>('home');

  // Responsive device width state
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Channel Lists & Pagination Hooks
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  
  // Filtering & Pagination parameter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalChannelsCount, setTotalChannelsCount] = useState(0);
  const [totalPagesCount, setTotalPagesCount] = useState(1);
  const channelsLimit = 100;

  // Favorites & Watch Pools
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistory[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [isPlaybackUIActive, setIsPlaybackUIActive] = useState(true);

  // Inactivity tracking mechanism for immersive mobile playback
  useEffect(() => {
    if (!activeChannel) {
      setIsPlaybackUIActive(true);
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      setIsPlaybackUIActive(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsPlaybackUIActive(false);
      }, 5000); // Auto-hide navbar and controls after 5 seconds of inactivity
    };

    resetInactivityTimer();

    const handleUserInteraction = () => {
      resetInactivityTimer();
    };

    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('touchmove', handleUserInteraction, { passive: true });
    window.addEventListener('scroll', handleUserInteraction, { passive: true });
    window.addEventListener('click', handleUserInteraction, { passive: true });
    window.addEventListener('mousemove', handleUserInteraction, { passive: true });

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('touchmove', handleUserInteraction);
      window.removeEventListener('scroll', handleUserInteraction);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('mousemove', handleUserInteraction);
    };
  }, [activeChannel, isMobile]);

  // UI state overlays
  const [isDataSyncing, setIsDataSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<any>(null);
  const [notice, setNotice] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  // Check network/database connection
  useEffect(() => {
    validateConnection();
    fetchBackendStats();
  }, []);

  // Track Firebase Auth state & fetch linked user metrics
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);

      if (currentUser) {
        await fetchUserData(currentUser.uid);
      } else {
        loadGuestOfflineCache();
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Handle data reload whenever active constraints or tabs change
  useEffect(() => {
    if (activeTab === 'livetv') {
      fetchCatalogChannels();
    }
  }, [activeTab, currentPage, selectedCategory, selectedCountry]);

  // Fetch all active channels from Server's API
  const fetchCatalogChannels = async (searchOverride?: string) => {
    setIsDataSyncing(true);
    try {
      const searchParam = searchOverride !== undefined ? searchOverride : searchQuery;
      let url = `/api/channels?page=${currentPage}&limit=${channelsLimit}`;
      
      if (selectedCategory) url += `&category=${encodeURIComponent(selectedCategory)}`;
      if (selectedCountry) url += `&country=${encodeURIComponent(selectedCountry)}`;
      if (searchParam) url += `&search=${encodeURIComponent(searchParam)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
        setTotalChannelsCount(data.total || 0);
        setTotalPagesCount(data.totalPages || 1);
        
        // Auto-arm first available channel on boot if none active
        if (!activeChannel && data.channels?.length > 0) {
          setActiveChannel(data.channels[0]);
        }
      }
    } catch (e) {
      console.error("Failed to load catalog channels: ", e);
      setNotice({ type: 'error', text: 'Unable to synchronize server stream catalog.' });
    } finally {
      setIsDataSyncing(false);
    }
  };

  // Fetch categories, countries, and stats from Backend API
  const fetchBackendStats = async () => {
    try {
      const statsRes = await fetch('/api/stats');
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setSyncStats(stats);
      }

      const catsRes = await fetch('/api/categories');
      if (catsRes.ok) {
        const cats = await catsRes.json();
        setCategories(cats || []);
      }

      const countRes = await fetch('/api/countries');
      if (countRes.ok) {
        const countr = await countRes.json();
        setCountries(countr || []);
      }

      // Initial backup load of active channels for Home preview
      const channelsRes = await fetch(`/api/channels?page=1&limit=40`);
      if (channelsRes.ok) {
        const data = await channelsRes.json();
        setChannels(data.channels || []);
        if (data.channels?.length > 0) {
          setActiveChannel(data.channels[0]);
        }
      }
    } catch (e) {
      console.warn("Backend metadata lookup failed: ", e);
    }
  };

  // Load local client-side persistence as guest fallback
  const loadGuestOfflineCache = () => {
    try {
      const savedFavorites = localStorage.getItem('streamddb-guest-favorites');
      const savedHistory = localStorage.getItem('streamddb-guest-history');

      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites));
      } else {
        setFavorites([]);
      }

      if (savedHistory) {
        setWatchHistory(JSON.parse(savedHistory));
      } else {
        setWatchHistory([]);
      }
    } catch (e) {
      console.warn("Local Storage parsing failed: ", e);
    }
  };

  // Pull personalized user data from Firestore on sign-in
  const fetchUserData = async (uid: string) => {
    setIsDataSyncing(true);
    try {
      // 1. Fetch User Favorites
      const favPath = `users/${uid}/favorites`;
      let favSnap;
      try {
        favSnap = await getDocs(collection(db, favPath));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, favPath);
        throw err;
      }
      const loadedFavs: Favorite[] = [];
      favSnap.forEach((doc) => {
        loadedFavs.push({ id: doc.id, ...doc.data() } as Favorite);
      });
      setFavorites(loadedFavs);

      // 2. Fetch Watch History
      const histPath = `users/${uid}/history`;
      const histQuery = query(collection(db, histPath), orderBy('watchedAt', 'desc'), limit(15));
      let histSnap;
      try {
        histSnap = await getDocs(histQuery);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, histPath);
        throw err;
      }
      const loadedHistory: WatchHistory[] = [];
      histSnap.forEach((doc) => {
        loadedHistory.push({ id: doc.id, ...doc.data() } as WatchHistory);
      });
      setWatchHistory(loadedHistory);
    } catch (e) {
      console.error("Firestore user sync failed: ", e);
      setNotice({ type: 'info', text: 'Authenticated offline backup active.' });
      loadGuestOfflineCache();
    } finally {
      setIsDataSyncing(false);
    }
  };

  // Add / Remove favorites
  const handleToggleFavorite = async (channel: Channel) => {
    const isFav = favorites.some((f) => f.channelId === channel.id);
    const favId = `fav-${channel.id}`;
    let updatedFavoritesArray: Favorite[] = [];

    if (isFav) {
      updatedFavoritesArray = favorites.filter((f) => f.channelId !== channel.id);
      setFavorites(updatedFavoritesArray);

      if (user) {
        try {
          const path = `users/${user.uid}/favorites/${favId}`;
          await deleteDoc(doc(db, `users/${user.uid}/favorites`, favId)).catch((err) =>
            handleFirestoreError(err, OperationType.DELETE, path)
          );
        } catch (e) {
          console.warn("Firestore delete favorite failed: ", e);
        }
      }
    } else {
      const newFav: Favorite = {
        id: favId,
        userId: user?.uid || 'guest',
        channelId: channel.id,
        channelName: channel.name,
        logo: channel.logo || '',
        url: channel.url,
        playlistId: channel.playlistId,
        groupTitle: channel.groupTitle || 'Uncategorized',
        createdAt: new Date().toISOString()
      };

      updatedFavoritesArray = [newFav, ...favorites];
      setFavorites(updatedFavoritesArray);

      if (user) {
        try {
          const path = `users/${user.uid}/favorites/${favId}`;
          await setDoc(doc(db, `users/${user.uid}/favorites`, favId), {
            id: favId,
            userId: user.uid,
            channelId: channel.id,
            channelName: channel.name,
            logo: channel.logo || '',
            url: channel.url,
            playlistId: channel.playlistId,
            groupTitle: channel.groupTitle || 'Uncategorized',
            createdAt: serverTimestamp()
          }).catch((err) => handleFirestoreError(err, OperationType.CREATE, path));
        } catch (e) {
          console.warn("Firestore save favorite failed: ", e);
        }
      }
    }

    if (!user) {
      localStorage.setItem('streamddb-guest-favorites', JSON.stringify(updatedFavoritesArray));
    }
  };

  // Record viewed channel stream history
  const handleRecordHistory = async (channel: Channel) => {
    const historyId = `hist-${Date.now()}`;
    const newEntry: WatchHistory = {
      id: historyId,
      userId: user?.uid || 'guest',
      channelId: channel.id,
      channelName: channel.name,
      logo: channel.logo || '',
      url: channel.url,
      playlistId: channel.playlistId,
      groupTitle: channel.groupTitle || 'Uncategorized',
      watchedAt: new Date().toISOString()
    };

    const updatedHistoryArray = [
      newEntry,
      ...watchHistory.filter((h) => h.channelId !== channel.id)
    ].slice(0, 15);
    setWatchHistory(updatedHistoryArray);

    if (user) {
      try {
        const path = `users/${user.uid}/history/${historyId}`;
        await setDoc(doc(db, `users/${user.uid}/history`, historyId), {
          id: historyId,
          userId: user.uid,
          channelId: channel.id,
          channelName: channel.name,
          logo: channel.logo || '',
          url: channel.url,
          playlistId: channel.playlistId,
          groupTitle: channel.groupTitle || 'Uncategorized',
          watchedAt: serverTimestamp()
        }).catch((err) => handleFirestoreError(err, OperationType.CREATE, path));
      } catch (e) {
        console.warn("Firestore save history failed: ", e);
      }
    } else {
      localStorage.setItem('streamddb-guest-history', JSON.stringify(updatedHistoryArray));
    }
  };

  // Google sign in trigger
  const handleAuthTrigger = async () => {
    try {
      await signInWithGoogle();
    } catch {
      setNotice({ type: 'error', text: 'Google authentication was cancelled.' });
    }
  };

  // Sign out trigger
  const handleLogoutTrigger = async () => {
    try {
      await logoutUser();
      setFavorites([]);
      setWatchHistory([]);
      loadGuestOfflineCache();
      setActiveTab('home');
    } catch (e) {
      console.error(e);
    }
  };

  // Force Synchronize catalog admin trigger
  const forceTriggerSync = async () => {
    try {
      setIsDataSyncing(true);
      const res = await fetch('/post/api/sync/trigger', { method: 'POST' }); // Wait! Standard POST trigger
      const fallbackPost = await fetch('/api/sync/trigger', { method: 'POST' });
      if (fallbackPost.ok) {
        setNotice({ type: 'info', text: 'System catalog refresh triggered successfully!' });
        setTimeout(() => {
          fetchBackendStats();
          fetchCatalogChannels();
        }, 4000);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setIsDataSyncing(false);
    }
  };

  // Select channel to stream
  const selectActiveChannelToPlay = (ch: Channel) => {
    setActiveChannel(ch);
    handleRecordHistory(ch);
  };

  // Page index helpers
  const handlePageNext = () => {
    if (currentPage < totalPagesCount) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePageBack = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  // Switch tabs & reset filters safely
  const handleTabShift = (tab: 'home' | 'livetv' | 'categories' | 'search' | 'favorites' | 'history' | 'settings') => {
    setActiveTab(tab);
    if (tab !== 'livetv') {
      setSelectedCategory('');
      setSelectedCountry('');
      setCurrentPage(1);
    }
  };

  // Handle visual card click inside Categories tab
  const handleSelectCategoryCard = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setCurrentPage(1);
    setActiveTab('livetv');
  };

  // Horizontal scroller row for favorite lists mapping to full objects
  const getMappedFavoriteChannels = () => {
    const favoriteChannelIds = favorites.map(f => f.channelId);
    return channels.filter(ch => favoriteChannelIds.includes(ch.id));
  };

  return (
    <div className="flex h-screen bg-[#050A15] overflow-hidden select-none font-sans text-white relative">
      
      {/* Platform Leftside Menu Navigation */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        onChangeTab={handleTabShift}
        onTriggerAuth={handleAuthTrigger}
        onTriggerLogout={handleLogoutTrigger}
        favoritesCount={favorites.length}
      />

      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#050A15]">
        
        {/* Mobile Top Brand Header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3.5 bg-[#090F1E] border-b border-[#152033]/80 sticky top-0 z-40 shrink-0 select-none w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF] to-[#0083B0] rounded-xl flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <span className="text-md font-extrabold tracking-tight text-white flex items-center gap-1">
              Stream<span className="text-[#00E5FF]">DDB</span>
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {isDataSyncing && (
              <RefreshCw className="w-4 h-4 text-[#00E5FF] animate-spin shrink-0" />
            )}
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <button 
              onClick={() => handleTabShift('settings')}
              className="w-8 h-8 rounded-full border border-[#00E5FF]/40 bg-[#090F1E] overflow-hidden flex items-center justify-center text-xs text-[#00E5FF] cursor-pointer"
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <span className="font-semibold">{user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}</span>
              )}
            </button>
          </div>
        </div>
        
        {/* Prime Scrolling Canvas */}
        <div className="flex-1 flex flex-col p-4 md:p-6 pb-24 md:pb-6 overflow-y-auto custom-scrollbar gap-4 md:gap-6">
          
          {/* Header Dashboard Banner */}
          <div className="flex justify-between items-center bg-[#050A15] pb-4 border-b border-[#152033] flex-wrap gap-4 select-none">
            <div className="flex flex-col">
              <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#00E5FF]" />
                {activeTab === 'home' && 'Entertainment Lounge'}
                {activeTab === 'livetv' && 'Live TV Dashboard'}
                {activeTab === 'categories' && 'Program Categories'}
                {activeTab === 'search' && 'Search Library'}
                {activeTab === 'favorites' && 'Personal Showcase'}
                {activeTab === 'history' && 'Streaming Log'}
                {activeTab === 'settings' && 'Platform Settings'}
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-mono uppercase tracking-widest leading-none">
                {activeTab === 'home' && 'Premium BDIX Curated Highlights'}
                {activeTab === 'livetv' && 'Realtime Interactive Broadcasting Node'}
                {activeTab === 'categories' && 'Curated thematic stream categorisations'}
                {activeTab === 'search' && 'Discover active channels instantly'}
                {activeTab === 'favorites' && 'Your curated list of premium bookmark bookmarks'}
                {activeTab === 'history' && 'Recently experienced broadcasts'}
                {activeTab === 'settings' && 'Manage connections and cache monitoring indicators'}
              </p>
            </div>
            
            {isDataSyncing && (
              <div className="flex items-center gap-2 text-xs font-mono text-[#00E5FF] bg-[#00E5FF]/10 border border-[#00E5FF]/20 px-3 py-1.5 rounded-full select-none">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>CATALOG SYNCING...</span>
              </div>
            )}
          </div>

          <StatsDashboard
            activeCount={syncStats?.activeChannels || channels.length}
            totalCount={syncStats?.totalChannels || channels.length}
            categoriesCount={categories.length || 5}
            favoritesCount={favorites.length}
            activeFeedName={activeChannel?.name || null}
          />

          {/* Alert / Notice ribbon */}
          {notice && (
            <div className={`p-3.5 rounded-xl border flex items-center justify-between font-mono text-xs ${
              notice.type === 'error' 
                ? 'bg-red-950/30 border-red-500/30 text-red-400' 
                : 'bg-[#00E5FF]/10 border-[#00E5FF]/30 text-[#00E5FF]'
            }`}>
              <div className="flex items-center gap-2.5">
                <Info className="w-4 h-4" />
                <span>{notice.text}</span>
              </div>
              <button onClick={() => setNotice(null)} className="text-zinc-500 hover:text-white shrink-0 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STAGE PLAYER (Displayed in suitable tabs when active channel is selected) */}
          {activeChannel && (activeTab === 'home' || activeTab === 'livetv' || activeTab === 'search' || activeTab === 'favorites' || activeTab === 'history') && (
            isMobile ? (
              <div id="immersive-mobile-playback-overlay" className="fixed inset-0 bg-black z-[100] flex flex-col justify-center items-center select-none overflow-hidden">
                {/* Immersive Mobile Top Controls bar */}
                <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/95 to-transparent p-4 z-40 flex items-center justify-between pointer-events-auto transition-all duration-300">
                  {/* Top Left: Back Button - ALWAYS visible */}
                  <button
                    onClick={() => setActiveChannel(null)}
                    className="bg-black/60 border border-slate-800/80 p-2.5 rounded-full text-white flex items-center justify-center cursor-pointer active:scale-90 transition-transform shadow-lg shrink-0"
                    title="Close Screen"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  {/* Center Column: Watermark and Name */}
                  <div className="flex-1 flex flex-col items-center justify-center px-6 text-center select-none">
                    {/* Top Center: Watermark subtle logo "Powered by LabDDB" - ALWAYS visible */}
                    <span className="text-[#00E5FF] text-[9.5px] font-black tracking-widest uppercase font-mono bg-[#00E5FF]/5 border border-[#00E5FF]/10 px-2 py-0.5 rounded-full shadow-inner leading-none transition-transform pointer-events-none">
                      Powered by LabDDB
                    </span>
                    {/* Active Channel Name - Disappears after inactivity timeout */}
                    <span className={`text-white text-xs font-bold font-sans tracking-tight mt-1 truncate max-w-[150px] transition-all duration-500 ease-in-out ${
                      isPlaybackUIActive 
                        ? 'opacity-100 max-h-5 scale-100 translate-y-0' 
                        : 'opacity-0 max-h-0 scale-90 -translate-y-2 pointer-events-none overflow-hidden mt-0'
                    }`}>
                      {activeChannel.name}
                    </span>
                  </div>

                  {/* Balanced spacer for perfect center alignment */}
                  <div className="w-10 shrink-0" />
                </div>
                
                {/* Immersive Video Player block */}
                <div className="w-full h-full flex items-center justify-center">
                  <VideoPlayer
                    url={activeChannel.url}
                    name={activeChannel.name}
                    onRecordHistory={() => handleRecordHistory(activeChannel)}
                    externalShowControls={isPlaybackUIActive}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <VideoPlayer
                  url={activeChannel.url}
                  name={activeChannel.name}
                  onRecordHistory={() => handleRecordHistory(activeChannel)}
                  externalShowControls={true}
                />
              </div>
            )
          )}

          {/* MAIN TABS GRAPHICAL CONTAINERS */}
          <div className="min-h-[300px]">
            <AnimatePresence mode="wait">
              
              {/* 1. HOME LOUNGE */}
              {activeTab === 'home' && (
                <motion.div
                  key="home"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-6"
                >
                  {/* Animated Welcome Carousel replacing obsolete Spotlight cards */}
                  <WelcomeCarousel
                    user={user}
                    activeChannelCount={syncStats?.activeChannels || channels.length}
                    favoritesCount={favorites.length}
                    historyCount={watchHistory.length}
                    onChangeTab={handleTabShift}
                  />

                  {/* Native Mobile Quick Directions Grid */}
                  <div className="grid grid-cols-4 gap-2.5">
                    <button
                      onClick={() => handleTabShift('livetv')}
                      className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-[#0D1526] border border-[#152033] hover:border-[#00E5FF]/40 active:scale-95 transition-all text-center cursor-pointer min-h-[48px] select-none"
                    >
                      <Tv className="w-5 h-5 text-[#00E5FF] mb-1.5" />
                      <span className="text-[10px] font-bold font-sans tracking-tight text-slate-100">Live TV</span>
                    </button>
                    
                    <button
                      onClick={() => handleTabShift('categories')}
                      className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-[#0D1526] border border-[#152033] hover:border-[#00E5FF]/40 active:scale-95 transition-all text-center cursor-pointer min-h-[48px] select-none"
                    >
                      <Grid className="w-5 h-5 text-[#00E5FF] mb-1.5" />
                      <span className="text-[10px] font-bold font-sans tracking-tight text-slate-100">Genres</span>
                    </button>

                    <button
                      onClick={() => handleTabShift('favorites')}
                      className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-[#0D1526] border border-[#152033] hover:border-[#00E5FF]/40 active:scale-95 transition-all text-center cursor-pointer min-h-[48px] select-none"
                    >
                      <Bookmark className="w-5 h-5 text-[#00E5FF] mb-1.5" />
                      <span className="text-[10px] font-bold font-sans tracking-tight text-slate-100">Saved</span>
                    </button>

                    <button
                      onClick={() => handleTabShift('history')}
                      className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-[#0D1526] border border-[#152033] hover:border-[#00E5FF]/40 active:scale-95 transition-all text-center cursor-pointer min-h-[48px] select-none"
                    >
                      <History className="w-5 h-5 text-[#00E5FF] mb-1.5" />
                      <span className="text-[10px] font-bold font-sans tracking-tight text-slate-100">History</span>
                    </button>
                  </div>

                  {/* Personal WatchHistory / Continue Watching slider */}
                  {watchHistory.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#00E5FF] flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#00E5FF]" />
                          Continue Watching
                        </h3>
                        <button
                          onClick={() => handleTabShift('history')}
                          className="text-[10px] font-extrabold text-[#00E5FF] uppercase tracking-wider flex items-center gap-0.5 cursor-pointer hover:underline"
                        >
                          <span>All</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex overflow-x-auto pb-2 gap-3.5 custom-scrollbar -mx-4 px-4 md:mx-0 md:px-0 scroll-smooth">
                        {watchHistory.slice(0, 6).map((hist) => {
                          const channelRepr: Channel = {
                            id: hist.channelId,
                            playlistId: hist.playlistId || 'fixed-catalog',
                            name: hist.channelName,
                            logo: hist.logo || '',
                            groupTitle: hist.groupTitle,
                            url: hist.url,
                            tvgId: hist.channelId
                          };
                          return (
                            <div key={hist.id} className="w-[144px] shrink-0">
                              <ChannelCard
                                channel={channelRepr}
                                isActive={activeChannel?.id === hist.channelId}
                                isFavorited={favorites.some((f) => f.channelId === hist.channelId)}
                                onPlay={selectActiveChannelToPlay}
                                onToggleFavorite={handleToggleFavorite}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Mini categories shortcut catalog chips (not full screen grid) */}
                  <div className="flex flex-col gap-2.5 mt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#00E5FF] flex items-center gap-2">
                      <Grid className="w-4 h-4 text-[#00E5FF]" />
                      Featured Collections
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {categories.length === 0 ? (
                        <p className="text-slate-500 text-[10px] font-mono uppercase">Syncing Genres...</p>
                      ) : (
                        categories.slice(0, 6).map((cat, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectCategoryCard(cat)}
                            className="px-3.5 py-2.5 rounded-xl bg-[#0D1526]/80 hover:bg-[#00E5FF]/10 text-slate-300 text-xs font-medium border border-[#152033]/80 hover:border-[#00E5FF]/35 transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                            title={`Search category ${cat}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF]/80"></span>
                            <span className="truncate max-w-[120px]">{cat}</span>
                          </button>
                        ))
                      )}
                      {categories.length > 6 && (
                        <button
                          onClick={() => handleTabShift('categories')}
                          className="px-3.5 py-2.5 rounded-xl bg-[#090F1E] hover:bg-slate-900 text-[#00E5FF] text-xs font-semibold border border-dashed border-[#00E5FF]/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                          title="Show additional lists"
                        >
                          <span>+{categories.length - 6} More</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                </motion.div>
              )}

              {/* 2. LIVE TV */}
              {activeTab === 'livetv' && (
                <motion.div
                  key="livetv"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-4"
                >
                  {/* Pinned Search & Filtering Header */}
                  <div className="flex flex-col gap-3.5 bg-[#090F1E] p-4 rounded-2xl border border-[#152033] sticky top-0 z-20 shadow-md">
                    {/* Instant Search input */}
                    <div className="relative">
                      <Search className="absolute left-4 top-3.5 w-4 h-4 text-[#00E5FF]/70 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Type to search live channels instantly..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                          fetchCatalogChannels(e.target.value);
                        }}
                        className="w-full bg-[#050A15] border border-[#152033] rounded-xl py-3 pl-11 pr-4 text-xs text-zinc-100 placeholder:text-slate-500 focus:outline-none focus:border-[#00E5FF] shadow-inner font-medium"
                      />
                    </div>

                    {/* Meta quick selection controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#152033]/40">
                      <div className="flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-[#00E5FF]" />
                        <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest">Filters</span>
                      </div>

                      <div className="flex gap-2 flex-grow sm:flex-grow-0 justify-end">
                        {/* Category Dropdown */}
                        <select
                          value={selectedCategory}
                          onChange={(e) => {
                            setSelectedCategory(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="bg-[#050A15] text-[11px] text-slate-300 px-3 py-2 rounded-xl border border-[#152033] focus:outline-none focus:border-[#00E5FF] font-semibold"
                        >
                          <option value="">All Categories</option>
                          {categories.map((cat, idx) => (
                            <option key={idx} value={cat}>{cat}</option>
                          ))}
                        </select>

                        {/* Country Dropdown */}
                        <select
                          value={selectedCountry}
                          onChange={(e) => {
                            setSelectedCountry(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="bg-[#050A15] text-[11px] text-slate-300 px-3 py-2 rounded-xl border border-[#152033] focus:outline-none focus:border-[#00E5FF] font-semibold"
                        >
                          <option value="">All Locations</option>
                          {countries.map((cty, idx) => (
                            <option key={idx} value={cty}>{cty}</option>
                          ))}
                        </select>

                        {/* Clear button */}
                        {(selectedCategory || selectedCountry) && (
                          <button
                            onClick={() => {
                              setSelectedCategory('');
                              setSelectedCountry('');
                              setCurrentPage(1);
                            }}
                            className="bg-[#00E5FF]/10 text-[#00E5FF] text-[11px] px-3 py-1 rounded-xl font-bold border border-[#00E5FF]/20 cursor-pointer hover:bg-[#00E5FF]/20"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Section grouped Channel List */}
                  <div className="flex flex-col gap-4">
                    {channels.length === 0 ? (
                      <div className="py-20 text-center bg-slate-900/30 p-4 border border-[#152033] rounded-2xl flex flex-col items-center">
                        <Tv className="w-10 h-10 text-slate-750 mb-2.5" />
                        <p className="text-slate-400 text-xs font-semibold">No channels match search index</p>
                        <p className="text-slate-500 text-[10px] uppercase font-mono mt-0.5">Try resetting criteria or filters</p>
                      </div>
                    ) : (
                      <>
                        {/* Grouping channels locally by their Category */}
                        {(Object.entries(
                          channels.reduce<Record<string, Channel[]>>((acc, ch) => {
                            const grp = ch.groupTitle || 'General';
                            if (!acc[grp]) acc[grp] = [];
                            acc[grp].push(ch);
                            return acc;
                          }, {})
                        ) as [string, Channel[]][]).map(([grpName, grpChannels]) => {
                          const isCollapsed = collapsedCategories[grpName] || false;
                          return (
                            <div key={grpName} className="flex flex-col mb-1 select-none">
                              {/* Sticky Category header element */}
                              <div
                                onClick={() => {
                                  setCollapsedCategories((prev) => ({
                                    ...prev,
                                    [grpName]: !isCollapsed,
                                  }));
                                }}
                                className="sticky top-[100px] z-10 flex items-center justify-between px-3 py-2.5 bg-[#0D1526] border-y border-[#152033] text-[#00E5FF] rounded-xl cursor-pointer hover:bg-[#152033]/50 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-extrabold tracking-wide font-sans">{grpName}</span>
                                  <span className="text-[10px] font-mono font-bold bg-[#00E5FF]/15 text-[#00E5FF] px-2 py-0.5 rounded-full border border-[#00E5FF]/20">
                                    {grpChannels.length}
                                  </span>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-450 transition-transform duration-200 ${
                                  isCollapsed ? '-rotate-90' : 'rotate-0'
                                }`} />
                              </div>

                              {/* Rows list container */}
                              {!isCollapsed && (
                                <div className="flex flex-col gap-2.5 mt-2.5 pl-0.5 animate-fadeIn">
                                  {grpChannels.map((ch) => (
                                    <ChannelListRow
                                      key={ch.id}
                                      channel={ch}
                                      isActive={activeChannel?.id === ch.id}
                                      isFavorited={favorites.some((f) => f.channelId === ch.id)}
                                      onPlay={selectActiveChannelToPlay}
                                      onToggleFavorite={handleToggleFavorite}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Interactive Pagination Buttons */}
                        {totalPagesCount > 1 && (
                          <div className="flex justify-between items-center bg-[#090F1E] px-4 py-3.5 rounded-xl border border-[#152033] mt-4 shadow-md">
                            <span className="text-[10px] font-mono text-slate-400 font-bold uppercase select-none">
                              Page {currentPage} of {totalPagesCount}
                            </span>
                            <div className="flex gap-2 font-mono text-xs">
                              <button
                                onClick={handlePageBack}
                                disabled={currentPage === 1}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold ${
                                  currentPage === 1
                                    ? 'bg-slate-900/30 border-slate-800 text-slate-550 cursor-not-allowed opacity-50'
                                    : 'bg-[#152033]/40 border-[#152033] hover:text-[#00E5FF] text-slate-200 cursor-pointer'
                                }`}
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span>BACK</span>
                              </button>
                              <button
                                onClick={handlePageNext}
                                disabled={currentPage === totalPagesCount}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold ${
                                  currentPage === totalPagesCount
                                    ? 'bg-slate-900/30 border-slate-800 text-slate-550 cursor-not-allowed opacity-50'
                                    : 'bg-[#152033]/40 border-[#152033] hover:text-[#00E5FF] text-slate-200 cursor-pointer'
                                }`}
                              >
                                <span>NEXT</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              {/* 3. CATEGORIES INDEX */}
              {activeTab === 'categories' && (
                <motion.div
                  key="categories"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-6"
                >
                  {categories.length === 0 ? (
                    <div className="py-12 text-center bg-[#0d1c33]/20 border border-[#17273e] p-4 rounded-xl">
                      <p className="text-slate-455 text-xs">Indexing available categorias...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {categories.map((cat, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectCategoryCard(cat)}
                          className="group relative rounded-2xl p-5 bg-[#0D1526] border border-[#152033] hover:border-[#00E5FF]/40 cursor-pointer transition-all hover:bg-[#152033]/40 flex flex-col justify-between aspect-square select-none max-h-40"
                        >
                          <div className="w-10 h-10 rounded-xl bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20 flex items-center justify-center font-bold tracking-tight text-sm font-mono uppercase">
                            {cat.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-white font-extrabold text-sm tracking-tight group-hover:text-[#00E5FF] truncate leading-tight">
                              {cat}
                            </h4>
                            <span className="text-[10px] font-mono text-slate-500 font-semibold uppercase tracking-wider mt-1 block">
                              Explore streams
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* 4. SEARCH CANVAS */}
              {activeTab === 'search' && (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-6"
                >
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search channels, highlights, locations..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                        fetchCatalogChannels(e.target.value);
                      }}
                      className="w-full bg-[#0D1526] border border-[#152033] rounded-2xl py-4.5 pl-12 pr-6 text-sm text-zinc-100 placeholder:text-slate-500 focus:outline-none focus:border-[#00E5FF] group shadow-xl font-medium"
                    />
                    <SlidersHorizontal className="absolute left-4.5 top-4.5 text-slate-500 cursor-pointer hover:text-white" />
                  </div>

                  {channels.length === 0 ? (
                    <div className="py-16 text-center bg-slate-900/30 p-4 border border-[#152033] rounded-xl flex flex-col items-center">
                      <HelpCircle className="w-10 h-10 text-slate-750 mb-2" />
                      <p className="text-slate-400 text-xs">Awaiting search input or matching criteria</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                      {channels.map((ch) => (
                        <ChannelCard
                          key={ch.id}
                          channel={ch}
                          isActive={activeChannel?.id === ch.id}
                          isFavorited={favorites.some((f) => f.channelId === ch.id)}
                          onPlay={selectActiveChannelToPlay}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* 5. FAVORITES GRID */}
              {activeTab === 'favorites' && (
                <motion.div
                  key="favorites"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-6"
                >
                  {favorites.length === 0 ? (
                    <div className="py-20 text-center bg-slate-900/30 border border-[#152033] rounded-2xl p-6 flex flex-col items-center select-none">
                      <Bookmark className="w-10 h-10 text-slate-700 mb-3" />
                      <h4 className="text-zinc-200 text-sm font-bold">No Bookmarks Saved</h4>
                      <p className="text-slate-500 text-xs mt-1 max-w-xs leading-relaxed">
                        Tap the bookmark icon on any stream thumbnail in Home or Live TV dashboards to build a personalized shortcuts catalog.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                      {favorites.map((fav) => {
                        const channelRepr: Channel = {
                          id: fav.channelId,
                          playlistId: fav.playlistId || 'fixed-catalog',
                          name: fav.channelName,
                          logo: fav.logo || '',
                          groupTitle: fav.groupTitle,
                          url: fav.url,
                          tvgId: fav.channelId
                        };
                        return (
                          <ChannelCard
                            key={fav.id}
                            channel={channelRepr}
                            isActive={activeChannel?.id === fav.channelId}
                            isFavorited={true}
                            onPlay={selectActiveChannelToPlay}
                            onToggleFavorite={handleToggleFavorite}
                          />
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* 6. HISTORY LOG */}
              {activeTab === 'history' && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-6"
                >
                  {watchHistory.length === 0 ? (
                    <div className="py-20 text-center bg-slate-900/30 border border-[#152033] rounded-2xl p-6 flex flex-col items-center select-none">
                      <History className="w-10 h-10 text-slate-750 mb-3" />
                      <h4 className="text-zinc-200 text-sm font-bold">Log is Blank</h4>
                      <p className="text-slate-500 text-xs mt-1 max-w-xs leading-relaxed">
                        Streams loaded in active playback screens populates watch tracking lists for rapid recovery.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                      {watchHistory.map((hist) => {
                        const channelRepr: Channel = {
                          id: hist.channelId,
                          playlistId: hist.playlistId || 'fixed-catalog',
                          name: hist.channelName,
                          logo: hist.logo || '',
                          groupTitle: hist.groupTitle,
                          url: hist.url,
                          tvgId: hist.channelId
                        };
                        return (
                          <ChannelCard
                            key={hist.id}
                            channel={channelRepr}
                            isActive={activeChannel?.id === hist.channelId}
                            isFavorited={favorites.some((f) => f.channelId === hist.channelId)}
                            onPlay={selectActiveChannelToPlay}
                            onToggleFavorite={handleToggleFavorite}
                          />
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* 7. SETTINGS */}
              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                  {/* Account Information Panel */}
                  <div className="bg-[#0b1222]/80 p-6 rounded-2xl border border-[#152033] flex flex-col justify-between shadow-lg">
                    <div className="flex flex-col gap-4 select-none">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[#00E5FF] flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-[#00E5FF]" />
                        Cloud Auths & Sessions
                      </h3>
                      <p className="text-xs text-slate-400 leading-normal">
                        StreamDDB stores active channel bookmarks and history tracking indices securely within standard Firebase Auth systems. Your account synchronisation prevents layout losses when reloading browser caches.
                      </p>

                      {user ? (
                        <div className="flex items-center gap-3 bg-slate-900/40 p-3.5 border border-slate-800 rounded-xl mt-2 overflow-hidden">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt="Account"
                              className="w-10 h-10 rounded-full border border-[#00E5FF]/40"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm text-[#00E5FF]">
                              A
                            </div>
                          )}
                          <div className="flex flex-col truncate pr-1">
                            <span className="text-stone-100 text-xs font-semibold truncate leading-tight">
                              {user.displayName || 'Google Member'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 truncate mt-0.5 leading-none">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-xl p-4 mt-2">
                          <p className="text-[11px] text-slate-500 text-center leading-normal">
                            Not authenticated yet. Favorites and list logs remain strictly transient in current browser storage caches.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 border-t border-[#152033] pt-4.5">
                      {user ? (
                        <button
                          onClick={handleLogoutTrigger}
                          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 font-sans text-xs font-bold rounded-xl border border-red-500/20 active:scale-98 transition-all cursor-pointer"
                        >
                          Sign Out Session
                        </button>
                      ) : (
                        <button
                          onClick={handleAuthTrigger}
                          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#00E5FF] text-[#050A15] font-sans text-xs font-bold rounded-xl active:scale-98 hover:bg-[#00E5FF]/90 transition-all cursor-pointer shadow-lg shadow-cyan-500/10"
                        >
                          <LogIn className="w-4 h-4" />
                          Link Google Account
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Server status & sync information */}
                  <div className="bg-[#0b1222]/80 p-6 rounded-2xl border border-[#152033] flex flex-col justify-between shadow-lg">
                    <div className="flex flex-col gap-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[#00E5FF] flex items-center gap-1.5 font-sans">
                        <Activity className="w-4 h-4 text-[#00E5FF]" />
                        Catalog Worker Logs
                      </h3>
                      <p className="text-xs text-slate-400 leading-normal select-none">
                        IPTV source list is managed at the server database without exposing raw M3U URLs. Health monitors scan streaming streams periodically in lightweight HEAD threads to block broken streams.
                      </p>

                      <div className="flex flex-col gap-2 bg-slate-900/40 p-3.5 rounded-xl border border-slate-800 text-xs font-mono">
                        <div className="flex justify-between border-b border-slate-800/40 pb-1.5">
                          <span className="text-slate-500 font-sans font-semibold">Catalog URL</span>
                          <span className="max-w-[140px] truncate text-slate-350" title="https://raw.githubusercontent.com/abusaeeidx/Mrgify-BDIX-IPTV/main/playlist.m3u">Github playlist.m3u</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/40 pb-1.5 mt-1">
                          <span className="text-slate-500 font-sans font-semibold">Uptime Status</span>
                          <span className="text-emerald-400">Stable Node</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/40 pb-1.5 mt-1">
                          <span className="text-slate-500 font-sans font-semibold">Last Synchronization</span>
                          <span className="text-slate-350">{syncStats?.lastSyncTime ? new Date(syncStats.lastSyncTime).toLocaleTimeString() : 'In process'}</span>
                        </div>
                        <div className="flex justify-between pb-0.5 mt-1">
                          <span className="text-slate-500 font-sans font-semibold">Health Valuations</span>
                          <span className="text-slate-350">{syncStats?.lastHealthCheckTime ? new Date(syncStats.lastHealthCheckTime).toLocaleTimeString() : 'Scheduled'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-[#152033] pt-4.5">
                      <button
                        onClick={forceTriggerSync}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-900/60 hover:bg-slate-800/60 text-[#00E5FF] font-sans text-xs font-bold rounded-xl border border-slate-800 active:scale-98 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Force Catalog Sync Check
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </div>

        {/* EPG / Program Guide sidebar */}
        {!isMobile && (
          <div className="w-full md:w-80 bg-[#070D1A] border-t md:border-t-0 md:border-l border-[#152033] p-5 shrink-0 flex flex-col gap-6 overflow-y-auto custom-scrollbar select-none">
            <div className="flex flex-col gap-1 border-b border-[#152033]/60 pb-3">
              <h3 className="text-zinc-150 text-xs font-bold tracking-wider uppercase font-mono">
                Guide Schedule
              </h3>
              <p className="text-slate-500 text-[10px] leading-normal font-sans">
                EPG schedules are synchronized based on active playback timelines.
              </p>
            </div>
            <EpgGuide channel={activeChannel} />
          </div>
        )}

      </main>

      {/* Persistent Touch-friendly Mobile Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={handleTabShift}
        favoritesCount={favorites.length}
        isHidden={isMobile && activeChannel !== null && !isPlaybackUIActive}
      />

    </div>
  );
}
