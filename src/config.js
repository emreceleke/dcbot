/**
 * Ortam değişkenlerini toplar, doğrular ve teşhis araçları sunar.
 *
 * Tasarım notu: Bu bot hem `node index.js` (Pterodactyl panelleri) hem de
 * `npm start` ile çalışmalı. Panellerde .env dosyası olmayabilir; orada
 * değişkenler panel arayüzünden gelir. Bu yüzden .env okuma işi burada,
 * harici bir bağımlılık olmadan yapılır ve **panel değişkenleri her zaman kazanır**.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDir, '..');

/** Bağımlılık gerektirmeyen minimal .env okuyucu. */
function loadDotEnv() {
  for (const file of [path.join(process.cwd(), '.env'), path.join(projectRoot, '.env')]) {
    if (!existsSync(file)) continue;

    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const eq = line.indexOf('=');
      if (eq === -1) continue;

      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
        (value.startsWith("'") && value.endsWith("'") && value.length > 1)
      ) {
        value = value.slice(1, -1);
      }

      // Panelden gelen gerçek ortam değişkeni her zaman üstündür.
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadDotEnv();

// ─── Yardımcılar ────────────────────────────────────────────────────────────

function readString(name) {
  return process.env[name]?.trim() || null;
}

function required(name) {
  const value = readString(name);
  if (!value) {
    throw new ConfigError(
      `Zorunlu ortam değişkeni eksik: ${name}`,
      name === 'DISCORD_TOKEN'
        ? 'Discord Developer Portal → Bot → Reset Token ile al, panelde "DISCORD_TOKEN" olarak ekle.'
        : 'Discord Developer Portal → General Information → Application ID.',
    );
  }
  return value;
}

function bool(name, fallback) {
  const raw = readString(name)?.toLowerCase();
  if (raw === undefined || raw === null || raw === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(raw);
}

function int(name, fallback) {
  const raw = readString(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new ConfigError(`${name} sayı olmalı, alınan değer: "${raw}"`);
  }
  return parsed;
}

export class ConfigError extends Error {
  constructor(message, hint) {
    super(message);
    this.name = 'ConfigError';
    this.hint = hint;
  }
}

// ─── Yapılandırma ───────────────────────────────────────────────────────────

export const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  devGuildId: readString('DEV_GUILD_ID'),

  lavalink: {
    name: readString('LAVALINK_NAME') || 'main',
    host: readString('LAVALINK_HOST') || '127.0.0.1',
    port: int('LAVALINK_PORT', 2333),
    password: readString('LAVALINK_PASSWORD') || 'youshallnotpass',
    secure: bool('LAVALINK_SECURE', false),
  },

  defaultVolume: int('DEFAULT_VOLUME', 80),
  searchPlatform: readString('SEARCH_PLATFORM') || 'ytmsearch',
  maxPlaylistSize: int('MAX_PLAYLIST_SIZE', 100),
  autoplay: bool('AUTOPLAY', true),
  lastfmKey: readString('LASTFM_API_KEY'),

  // Sunucuya yeni katılanlara verilecek rol. ID verilirse önce o denenir,
  // yoksa isim eşleşmesi kullanılır.
  autoRole: {
    enabled: bool('AUTO_ROLE', true),
    id: readString('AUTO_ROLE_ID'),
    name: readString('AUTO_ROLE_NAME') || 'HUMAN',
  },

  logLevel: readString('LOG_LEVEL') || 'info',
};

// ─── Logger ─────────────────────────────────────────────────────────────────

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

export const log = {
  error: (...args) => LEVELS.error <= threshold && console.error('[error]', ...args),
  warn: (...args) => LEVELS.warn <= threshold && console.warn('[warn] ', ...args),
  info: (...args) => LEVELS.info <= threshold && console.log('[info] ', ...args),
  debug: (...args) => LEVELS.debug <= threshold && console.log('[debug]', ...args),
};

// ─── Teşhis ─────────────────────────────────────────────────────────────────

/** Ortam değişkenlerinin durumunu özetler (sırları maskeleyerek). */
export function envSummary() {
  const mask = (value) => {
    if (!value) return 'YOK';
    if (value.length <= 8) return '***';
    return `${value.slice(0, 4)}…${value.slice(-2)} (${value.length} karakter)`;
  };

  return {
    nodeVersion: process.version,
    platform: `${process.platform}/${process.arch}`,
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    token: mask(config.token),
    clientId: config.clientId,
    devGuildId: config.devGuildId ?? 'yok (global kayıt)',
    lavalink: `${config.lavalink.host}:${config.lavalink.port} (secure=${config.lavalink.secure})`,
    searchPlatform: config.searchPlatform,
    autoplay: config.autoplay,
    autoRole: config.autoRole.enabled
      ? `${config.autoRole.name}${config.autoRole.id ? ` (id=${config.autoRole.id})` : ''}`
      : 'kapalı',
    lastfm: config.lastfmKey ? 'var' : 'yok (YouTube mix kullanılacak)',
    cwd: process.cwd(),
  };
}
