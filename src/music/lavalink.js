import { LavalinkManager } from 'lavalink-client';
import { config, log } from '../config.js';

/**
 * Lavalink istemcisini kurar.
 *
 * Bot sesi kendisi işlemez: sesin tamamı Lavalink düğümünde çözülür/kodlanır,
 * bot yalnızca komut gönderir. Bu yüzden bot container'ında ffmpeg/opus gerekmez
 * ve RAM kullanımı ~150 MB civarında kalır.
 */
export function createLavalink(client) {
  const manager = new LavalinkManager({
    nodes: [
      {
        id: config.lavalink.name,
        host: config.lavalink.host,
        port: config.lavalink.port,
        authorization: config.lavalink.password,
        secure: config.lavalink.secure,
      },
    ],

    // Discord'un ses gateway payload'larını Lavalink'e iletir.
    sendToShard: (guildId, payload) => {
      client.guilds.cache.get(guildId)?.shard?.send(payload);
    },

    // Hatalı/çalınmayan parçayı otomatik geç.
    autoSkip: true,

    client: {
      id: config.clientId,
      username: 'MusicBot',
    },

    playerOptions: {
      defaultSearchPlatform: config.searchPlatform,
      volumeDecrementer: 1,
      // Lavalink'ten kopunca tekrar bağlan, ama oyuncuyu hemen yok etme.
      onDisconnect: {
        autoReconnect: true,
        destroyPlayer: false,
      },
      // Kuyruk boşaldıktan 60 sn sonra ses kanalından çık.
      onEmptyQueue: {
        destroyAfterMs: 60_000,
      },
    },

    // Lavalink'in reddedeceği filtre/kaynak kombinasyonlarını istememek için.
    advancedOptions: {
      enableDebugEvents: config.logLevel === 'debug',
    },
  });

  manager.nodeManager.on('error', (node, error) => {
    log.error(`Lavalink düğümü "${node.id}" hata verdi:`, error?.message ?? error);
  });

  manager.nodeManager.on('connect', (node) => {
    log.info(`Lavalink düğümüne bağlandı: ${node.id}`);
    // Oturum devamlılığı: bot yeniden başlarsa çalan şarkı kaldığı yerden sürer.
    node.updateSession(true, 360_000);
  });

  manager.nodeManager.on('disconnect', (node, reason) => {
    log.warn(`Lavalink düğümü koptu: ${node.id} — ${JSON.stringify(reason)}`);
  });

  manager.on('trackError', (player, track, payload) => {
    log.error(`Parça hatası ("${track?.info?.title}"):`, payload?.exception?.message);
  });

  return manager;
}
