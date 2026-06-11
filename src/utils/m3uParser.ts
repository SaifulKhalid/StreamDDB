import { Channel } from '../types';

/**
 * Parses a standard M3U / M3U8 IPTV Playlist string.
 * Extracts channel names, stream URLs, categories (group-title), logos, and tvgIds.
 */
export function parseM3U(content: string, playlistId: string): Channel[] {
  const lines = content.split(/\r?\n/);
  const channels: Channel[] = [];
  let currentInfo: Partial<Channel> | null = null;
  let idCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const infoParts = line.match(/#EXTINF:\s*(?:-?\d+|"[^"]*")?\s*(.*)/);
      const attributesStr = infoParts ? infoParts[1] : '';
      
      let name = '';
      const commaIndex = attributesStr.lastIndexOf(',');
      let tagsStr = attributesStr;
      
      if (commaIndex !== -1) {
        tagsStr = attributesStr.substring(0, commaIndex);
        name = attributesStr.substring(commaIndex + 1).trim();
      } else {
        name = attributesStr.trim() || `Channel ${idCounter}`;
      }

      // Parse tags inside quotes or single words
      const attributes: Record<string, string> = {};
      const regexAttr = /([\w-]+)\s*=\s*(?:"([^"]*?)"|'([^']*?)'|([^\s\x22\x27]+))/g;
      let match;
      while ((match = regexAttr.exec(tagsStr)) !== null) {
        const key = match[1].toLowerCase();
        const val = match[2] || match[3] || match[4] || '';
        attributes[key] = val;
      }

      const logo = attributes['tvg-logo'] || attributes['logo'] || attributes['tvg-logo-url'] || '';
      const groupTitle = attributes['group-title'] || attributes['group'] || 'Uncategorized';
      const tvgId = attributes['tvg-id'] || attributes['tvg-name'] || '';

      currentInfo = {
        name,
        logo,
        groupTitle,
        tvgId,
      };
    } else if (line.startsWith('#')) {
      // Ignore general comments or headers
      continue;
    } else {
      // URL line
      if (currentInfo) {
        const id = `ch-${playlistId}-${idCounter++}`;
        channels.push({
          id,
          playlistId,
          name: currentInfo.name || 'Unknown Channel',
          logo: currentInfo.logo || '',
          groupTitle: currentInfo.groupTitle || 'Uncategorized',
          url: line,
          tvgId: currentInfo.tvgId || '',
        });
        currentInfo = null;
      } else {
        // Just raw URLs without EXTINF (rare but possible)
        const id = `ch-${playlistId}-${idCounter++}`;
        channels.push({
          id,
          playlistId,
          name: `Channel ${idCounter - 1}`,
          logo: '',
          groupTitle: 'Uncategorized',
          url: line,
          tvgId: '',
        });
      }
    }
  }

  return channels;
}

/**
 * Feeds in default placeholder IPTV channels in case the user has no M3U playlists loaded.
 * This guarantees the player can be tested and experienced instantly.
 */
export function getDemoChannels(): Channel[] {
  return [
    {
      id: "demo-ch-1",
      playlistId: "demo-playlist",
      name: "Sintel (Live Cinema Trailer)",
      logo: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=100&q=80",
      groupTitle: "Cinema / Movies",
      url: "https://multiplatform-f.akamaihd.net/i/multi/will/sintel/pc-delivery/,co_sintel_8000k.mp4,co_sintel_2500k.mp4,co_sintel_1500k.mp4,.csmil/master.m3u8",
      tvgId: "sintel.live"
    },
    {
      id: "demo-ch-2",
      playlistId: "demo-playlist",
      name: "Tears of Steel (Sci-Fi HLS Stream)",
      logo: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=100&q=80",
      groupTitle: "Cinema / Movies",
      url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
      tvgId: "tears.live"
    },
    {
      id: "demo-ch-3",
      playlistId: "demo-playlist",
      name: "Red Bull TV News Stream (M3U8 Sample)",
      logo: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=100&q=80",
      groupTitle: "Action Sports",
      url: "https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8",
      tvgId: "redbull.news"
    },
    {
      id: "demo-ch-4",
      playlistId: "demo-playlist",
      name: "Big Buck Bunny (Multi-audio Clip)",
      logo: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=100&q=80",
      groupTitle: "Cartoons & Kids",
      url: "https://amc-theaters-hls.s3.amazonaws.com/bunny_master.m3u8",
      tvgId: "bunny.clip"
    },
    {
      id: "demo-ch-5",
      playlistId: "demo-playlist",
      name: "BIP (HD Nature Scenic Sample)",
      logo: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=100&q=80",
      groupTitle: "Nature & Science",
      url: "https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8",
      tvgId: "nature.bip"
    }
  ];
}
