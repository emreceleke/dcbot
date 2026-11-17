import { SlashCommandBuilder } from 'discord.js';
import { COLORS } from '../music/embeds.js';

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
            '🎛️ **Kontrol paneli** — çalan parça, ses/tekrar/otomatik durumu, kuyruk ve kısayol butonları',
            '-# Panel kısayolları: Tekrar · Karıştır · Oto. çalma · Durdur · Ses −/+ · Kuyruk · Beğeniler · Geçmiş',
            '-# `/liked` listesindeki menüden bir şarkıyı beğenilerden kaldırabilirsin.',
          ].join('\n'),
        },
      ],
      footer: { text: 'Keller BOT v1.0 - Created by @brainw4sher' },
    };

    return interaction.reply({ embeds: [embed] });
  },
};
