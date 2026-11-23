import { MessageFlags, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { COLORS } from '../music/embeds.js';
import {
  DEFAULTS,
  LIMITS,
  effectiveAutoRole,
  getSettings,
  resetSettings,
  updateSettings,
} from '../settings.js';

/**
 * `/settings` — sunucu bazlı bot ayarları.
 *
 * Yetki: sunucu sahibi, **Yönetici** izni olanlar veya `ADMIN_ROLE_NAME`
 * (varsayılan `ADMIN`) rolüne sahip olanlar. Bu yüzden komut
 * `setDefaultMemberPermissions` ile gizlenmiyor: ADMIN rolü Discord'un
 * "Yönetici" iznine sahip olmak zorunda değil.
 *
 * Yanıtlar ephemeral — ayar değiştirmek kanalı kirletmesin.
 */
const EPHEMERAL = { flags: MessageFlags.Ephemeral };
const normalize = (name) => String(name ?? '').trim().toLocaleLowerCase('tr');

function isAuthorized(member) {
  if (!member) return false;
  if (member.id === member.guild?.ownerId) return true;
  if (member.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;

  const wanted = normalize(config.adminRoleName);
  return member.roles?.cache?.some((role) => normalize(role.name) === wanted) === true;
}

function overviewEmbed(guild) {
  const settings = getSettings(guild.id);
  const autoRole = effectiveAutoRole(guild.id);

  const autoRoleText = autoRole.enabled
    ? `Açık — ${autoRole.roleId ? `<@&${autoRole.roleId}>` : `\`${autoRole.roleName}\``}`
    : 'Kapalı';

  return {
    color: COLORS.primary,
    title: '⚙️  Bot ayarları',
    fields: [
      { name: '🔊 Varsayılan ses', value: `${settings.volume}%`, inline: true },
      { name: '🔁 Otomatik çalma', value: settings.autoplay ? 'Açık' : 'Kapalı', inline: true },
      { name: '👥 Oto-rol', value: autoRoleText, inline: true },
      {
        name: '🧹 Mesaj temizliği',
        value: settings.cleanupHours ? `${settings.cleanupHours} saat` : 'Kapalı',
        inline: true,
      },
      {
        name: '👋 Boş kanalda ayrılma',
        value: settings.autoLeaveMinutes ? `${settings.autoLeaveMinutes} dk` : 'Kapalı',
        inline: true,
      },
      { name: '\u200b', value: '\u200b', inline: true },
    ],
    footer: {
      text: `Değiştirmek için: /settings ses · otorol · temizlik · ayrilma · sifirla`,
    },
  };
}

function replyOverview(interaction, guild, description) {
  const embed = overviewEmbed(guild);
  if (description) embed.description = description;

  return interaction.reply({ embeds: [embed], ...EPHEMERAL });
}

export default {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Sunucu bazlı bot ayarları (ADMIN rolü gerekir)')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub.setName('goster').setDescription('Mevcut ayarları göster'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('ses')
        .setDescription('Yeni oyuncular için varsayılan ses seviyesi')
        .addIntegerOption((option) =>
          option
            .setName('seviye')
            .setDescription(`0-${LIMITS.volume.max} arası`)
            .setRequired(true)
            .setMinValue(LIMITS.volume.min)
            .setMaxValue(LIMITS.volume.max),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('autoplay')
        .setDescription('Kuyruk bitince benzer şarkılarla devam etsin mi?')
        .addBooleanOption((option) =>
          option.setName('acik').setDescription('Açık mı olsun?').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('otorol')
        .setDescription('Yeni üyelere otomatik verilecek rol')
        .addBooleanOption((option) =>
          option.setName('acik').setDescription('Oto-rol açık mı olsun?').setRequired(false),
        )
        .addRoleOption((option) =>
          option.setName('rol').setDescription('Verilecek rol (boş = HUMAN)').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('temizlik')
        .setDescription('Bot mesajları kaç saat sonra silinsin? (0 = kapalı)')
        .addIntegerOption((option) =>
          option
            .setName('saat')
            .setDescription(`0-${LIMITS.cleanupHours.max} arası, 0 = kapalı`)
            .setRequired(true)
            .setMinValue(LIMITS.cleanupHours.min)
            .setMaxValue(LIMITS.cleanupHours.max),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('ayrilma')
        .setDescription('Kanal boş kalınca kaç dakikada ayrılsın? (0 = kapalı)')
        .addIntegerOption((option) =>
          option
            .setName('dakika')
            .setDescription(`0-${LIMITS.autoLeaveMinutes.max} arası, 0 = kapalı`)
            .setRequired(true)
            .setMinValue(LIMITS.autoLeaveMinutes.min)
            .setMaxValue(LIMITS.autoLeaveMinutes.max),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('sifirla').setDescription('Tüm ayarları varsayılana döndür'),
    ),

  async execute(interaction) {
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({
        embeds: [
          {
            color: COLORS.danger,
            description:
              `Bu komut için sunucu sahibi, **Yönetici** izni veya ` +
              `**${config.adminRoleName}** rolü gerekiyor.`,
          },
        ],
        ...EPHEMERAL,
      });
    }

    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case 'goster':
        return replyOverview(interaction, guild);

      case 'ses': {
        const volume = interaction.options.getInteger('seviye', true);
        updateSettings(guild.id, { volume });
        return replyOverview(interaction, guild, `🔊 Varsayılan ses **${volume}%** olarak ayarlandı.`);
      }

      case 'autoplay': {
        const enabled = interaction.options.getBoolean('acik', true);
        updateSettings(guild.id, { autoplay: enabled });
        return replyOverview(
          interaction,
          guild,
          enabled ? '🔁 Otomatik çalma **açık**.' : '⏹️ Otomatik çalma **kapalı**.',
        );
      }

      case 'otorol': {
        const acik = interaction.options.getBoolean('acik');
        const role = interaction.options.getRole('rol');

        if (acik === null && !role) {
          return replyOverview(
            interaction,
            guild,
            '⚠️ Bir şey belirtmedin: `acik:true/false` veya `rol:@rol` ver.',
          );
        }

        if (role) {
          updateSettings(guild.id, {
            autoRole: {
              enabled: acik ?? true,
              roleId: role.id,
              roleName: role.name,
            },
          });
        } else {
          updateSettings(guild.id, {
            autoRole: {
              ...(getSettings(guild.id).autoRole ?? {}),
              enabled: acik,
            },
          });
        }

        const effective = effectiveAutoRole(guild.id);
        const label = effective.roleId ? `<@&${effective.roleId}>` : `\`${effective.roleName}\``;

        return replyOverview(
          interaction,
          guild,
          effective.enabled
            ? `👥 Oto-rol **açık** — yeni üyelere ${label} verilecek.`
            : '👥 Oto-rol **kapalı**.',
        );
      }

      case 'temizlik': {
        const hours = interaction.options.getInteger('saat', true);
        updateSettings(guild.id, { cleanupHours: hours });
        return replyOverview(
          interaction,
          guild,
          hours
            ? `🧹 Bot mesajları **${hours} saat** sonra silinecek.`
            : '🧹 Mesaj temizliği **kapalı**.',
        );
      }

      case 'ayrilma': {
        const minutes = interaction.options.getInteger('dakika', true);
        updateSettings(guild.id, { autoLeaveMinutes: minutes });
        return replyOverview(
          interaction,
          guild,
          minutes
            ? `👋 Kanal boş kalınca **${minutes} dk** sonra ayrılacağım.`
            : '👋 Boş kanalda otomatik ayrılma **kapalı**.',
        );
      }

      case 'sifirla': {
        resetSettings(guild.id);
        return replyOverview(
          interaction,
          guild,
          `♻️ Ayarlar varsayılana döndü (ses **${DEFAULTS.volume}%**, ` +
            `temizlik **${DEFAULTS.cleanupHours} saat**, ayrılma **${DEFAULTS.autoLeaveMinutes} dk**).`,
        );
      }

      default:
        return replyOverview(interaction, guild);
    }
  },
};
