import { config, log } from '../config.js';
import { addFillerTracks } from '../music/queueAdd.js';
import {
  buildRadioMixUrl,
  getSimilarTracks,
  parseTrackTitle,
} from './lastfm.js';

/** Aynı sunucuda paralel öneri çözümlemesini engeller. */
const resolving = new Set();

/**
 * Bir "seed" parçadan yola çıkarak dinletilebilir öneri listesi üretir.
 *
 * Sıra:
 *   1. Last.fm `track.getSimilar`  (API anahtarı varsa) — en isabetli
 *   2. YouTube Radio mix (`RD<videoId>`)              — anahtar gerekmez
 *
 * @returns {Promise<{ source: string|null, tracks: object[] }>}
 */
export async function findRecommendations(player, seedTrack, { limit = 8 } = {}) {
  if (!seedTrack?.info) return { source: null, tracks: [] };

  const seedId = seedTrack.info.identifier;

  const fromLastfm = await resolveFromLastfm(player, seedTrack, { limit });
  if (fromLastfm.length) {
    return { source: 'lastfm', tracks: fromLastfm };
  }

  const fromMix = await resolveFromRadioMix(player, seedTrack, { limit, seedId });
  if (fromMix.length) {
    return { source: 'youtube-mix', tracks: fromMix };
  }

  return { source: null, tracks: [] };
}

async function resolveFromLastfm(player, seedTrack, { limit }) {
  if (!config.lastfmKey) return [];

  try {
    const parsed = parseTrackTitle(seedTrack.info.title, seedTrack.info.author);
    const similar = await getSimilarTracks({
      artist: parsed.artist,
      title: parsed.title,
      limit: limit * 2,
    });
    if (!similar.length) return [];

    const collected = [];
    const seen = new Set([seedTrack.info.identifier]);

    for (const entry of similar) {
      if (collected.length >= limit) break;
      const query = `ytmsearch:${entry.artist} ${entry.title}`;

      const result = await safeSearch(player, query);
      const candidate = result?.tracks?.[0];
      if (!candidate) continue;
      if (seen.has(candidate.info.identifier)) continue;

      seen.add(candidate.info.identifier);
      collected.push(candidate);
    }

    return collected;
  } catch (error) {
    log.warn('Last.fm önerisi alınamadı:', error?.message ?? error);
    return [];
  }
}

async function resolveFromRadioMix(player, seedTrack, { limit, seedId }) {
  try {
    const mixUrl = buildRadioMixUrl(seedTrack);
    if (!mixUrl) return [];

    const result = await safeSearch(player, mixUrl);
    if (!result?.tracks?.length) return [];

    const seen = new Set([seedId]);
    const collected = [];
    for (const track of result.tracks) {
      if (collected.length >= limit) break;
      if (seen.has(track.info.identifier)) continue;
      seen.add(track.info.identifier);
      collected.push(track);
    }
    return collected;
  } catch (error) {
    log.warn('YouTube mix önerisi alınamadı:', error?.message ?? error);
    return [];
  }
}

async function safeSearch(player, query) {
  try {
    return await player.search(query, player.queue.current?.requester ?? null);
  } catch (error) {
    log.debug(`Arama başarısız ("${query}"):`, error?.message ?? error);
    return null;
  }
}

/**
 * Kuyruk bittiğinde çağrılır. Öneri bulursa kuyruğa ekler ve çalmaya devam eder.
 * @returns {Promise<boolean>} devam edip etmediği
 */
export async function continueWithRecommendations(player, seedTrack, { limit = 5 } = {}) {
  const guildId = player.guildId;
  if (!config.autoplay) return false;
  if (resolving.has(guildId)) return false;

  resolving.add(guildId);
  try {
    const { source, tracks } = await findRecommendations(player, seedTrack, { limit });
    if (!tracks.length) return false;

    await addFillerTracks(player, tracks);
    if (!player.playing && !player.paused) await player.play();

    log.info(`Autoplay (${source}): ${guildId} sunucusuna ${tracks.length} parça eklendi.`);
    return true;
  } finally {
    resolving.delete(guildId);
  }
}
