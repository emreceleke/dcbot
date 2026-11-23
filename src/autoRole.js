import { PermissionsBitField } from 'discord.js';
import { config, log } from './config.js';
import { effectiveAutoRole } from './settings.js';

/**
 * Oto-rol: sunucuya yeni katılan insanlara otomatik rol verir.
 *
 * Rol, varsayılan olarak **ada** göre bulunur (`AUTO_ROLE_NAME`, varsayılan
 * `HUMAN`); `AUTO_ROLE_ID` verilirse önce ID denenir. Böylece rollerin
 * sunucudan sunucuya farklı ID'lerde olması sorun olmaz.
 *
 * Sunucu bazlı ayarlar (`/settings otorol ...`) `.env` değerlerini geçersiz
 * kılar; `effectiveAutoRole` ikisini birleştirir.
 *
 * `guildMemberAdd` olayı için **Server Members Intent** (privileged) gerekir.
 * Açık değilse Discord bu olayı hiç göndermez; bot çalışır ama rol atamaz.
 */
const normalize = (name) => String(name ?? '').trim().toLocaleLowerCase('tr');

function findRole(guild, { roleId, roleName }) {
  if (roleId) {
    const byId = guild.roles.cache.get(roleId);
    if (byId) return byId;
  }

  const wanted = normalize(roleName);
  return guild.roles.cache.find((role) => normalize(role.name) === wanted) ?? null;
}

/** Tek bir üyeye oto-rolü atar. Test edilebilmesi için member dışarıdan gelir. */
export async function assignAutoRole(member) {
  if (!member?.guild || member.user?.bot) return false;

  const guild = member.guild;
  const settings = effectiveAutoRole(guild.id);
  if (!settings.enabled) return false;

  const role = findRole(guild, settings);
  if (!role) {
    log.warn(`Oto-rol: "${settings.roleName}" rolü ${guild.name} sunucusunda yok.`);
    return false;
  }

  const me = guild.members.me;
  if (!me?.permissions?.has(PermissionsBitField.Flags.ManageRoles)) {
    log.warn(`Oto-rol: ${guild.name} sunucusunda "Rolleri Yönet" iznim yok.`);
    return false;
  }

  if (role.managed) {
    log.warn(`Oto-rol: "${role.name}" rolü bir entegrasyona ait, elle atanamaz.`);
    return false;
  }

  // Bot, kendi en yüksek rolünün ALTINDAKİ rolleri verebilir.
  if (role.position >= me.roles.highest.position) {
    log.warn(
      `Oto-rol: "${role.name}" rolü botun en yüksek rolünden yukarıda; ` +
        `Sunucu Ayarları → Roller bölümünde botun rolünü yukarı taşı.`,
    );
    return false;
  }

  if (member.roles.cache.has(role.id)) return true;

  await member.roles.add(role, 'Yeni üye: oto-rol');
  log.info(`Oto-rol: ${member.user.tag} → ${role.name} (${guild.name})`);
  return true;
}

/** Üye katılma olayını bağlar. */
export function attachAutoRole(client) {
  // Sunucu bazlı ayar `.env`'i ezebildiği için dinleyici her zaman bağlanır;
  // kapalı sunucularda `assignAutoRole` hemen döner.
  client.on('guildMemberAdd', (member) => {
    assignAutoRole(member).catch((error) => {
      log.warn(`Oto-rol atanamadı (${member.guild?.name}):`, error?.message ?? error);
    });
  });

  log.info(
    config.autoRole.enabled
      ? `Oto-rol açık: yeni üyelere varsayılan olarak "${config.autoRole.name}" rolü verilecek.`
      : 'Oto-rol varsayılan olarak kapalı; sunucu bazlı `/settings otorol` ile açılabilir.',
  );
}
