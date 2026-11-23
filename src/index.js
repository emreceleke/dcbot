/**
 * Bot önyükleme.
 *
 * Tasarım hedefi: bu proses **asla sessizce ölmemeli**. Panel konsolunda
 * (Pterodactyl vb.) her başarısızlık, ne olduğunu ve nasıl düzeltileceğini
 * söyleyen bir mesajla görünmeli.
 */

import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  Client,
  Collection,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
} from 'discord.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const line = (char = '─') => char.repeat(64);

/**
 * Temiz kapanış.
 *
 * Neden `process.exit()` doğrudan çağrılmıyor: henüz kapanmakta olan async
 * handle'lar varken çağrılırsa Windows'ta libuv assertion'ı tetikleniyor
 * (src\win\async.c). Bunun yerine önce olay döngüsünün kendiliğinden
 * boşalmasına izin veriyoruz; boşalmazsa kısa bir süre sonra zorluyoruz.
 * `unref()` sayesinde bu zamanlayıcı tek başına prosesi ayakta tutmaz.
 */
function shutdown(code = 0) {
  process.exitCode = code;
  const force = setTimeout(() => process.exit(code), 1500);
  force.unref();
}

async function main() {
  // Dinamik import: yapılandırma eksikse hatayı düzgün yakalayabilelim.
  const { config, log, envSummary } = await import('./config.js');
  const { initSettings } = await import('./settings.js');

  // Sunucu ayarları (data/settings.json) hazır olmadan hiçbir olay bağlanmamalı.
  const savedGuilds = await initSettings();

  const summary = envSummary();
  console.log(line());
  console.log('  DC Music Bot');
  console.log(line());
  console.log(`  Node.js       : ${summary.nodeVersion} (${summary.platform})`);
  console.log(`  Çalışma dizini: ${summary.cwd}`);
  console.log(`  Discord token : ${summary.token}`);
  console.log(`  Client ID     : ${summary.clientId}`);
  console.log(`  Sunucu (guild): ${summary.devGuildId}`);
  console.log(`  Lavalink      : ${summary.lavalink}`);
  console.log(`  Arama kaynağı : ${summary.searchPlatform}`);
  console.log(`  Last.fm       : ${summary.lastfm}`);
  console.log(`  Oto-rol       : ${summary.autoRole}`);
  console.log(`  Yetkili rol   : ${summary.adminRole}`);
  console.log(`  Kayıtlı ayar  : ${savedGuilds} sunucu (data/settings.json)`);
  console.log(line());

  const { createLavalink } = await import('./music/lavalink.js');
  const { forgetGuild, rememberTrack, getRememberedTrack } = await import('./music/player.js');
  const { errorEmbed } = await import('./music/embeds.js');
  const { continueWithRecommendations } = await import('./recommend/engine.js');
  const { handleMusicButton } = await import('./music/buttons.js');
  const { handleLikedSelect, LIKED_SELECT_ID } = await import('./music/likedView.js');
  const { recordPlay } = await import('./music/history.js');
  const { attachAutoLeave, cancelAutoLeave, refreshAutoLeave } = await import('./music/autoLeave.js');
  const { attachAutoRole } = await import('./autoRole.js');
  const { startMessageCleanup } = await import('./cleanup.js');
  const { isMusicButton } = await import('./music/card.js');
  const {
    finishNowPlaying,
    forgetNowPlaying,
    refreshNowPlaying,
    startNowPlayingUpdater,
  } = await import('./music/nowPlaying.js');

  const client = new Client({
    // GuildVoiceStates ses için; GuildMembers (privileged) yeni üye olayı
    // için gerekli — Developer Portal'da "Server Members Intent" açık olmalı.
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.commands = new Collection();
  client.lavalink = createLavalink(client);

  // ─── Komutları yükle ──────────────────────────────────────────────────────
  const commandsDir = path.join(__dirname, 'commands');
  let commandFiles = [];
  try {
    commandFiles = (await readdir(commandsDir)).filter((file) => file.endsWith('.js'));
  } catch (error) {
    throw new Error(`Komut klasörü okunamadı (${commandsDir}): ${error.message}`);
  }

  for (const file of commandFiles) {
    const module = await import(pathToFileURL(path.join(commandsDir, file)).href);
    const command = module.default;
    if (!command?.data?.name || typeof command.execute !== 'function') {
      log.warn(`Komut dosyası atlandı (geçersiz yapı): ${file}`);
      continue;
    }
    client.commands.set(command.data.name, command);
  }
  log.info(`${client.commands.size} komut yüklendi.`);

  // ─── Lavalink köprüsü ─────────────────────────────────────────────────────
  client.on('raw', (packet) => client.lavalink.sendRawData(packet));

  client.lavalink.on('trackStart', (player, track) => {
    rememberTrack(player.guildId, track);
    recordPlay(player.guildId, track).catch(() => {});
    // Kanal boşsa (ör. istek sahibi hemen çıktıysa) sayacı burada da başlat.
    refreshAutoLeave(client, player);
    // Aynı "şu an çalıyor" mesajını güncelle; kuyruğa embed yığma.
    refreshNowPlaying(client, player.guildId, player, track).catch(() => {});
  });

  client.lavalink.on('queueEnd', async (player) => {
    const seed = getRememberedTrack(player.guildId);
    const continued = seed
      ? await continueWithRecommendations(player, seed, { limit: 5 })
      : false;

    if (continued) return;

    log.debug(`Kuyruk bitti (${player.guildId}).`);
    await finishNowPlaying(client, player.guildId, player);
    forgetGuild(player.guildId);
  });

  client.lavalink.on('playerDestroy', (player) => {
    cancelAutoLeave(player.guildId);
    forgetGuild(player.guildId);
    forgetNowPlaying(player.guildId);
  });

  // Kanal boş kalırsa 10 dk sonra ayrıl.
  attachAutoLeave(client);

  // Yeni üyelere oto-rol.
  attachAutoRole(client);

  // ─── Etkileşimler ─────────────────────────────────────────────────────────
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      if (interaction.isButton()) {
        if (!isMusicButton(interaction.customId)) return;
        try {
          await handleMusicButton(interaction, client);
        } catch (error) {
          log.error('Buton işlenemedi:', error);
        }
        return;
      }

      // Beğenilenler listesindeki "kaldır" menüsü.
      if (interaction.isStringSelectMenu() && interaction.customId === LIKED_SELECT_ID) {
        try {
          await handleLikedSelect(interaction);
        } catch (error) {
          log.error('Beğeni menüsü işlenemedi:', error);
        }
      }
      return;
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (error) {
      log.error(`/${interaction.commandName} hata verdi:`, error);

      // Kişisel bot: hata sebebini doğrudan göster, yoksa kör uçuş oluyor.
      const reason = String(error?.message ?? error).split('\n')[0].slice(0, 200);
      const embeds = [
        errorEmbed(`Komut çalıştırılırken beklenmeyen bir hata oluştu.\n\`\`\`${reason}\`\`\``),
      ];
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ embeds });
        } else {
          await interaction.reply({ embeds, flags: MessageFlags.Ephemeral });
        }
      } catch (replyError) {
        log.error('Hata mesajı gönderilemedi:', replyError?.message ?? replyError);
      }
    }
  });

  // ─── Hazır ────────────────────────────────────────────────────────────────
  client.once('clientReady', async () => {
    log.info(`Giriş yapıldı: ${client.user.tag}`);
    client.lavalink.init({ id: client.user.id, username: client.user.username });
    await registerCommands(client, config);
    // İlerleme çubuğunu canlı tut.
    startNowPlayingUpdater(client);
    // 12 saatten eski bot mesajlarını periyodik temizle.
    startMessageCleanup(client);
    client.user.setPresence({
      activities: [{ name: 'YouTube • /play', type: 2 }],
      status: 'online',
    });
    log.info('Bot hazır. Discord\'da /play yazarak başla.');
  });

  // ─── Kapanış ──────────────────────────────────────────────────────────────
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      log.info(`${signal} alındı, kapatılıyor...`);
      await client.destroy().catch(() => {});
      shutdown(0);
    });
  }

  process.on('unhandledRejection', (error) => {
    log.error('Yakalanmayan promise reddi:', error);
  });

  // ─── Giriş ────────────────────────────────────────────────────────────────
  log.info('Discord\'a bağlanılıyor...');
  try {
    await client.login(config.token);
  } catch (error) {
    const message = String(error?.message ?? error);
    console.error(line());
    console.error('  DISCORD GİRİŞİ BAŞARISIZ');
    console.error(line());
    console.error(`  ${message}`);
    console.error('');
    if (/token/i.test(message) || /401/i.test(message)) {
      console.error('  → DISCORD_TOKEN yanlış veya süresi geçmiş olabilir.');
      console.error('    Developer Portal → Bot → Reset Token ile yenisini al.');
    } else if (/disallowed intents/i.test(message)) {
      console.error('  → Developer Portal → Bot → Privileged Gateway Intents bölümünü kontrol et.');
    } else if (/ENOTFOUND|ETIMEDOUT|EAI_AGAIN/i.test(message)) {
      console.error('  → Ağ erişimi yok. Panelde giden bağlantı engellenmiş olabilir.');
    }
    console.error(line());
    await client.destroy().catch(() => {});
    shutdown(1);
    return;
  }
}

/** Slash komutlarını Discord'a kaydeder. */
async function registerCommands(client, config) {
  const body = [...client.commands.values()].map((command) => command.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    if (config.devGuildId) {
      await rest.put(Routes.applicationGuildCommands(config.clientId, config.devGuildId), { body });
      console.log(`[info]  ${body.length} komut ${config.devGuildId} sunucusuna kaydedildi (anında).`);
    } else {
      await rest.put(Routes.applicationCommands(config.clientId), { body });
      console.log(`[info]  ${body.length} komut global kaydedildi (yayılması ~1 saat sürebilir).`);
    }
  } catch (error) {
    console.error('[error] Komut kaydı başarısız:', error?.message ?? error);
    if (/401|token/i.test(String(error?.message))) {
      console.error('        → CLIENT_ID ile DISCORD_TOKEN aynı uygulamaya mı ait?');
    }
  }
}

main().catch((error) => {
  console.error('');
  if (error?.name === 'ConfigError') {
    console.error(line('='));
    console.error('  YAPILANDIRMA HATASI');
    console.error(line('='));
    console.error(`  ${error.message}`);
    if (error.hint) console.error(`  → ${error.hint}`);
  } else {
    console.error(line('='));
    console.error('  BAŞLATMA HATASI');
    console.error(line('='));
    console.error(`  ${error?.stack ?? error}`);
  }
  console.error(line('='));
  console.error('  Teşhis:  npm run doctor');
  console.error(line('='));
  console.error('');
  shutdown(1);
});
