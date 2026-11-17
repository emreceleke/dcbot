import { config } from '../config.js';

// Sunucu bazlı ayarlar. Kalıcı hale getirmek istersen burayı SQLite/JSON'a taşı.
const autoplayByGuild = new Map();

export function isAutoplayEnabled(guildId) {
  return autoplayByGuild.get(guildId) ?? config.autoplay;
}

export function setAutoplay(guildId, enabled) {
  autoplayByGuild.set(guildId, Boolean(enabled));
  return Boolean(enabled);
}
