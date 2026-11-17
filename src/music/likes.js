import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { log } from '../config.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'likes.json');
const MAX_PER_USER = 200;

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
    log.warn('Beğeniler kaydedilemedi:', error?.message ?? error);
  }
}

/** Parçayı kaynak+identifier ile benzersiz anahtara çevirir. */
function trackKey(track) {
  const info = track?.info ?? {};
  return `${info.sourceName ?? '?'}:${info.identifier ?? info.uri ?? '?'}`;
}

export async function isLiked(userId, track) {
  const data = await load();
  const key = trackKey(track);
  return (data[userId] ?? []).some((entry) => entry.key === key);
}

/** Beğeniyi açar/kapatır. */
export async function toggleLike(userId, track) {
  const data = await load();
  const list = data[userId] ?? (data[userId] = []);
  const key = trackKey(track);
  const index = list.findIndex((entry) => entry.key === key);

  if (index !== -1) {
    list.splice(index, 1);
    await persist();
    return { liked: false, count: list.length };
  }

  list.unshift({
    key,
    title: track?.info?.title ?? null,
    author: track?.info?.author ?? null,
    uri: track?.info?.uri ?? null,
    sourceName: track?.info?.sourceName ?? null,
    likedAt: new Date().toISOString(),
  });

  if (list.length > MAX_PER_USER) list.length = MAX_PER_USER;

  await persist();
  return { liked: true, count: list.length };
}

export async function listLikes(userId) {
  const data = await load();
  return data[userId] ?? [];
}
