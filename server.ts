import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import "dotenv/config";

const app = express();
const PORT = 3000;
const CACHE_FILE = path.join(process.cwd(), "channels-cache.json");
const M3U_SOURCE_URL = process.env.IPTV_SOURCE_URL || "https://raw.githubusercontent.com/abusaeeidx/Mrgify-BDIX-IPTV/main/playlist.m3u";

// Enable JSON parsing
app.use(express.json());

interface ServerChannel {
  id: string;
  playlistId: string;
  name: string;
  logo: string;
  groupTitle: string;
  url: string;
  tvgId: string;
  country: string;
  status: 'Active' | 'Inactive' | 'Error';
  lastValidated?: string;
  errorMsg?: string;
}

// In-Memory Catalog Storage
let globalChannels: ServerChannel[] = [];
let isSyncing = false;
let lastSyncTime: string | null = null;
let lastHealthCheckTime: string | null = null;

// Helper to calculate simple Base64 or hash of string to guarantee stable IDs
function generateStableId(url: string): string {
  // Simple deterministic djb2 hash function for stable channel IDs
  let hash = 5381;
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 33) ^ url.charCodeAt(i);
  }
  return "ch-" + Math.abs(hash).toString(36);
}

// Helper to smart-extract country metadata from channel data
function extractCountry(name: string, group: string): string {
  const bdKeywords = ['bd', 'bangla', 'bdix', 'dhaka', 'somoy', 'independent', 'atn', 'channel i', 'ntv', 'jamuna', 'shomoy', 'ekattor', 'somoy', 'rabbani'];
  const inKeywords = ['india', 'star vijay', 'sony', 'zee', 'star sports', 'colors', 'hindi', 'tamil'];
  const usKeywords = ['usa', 'us', 'american', 'hbo', 'cnn', 'fox'];
  
  const searchStr = `${name} ${group}`.toLowerCase();
  
  if (bdKeywords.some(keyword => searchStr.includes(keyword))) {
    return 'Bangladesh';
  }
  if (inKeywords.some(keyword => searchStr.includes(keyword))) {
    return 'India';
  }
  if (usKeywords.some(keyword => searchStr.includes(keyword))) {
    return 'United States';
  }
  
  if (group && group !== 'Uncategorized' && group.length < 30) {
    return group;
  }
  
  return 'Global';
}

// Parse raw M3U playlist file content
function parseM3UPlaylist(content: string): ServerChannel[] {
  const lines = content.split(/\r?\n/);
  const channels: ServerChannel[] = [];
  let currentInfo: any = null;

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
        name = attributesStr.trim();
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
        name: name || 'Unknown Channel',
        logo,
        groupTitle,
        tvgId,
      };
    } else if (line.startsWith('#')) {
      continue;
    } else {
      // Stream Link
      if (currentInfo) {
        const id = generateStableId(line);
        channels.push({
          id,
          playlistId: "fixed-mrgify-playlist",
          name: currentInfo.name,
          logo: currentInfo.logo,
          groupTitle: currentInfo.groupTitle,
          url: line,
          tvgId: currentInfo.tvgId,
          country: extractCountry(currentInfo.name, currentInfo.groupTitle),
          status: 'Active', // Default status, validated asynchronously
          lastValidated: new Date().toISOString()
        });
        currentInfo = null;
      }
    }
  }
  return channels;
}

// Single Stream Live Playback Verification Service
async function validateSingleStream(url: string): Promise<{ status: 'Active' | 'Inactive' | 'Error'; errorMsg?: string }> {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { status: 'Error', errorMsg: 'Invalid URL scheme' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s network timeout

    let response;
    try {
      // Lightweight GET pulling only the first few bytes to test playability and headers
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IPTVStreamPlayer/1.0',
          'Range': 'bytes=0-100'
        },
        signal: controller.signal
      });
    } catch {
      // Secondary HEAD attempt as fallback for servers rejecting Byte Range requests
      const headController = new AbortController();
      const headTimeout = setTimeout(() => headController.abort(), 6000);
      response = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: headController.signal
      });
      clearTimeout(headTimeout);
    }

    clearTimeout(timeoutId);

    if (response.status >= 200 && response.status < 400) {
      return { status: 'Active' };
    }

    if (response.status === 403 || response.status === 404 || response.status >= 500) {
      return { status: 'Error', errorMsg: `HTTP ${response.status}` };
    }

    return { status: 'Inactive', errorMsg: `HTTP status ${response.status}` };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { status: 'Inactive', errorMsg: 'Connection Timeout' };
    }
    return { status: 'Error', errorMsg: err.message || 'Connection Refused' };
  }
}

// Run through global catalog validating streams concurrently in structured batches
async function runStreamHealthChecks() {
  if (globalChannels.length === 0) return;
  console.log(`[Health Monitoring] Starting stream validation for ${globalChannels.length} channels...`);
  
  const BATCH_SIZE = 12;
  const list = [...globalChannels];
  
  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const batch = list.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (ch) => {
        const result = await validateSingleStream(ch.url);
        ch.status = result.status;
        ch.errorMsg = result.errorMsg || '';
        ch.lastValidated = new Date().toISOString();
      })
    );
  }

  lastHealthCheckTime = new Date().toISOString();
  console.log(`[Health Monitoring] Completed. Active count: ${globalChannels.filter(c => c.status === 'Active').length}`);
  saveCacheFile();
}

// Download and parse latest playlists from predefined Github URL
async function runChannelSynchronization() {
  if (isSyncing) return;
  isSyncing = true;
  console.log("[Auto-Sync] Fetching latest IPTV catalog from source repository...");

  try {
    const res = await fetch(M3U_SOURCE_URL, {
      headers: { 'User-Agent': 'StreamDDB-Catalog-Worker/1.0' }
    });
    if (!res.ok) {
      throw new Error(`Failed to load: HTTP ${res.status}`);
    }
    const content = await res.text();
    const fetched = parseM3UPlaylist(content);
    
    if (fetched.length > 0) {
      // Preserve existing channels status or merge metadata
      const channelMap = new Map<string, ServerChannel>();
      globalChannels.forEach(c => channelMap.set(c.id, c));

      // Build consolidated catalog
      const mergedList = fetched.map(ch => {
        const existing = channelMap.get(ch.id);
        if (existing) {
          // Carry forward validation results to preserve uptime stats
          return {
            ...ch,
            status: existing.status,
            errorMsg: existing.errorMsg,
            lastValidated: existing.lastValidated
          };
        }
        return ch;
      });

      globalChannels = mergedList;
      lastSyncTime = new Date().toISOString();
      console.log(`[Auto-Sync] Synced ${globalChannels.length} channels successfully. Validating streams next...`);
      
      // Immediately run health check to index new channels
      await runStreamHealthChecks();
    }
  } catch (error) {
    console.error("[Auto-Sync] Synchronization aborted with error: ", error);
  } finally {
    isSyncing = false;
  }
}

// Load cached backup directly for high speed server boot
function loadCacheFile() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.channels)) {
        globalChannels = parsed.channels;
        lastSyncTime = parsed.lastSyncTime || null;
        lastHealthCheckTime = parsed.lastHealthCheckTime || null;
        console.log(`[Cache Load] Restored ${globalChannels.length} streams instantly.`);
        return;
      }
    }
  } catch (e) {
    console.warn("[Cache Load] Failed to load local backup: ", e);
  }
  // Fallback to static demo items if cache is empty
  preseedDemoChannels();
}

function saveCacheFile() {
  try {
    const data = {
      channels: globalChannels,
      lastSyncTime,
      lastHealthCheckTime
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("[Cache Save] Failed parsing backup storage: ", e);
  }
}

function preseedDemoChannels() {
  globalChannels = [
    {
      id: "demo-ch-1",
      playlistId: "fixed-mrgify-playlist",
      name: "Sintel (Default Cinema Trailer Link)",
      logo: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=100&q=80",
      groupTitle: "Cinema & Movies",
      url: "https://multiplatform-f.akamaihd.net/i/multi/will/sintel/pc-delivery/,co_sintel_8000k.mp4,co_sintel_2500k.mp4,co_sintel_1500k.mp4,.csmil/master.m3u8",
      tvgId: "sintel.live",
      country: "Global",
      status: "Active"
    },
    {
      id: "demo-ch-2",
      playlistId: "fixed-mrgify-playlist",
      name: "Tears of Steel (Sci-Fi HLS Sample Clip)",
      logo: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=100&q=80",
      groupTitle: "Cinema & Movies",
      url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
      tvgId: "tears.live",
      country: "Global",
      status: "Active"
    }
  ];
}

// Init system
loadCacheFile();

// Instantly fire startup background updates
setTimeout(() => {
  runChannelSynchronization();
}, 2000);

// Set repeating background worker timers
setInterval(() => {
  runStreamHealthChecks();
}, 30 * 60 * 1000); // 30 mins

setInterval(() => {
  runChannelSynchronization();
}, 6 * 60 * 60 * 1000); // 6 hours

// API: Channels catalog
app.get("/api/channels", (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 60;
  const search = (req.query.search as string || "").toLowerCase().trim();
  const category = req.query.category as string || "";
  const country = req.query.country as string || "";

  // Filter only Active items to present a bulletproof high quality catalog
  let list = globalChannels.filter(c => c.status === "Active");

  if (category) {
    list = list.filter(c => c.groupTitle === category);
  }

  if (country) {
    list = list.filter(c => c.country === country);
  }

  if (search) {
    list = list.filter(c => 
      c.name.toLowerCase().includes(search) || 
      c.groupTitle.toLowerCase().includes(search) ||
      c.country.toLowerCase().includes(search)
    );
  }

  // Calculate pagination
  const total = list.length;
  const startIndex = (page - 1) * limit;
  const paginatedList = list.slice(startIndex, startIndex + limit);

  res.json({
    channels: paginatedList,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  });
});

// API: Categories list
app.get("/api/categories", (req, res) => {
  const activeOnly = globalChannels.filter(c => c.status === "Active");
  const categories = Array.from(new Set(activeOnly.map(ch => ch.groupTitle).filter(Boolean))).sort();
  res.json(categories);
});

// API: Countries list
app.get("/api/countries", (req, res) => {
  const activeOnly = globalChannels.filter(c => c.status === "Active");
  const countries = Array.from(new Set(activeOnly.map(ch => ch.country).filter(Boolean))).sort();
  res.json(countries);
});

// API: Server Stats
app.get("/api/stats", (req, res) => {
  res.json({
    totalChannels: globalChannels.length,
    activeChannels: globalChannels.filter(c => c.status === "Active").length,
    inactiveChannels: globalChannels.filter(c => c.status === "Inactive").length,
    errorChannels: globalChannels.filter(c => c.status === "Error").length,
    lastSyncTime,
    lastHealthCheckTime,
    isSyncing
  });
});

// API: Trigger Force Refresh (Secret Admin / System trigger API)
app.post("/api/sync/trigger", async (req, res) => {
  if (isSyncing) {
    return res.status(409).json({ message: "Sync already in progress" });
  }
  runChannelSynchronization();
  res.json({ status: "triggered" });
});

// Vite server integrations
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`StreamDDB Server listening securely on internal container ingress route (http://localhost:${PORT})`);
  });
}

startServer();
