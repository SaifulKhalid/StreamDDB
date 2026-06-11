export interface Playlist {
  id: string;
  name: string;
  url?: string;
  channelCount: number;
  createdAt: any; // Firestore server field or Date
  userId: string;
}

export interface Channel {
  id: string;
  playlistId: string;
  name: string;
  logo?: string;
  groupTitle?: string;
  url: string;
  tvgId?: string;
  country?: string;
}

export interface Favorite {
  id: string;
  userId: string;
  channelId: string;
  channelName: string;
  logo?: string;
  url: string;
  playlistId: string;
  groupTitle?: string;
  createdAt: any;
}

export interface WatchHistory {
  id: string;
  userId: string;
  channelId: string;
  channelName: string;
  logo?: string;
  url: string;
  playlistId: string;
  groupTitle?: string;
  watchedAt: any;
  duration?: number; // total watched in seconds
}

export interface EpgProgram {
  title: string;
  description: string;
  start: Date;
  end: Date;
  durationMins: number;
}
