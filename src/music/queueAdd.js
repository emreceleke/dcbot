/**
 * Kuyruğa ekleme sırası.
 *
 * Sorun: `/play Ati242 - maraton` araması tek parça değil, Lavalink'in
 * döndürdüğü **20 sonucu** kuyruğa koyuyor (sürekli çalma için iyi). Ama sonra
 * elle bir şarkı eklediğinde o da bu 20 parçanın **sonuna** giriyordu; kullanıcı
 * eklediği şarkıyı hemen duymak istiyor.
 *
 * Çözüm: arama sonuçları/öneriler "dolgu" olarak işaretlenir. Elle eklenen
 * parçalar, ilk dolgu parçasının **önüne** girer; böylece:
 *
 *   [çalan] [elle eklenen 1] [elle eklenen 2] [dolgu...] [dolgu...]
 *
 * Elle eklenenler kendi aralarında da sırayı korur (playlist bozulmaz).
 *
 * İşaretler `WeakSet`'te tutulur: parça nesnesi kuyruktan çıkınca kendiliğinden
 * düşer, ekstra bellek/disk yükü yok. Restart'tan sonra işaretler kaybolur
 * (o noktada kuyruk zaten baştan kuruluyor).
 */
const fillerTracks = new WeakSet();

const asList = (tracks) => (Array.isArray(tracks) ? tracks : [tracks]).filter(Boolean);

export function isFillerTrack(track) {
  return fillerTracks.has(track);
}

/** Elle eklenen parçanın gireceği index: ilk dolgu parçasının yeri. */
export function manualInsertIndex(player) {
  const tracks = player?.queue?.tracks ?? [];
  const index = tracks.findIndex((track) => fillerTracks.has(track));
  return index === -1 ? tracks.length : index;
}

/** Elle istenen parça(lar): dolgu bölgesinin önüne eklenir. */
export async function addManualTracks(player, tracks) {
  const list = asList(tracks);
  if (!list.length) return 0;
  await player.queue.add(list, manualInsertIndex(player));
  return list.length;
}

/** Öneri/arama dolgusu: kuyruğun sonuna eklenir ve işaretlenir. */
export async function addFillerTracks(player, tracks) {
  const list = asList(tracks);
  if (!list.length) return 0;
  for (const track of list) fillerTracks.add(track);
  await player.queue.add(list);
  return list.length;
}
