import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { log } from '../config.js';

/**
 * Sunucu bazlı çalma geçmişi (son 100 parça).
 *
 * Bellekte tutulur, her parça başında `data/history.json`'a yazılır.
 * Yazma hatası botu durdurmaz: geçmiş "olsa iyi olur" verisi.
 */
const DATA_DIR = path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'history.json');
export const MAX_HISTORY = 100;

let cache = null;

async function load() {
  if (cache) return cache;

  try {
    const raw = await readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    cache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    cache = {};
  }

  return cache;
}

async function persist() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (error) {
    log.warn('Geçmiş kaydedilemedi:', error?.message ?? error);
  }
}

/** Parça çalmaya başladığında çağrılır: en yeni kayıt başa eklenir. */
export async function recordPlay(guildId, track) {
  const data = await load();
  const list = data[guildId] ?? (data[guildId] = []);
  const info = track?.info ?? {};

  list.unshift({
    title: info.title ?? null,
    author: info.author ?? null,
    uri: info.uri ?? null,
    duration: info.duration ?? info.length ?? null,
    sourceName: info.sourceName ?? null,
    playedAt: new Date().toISOString(),
  });

  if (list.length > MAX_HISTORY) list.length = MAX_HISTORY;

  await persist();
  return list.length;
}

/** En yeni kayıt başta olacak şekilde geçmişi döndürür. */
export async function getHistory(guildId) {
  const data = await load();
  return data[guildId] ?? [];
}
