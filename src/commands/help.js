import { SlashCommandBuilder } from 'discord.js';
import { COLORS } from '../music/embeds.js';
import { config } from '../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Komutları listeler'),

  async execute(interaction, client) {
    const lines = [...client.commands.values()]
      .map((command) => `**/${command.data.name}** — ${command.data.description}`)
      .sort()
      .join('\n');

    const embed = {
      color: COLORS.primary,
      title: 'Müzik Botu',
      description: lines,
      fields: [
        {
          name: 'Butonlar (şimdi çalıyor kartındaki)',
          value: [
            '⏮️ **Önceki** — bir önceki parçaya döner (geçmiş yoksa pasif)',
            '⏸️ **Duraklat** — duraklatır; ▶️ olunca devam ettirir',
            '⏭️ **Atla** — sıradaki parçaya geçer',
            '❤️ **Beğen** — parçayı beğenilenlere ekler, `/liked` ile kuyruğa alınır',
            '🎛️ **Kontrol paneli** — çalan parça, ses/tekrar/otomatik durumu ve kuyruk listesi',
          ].join('\n'),
        },
        {
          name: 'Kaynaklar',
          value: 'YouTube (arama/link/playlist) • SoundCloud • doğrudan ses linki',
        },
        {
          name: 'Öneri motoru',
          value: config.lastfmKey
            ? 'Last.fm + YouTube Radio mix'
            : 'YouTube Radio mix _(Last.fm anahtarı eklenince daha isabetli olur)_',
        },
      ],
      footer: { text: 'Spotify ses akışı sunmadığı için yalnızca metadata sağlar; bu bot kullanmıyor.' },
    };

    return interaction.reply({ embeds: [embed] });
  },
};
