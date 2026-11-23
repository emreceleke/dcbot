import { getSettings, updateSettings } from '../settings.js';

/**
 * Autoplay durumu.
 *
 * Eski sürümde yalnızca bellekte tutuluyordu (restart'ta sıfırlanıyordu).
 * Artık kalıcı ayar deposuna (`data/settings.json`) bağlı; `/settings` ile de
 * değiştirilebilir. Buton/panel senkron çizdiği için okuma senkron kaldı.
 */
export function isAutoplayEnabled(guildId) {
  return getSettings(guildId).autoplay;
}

export function setAutoplay(guildId, enabled) {
  updateSettings(guildId, { autoplay: Boolean(enabled) });
  return Boolean(enabled);
}
