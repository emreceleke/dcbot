import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config, log } from './config.js';

/**
 * Sunucu bazlı bot ayarları — `data/settings.json`.
 *
 * Neden JSON: veritabanı bu ölçekte fazlalık. Dosya küçük (sunucu başına birkaç
 * sayı), yazma sıklığı düşük ve restart'ta kaybolmuyor.
 *
 * Okuma senkron (`getSettings`) çünkü panel/kart çizimi senkron; dosya açılışta
 * bir kez `initSettings()` ile belleğe alınır. Yazma arka planda sıraya girer.
 */
const DATA_DIR = path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'settings.json');

export const LIMITS = {
  volume: { min: 0, max: 150 },
  cleanupHours: { min: 0, max: 168 },
  autoLeaveMinutes: { min: 0, max: 120 },
};

export const DEFAULTS = {
  volume: config.defaultVolume,
  autoplay: config.autoplay,
  autoRole: null, // null -> config.autoRole (env) kullanılır
  cleanupHours: 12,
  autoLeaveMinutes: 10,
};

let store = {};
let loaded = false;
let queue = Promise.resolve();

function sanitize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const out = {};

  if (Number.isFinite(raw.volume)) out.volume = clamp(raw.volume, LIMITS.volume);
  if (typeof raw.autoplay === 'boolean') out.autoplay = raw.autoplay;
  if (Number.isFinite(raw.cleanupHours)) out.cleanupHours = clamp(raw.cleanupHours, LIMITS.cleanupHours);
  if (Number.isFinite(raw.autoLeaveMinutes)) {
    out.autoLeaveMinutes = clamp(raw.autoLeaveMinutes, LIMITS.autoLeaveMinutes);
  }

  if (raw.autoRole && typeof raw.autoRole === 'object' && !Array.isArray(raw.autoRole)) {
    out.autoRole = {
      enabled: raw.autoRole.enabled !== false,
      roleId: typeof raw.autoRole.roleId === 'string' ? raw.autoRole.roleId : null,
      roleName: typeof raw.autoRole.roleName === 'string' ? raw.autoRole.roleName : null,
    };
  }

  return out;
}

export function clamp(value, { min, max }) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(Math.max(Math.round(number), min), max);
}

/** Açılışta bir kez çağrılır; dosya yoksa boş başlar. */
export async function initSettings() {
  if (loaded) return getStoreSize();

  try {
    const raw = await readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    store = {};

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [guildId, value] of Object.entries(parsed)) {
        const clean = sanitize(value);
        if (Object.keys(clean).length) store[guildId] = clean;
      }
    }
  } catch {
    store = {};
  }

  loaded = true;
  return getStoreSize();
}

export function getStoreSize() {
  return Object.keys(store).length;
}

/** Sunucunun etkin ayarları (kaydedilmemiş alanlar varsayılanla doldurulur). */
export function getSettings(guildId) {
  const raw = store[guildId] ?? {};

  return {
    volume: raw.volume ?? DEFAULTS.volume,
    autoplay: raw.autoplay ?? DEFAULTS.autoplay,
    autoRole: raw.autoRole ?? null,
    cleanupHours: raw.cleanupHours ?? DEFAULTS.cleanupHours,
    autoLeaveMinutes: raw.autoLeaveMinutes ?? DEFAULTS.autoLeaveMinutes,
  };
}

/** Kısmi güncelleme: verilmeyen alanlar korunur. Yazma arka planda. */
export function updateSettings(guildId, patch) {
  const current = store[guildId] ?? {};
  const merged = { ...current, ...patch };

  // `autoRole: null` "env varsayılanına dön" demek; ?? ile düşürmemek için ayrı ele alınıyor.
  if (!('autoRole' in patch)) merged.autoRole = current.autoRole;

  store[guildId] = sanitize(merged);
  persist();
  return getSettings(guildId);
}

/** Sunucuyu varsayılanlara döndürür (kayıt silinir). */
export function resetSettings(guildId) {
  delete store[guildId];
  persist();
  return getSettings(guildId);
}

/** Bekleyen yazmaların bitmesini bekler (test ve kapanış için). */
export function flushSettings() {
  return queue;
}

function persist() {
  const snapshot = JSON.stringify(store, null, 2);

  queue = queue.then(async () => {
    try {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(FILE, snapshot, 'utf8');
    } catch (error) {
      log.warn('Ayarlar kaydedilemedi:', error?.message ?? error);
    }
  });

  return queue;
}

/**
 * Oto-rolün sunucu için etkin hali.
 * Sunucuya özel ayar yoksa `.env` değerleri kullanılır.
 */
export function effectiveAutoRole(guildId) {
  const custom = getSettings(guildId).autoRole ?? {};

  return {
    enabled: custom.enabled ?? config.autoRole.enabled,
    roleId: custom.roleId ?? config.autoRole.id ?? null,
    roleName: custom.roleName ?? config.autoRole.name,
  };
}

/** Boş kanalda ayrılma gecikmesi (ms). 0 = kapalı. */
export function getAutoLeaveDelay(guildId) {
  return getSettings(guildId).autoLeaveMinutes * 60_000;
}

/** Mesaj temizliği yaşı (ms). 0 = kapalı. */
export function getCleanupAge(guildId) {
  return getSettings(guildId).cleanupHours * 60 * 60 * 1000;
}
