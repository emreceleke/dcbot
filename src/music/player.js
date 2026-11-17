import { config, log } from '../config.js';

// Sunucu bazlı "en son çalan parça" hafızası. Autoplay ve /similar için gerekli;
// player objesine veri iliştirmek yerine burada tutmak yeniden başlatmaya daha dayanıklı.
const lastPlayed = new Map();

export function rememberTrack(guildId, track) {
  if (track) lastPlayed.set(guildId, track);
}

export function getRememberedTrack(guildId) {
  return lastPlayed.get(guildId) ?? null;
}

export function forgetGuild(guildId) {
  lastPlayed.delete(guildId);
}

/**
 * Kullanıcının bulunduğu ses kanalına bağlı bir player döner; yoksa oluşturur.
 * Hata durumunda { error } döner, çağıran taraf kullanıcıya gösterir.
 */
export async function getOrCreatePlayer(client, interaction) {
  const voiceChannel = interaction.member?.voice?.channel;

  if (!voiceChannel) {
    return { error: 'Önce bir ses kanalına katılman gerekiyor.' };
  }

  const me = interaction.guild.members.me;
  if (!me) {
    return { error: 'Kendi üye bilgimi okuyamıyorum. Lütfen tekrar dene.' };
  }

  const permissions = voiceChannel.permissionsFor(me);
  if (!permissions?.has('Connect') || !permissions?.has('Speak')) {
    return {
      error: 'O ses kanalına katılma/konuşma iznim yok. Kanal izinlerimi kontrol et.',
    };
  }

  let player = client.lavalink.getPlayer(interaction.guild.id);

  if (!player) {
    player = client.lavalink.createPlayer({
      guildId: interaction.guild.id,
      voiceChannelId: voiceChannel.id,
      textChannelId: interaction.channel.id,
      selfDeaf: true,
      selfMute: false,
      volume: config.defaultVolume,
    });
  } else {
    // Metin kanalı değişmiş olabilir; duyuruları yeni kanala gönder.
    player.textChannelId = interaction.channel.id;
  }

  if (!player.connected) {
    try {
      await player.connect();
    } catch (error) {
      log.error('Ses kanalına bağlanılamadı:', error?.message ?? error);
      return { error: 'Ses kanalına bağlanamadım. Lavalink düğümü çalışıyor mu?' };
    }
  }

  return { player };
}

/**
 * Bu kullanıcı player'ı yönetebilir mi? (DJ kuralı)
 * Kanalda kimse yoksa veya komutu veren kanaldaysa izin verilir.
 */
export function canControl(interaction, player) {
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) return false;

  const listeners = voiceChannel.members.filter((m) => !m.user.bot).size;
  if (listeners <= 1) return true;

  // Komutu veren, botun çaldığı kanaldaysa izinlidir.
  return player?.voiceChannelId === voiceChannel.id;
}
