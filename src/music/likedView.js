import {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';

import { COLORS, truncate } from './embeds.js';
import { listLikes, removeLike } from './likes.js';

/**
 * Beğenilen şarkı listesi + "kaldır" seçim menüsü.
 *
 * Select menü Discord'da satırın tamamını kaplar, bu yüzden listede tek
 * başına duruyor. CustomId kalıcı (`likes:remove`), bot yeniden başlasa da
 * eski menüler çalışır.
 */
export const LIKED_SELECT_ID = 'likes:remove';
const MAX_OPTIONS = 25;
const MAX_LISTED = 20;

export function likedPayload(likes, { note = null } = {}) {
  if (!likes.length) {
    return {
      embeds: [
        {
          color: COLORS.warning,
          description:
            '❤️ Listen boş. Şimdi çalıyor kartındaki ❤️ butonuyla şarkı ekleyebilirsin.',
        },
      ],
      components: [],
    };
  }

  const shown = likes.slice(0, MAX_LISTED);
  const list = shown
    .map(
      (entry, index) =>
        `${index + 1}. [${truncate(entry.title, 60)}](${entry.uri ?? 'https://discord.com'}) — ${truncate(entry.author, 40)}`,
    )
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`❤️  Beğendiğin şarkılar (${likes.length})`)
    .setDescription(note ? `${note}\n\n${list}` : list)
    .setFooter({
      text:
        likes.length > shown.length
          ? `İlk ${shown.length} tanesi gösteriliyor • /liked cal:true ile çal`
          : '/liked cal:true ile hepsini kuyruğa al',
    });

  const options = likes
    .filter((entry) => typeof entry.key === 'string' && entry.key.length <= 100)
    .slice(0, MAX_OPTIONS)
    .map((entry) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(truncate(entry.author ? `${entry.title} — ${entry.author}` : entry.title, 100))
        .setValue(entry.key)
        .setDescription(truncate(entry.uri ?? `${entry.sourceName ?? 'kaynak'} kaydı`, 100)),
    );

  const components = [];
  if (options.length) {
    components.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(LIKED_SELECT_ID)
          .setPlaceholder('Kaldırmak istediğin şarkıyı seç')
          .addOptions(options),
      ),
    );
  }

  return { embeds: [embed], components };
}

/** Menüden seçilen şarkıyı beğenilerden çıkarır ve listeyi tazeler. */
export async function handleLikedSelect(interaction) {
  const key = interaction.values?.[0];
  const { removed, entry, count } = await removeLike(interaction.user.id, key);
  const likes = await listLikes(interaction.user.id);

  const note = removed
    ? `🗑️ **${truncate(entry?.title ?? 'şarkı', 80)}** listeden kaldırıldı. (kalan: ${count})`
    : 'Bu şarkı listede bulunamadı — başka bir yerden kaldırılmış olabilir.';

  return interaction.update(likedPayload(likes, { note }));
}
