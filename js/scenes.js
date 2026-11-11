// Biblioteca de cenas: vídeos reais do YouTube (player oficial incorporado) com créditos.
// As cenas vêm sem falas: na primeira vez o usuário marca as falas reais do vídeo (Marcar falas)
// e elas ficam salvas como padrão da cena neste aparelho.

export const CATEGORIES = ['Memes BR', 'Virais', 'Filmes', 'Novelas', 'TV', 'Música'];

const L = (c, t, o) => ({ c, t, o });

export const SCENES = [
  // ---------------- Memes BR ----------------
  { id: 'para-nossa-alegria', title: 'Para nossa alegria', cat: 'Memes BR', yt: 'K02Cxo3fAC8', start: 0, end: 45,
    credit: { title: 'VÍDEO OFICIAL: Para nossa alegria =)', channel: 'Juliana Crispiniano', channelUrl: 'https://www.youtube.com/@Juliana38668' },
    tags: 'jefferson suellen gospel cantar familia risada',
    lines: [] },
  { id: 'ja-acabou-jessica', title: 'Já acabou, Jéssica?', cat: 'Memes BR', yt: 'Vdj-jhayGz0', start: 0, end: 40,
    credit: { title: 'Já Acabou, Jéssica? VIDEO OFICIAL COMPLETO!!', channel: 'The Smurf3', channelUrl: 'https://www.youtube.com/@thesmurf3143' },
    tags: 'jessica briga escola acabou',
    lines: [] },
  { id: 'irineu', title: 'Irineu, você não sabe nem eu', cat: 'Memes BR', yt: 'Odu55a5QtTE', start: 0, end: 25,
    credit: { title: 'IRINEU você não sabe nem eu (video original)', channel: 'Goden', channelUrl: 'https://www.youtube.com/@goden6108' },
    tags: 'irineu nao sabe nem eu',
    lines: [] },
  { id: 'ai-que-burro', title: 'Ai que burro, dá zero pra ele!', cat: 'Memes BR', yt: 'zyq6jQRRYVs', start: 0, end: 30,
    credit: { title: 'Ai que Burro, dá zero pra Ele! Animação', channel: 'Art Animada | ED GADELHA DESENHOS!', channelUrl: 'https://www.youtube.com/@EDGADELHADESENHOS' },
    tags: 'burro zero animação professor',
    lines: [] },
  { id: 'chaves-paciencia', title: 'Ninguém tem paciência comigo', cat: 'Memes BR', yt: 'Y6dI89z25Gg', start: 0, end: 25,
    credit: { title: 'Chaves ninguém tem paciência comigo', channel: 'Ruan Silva', channelUrl: 'https://www.youtube.com/@RuanSilva-th7oo' },
    tags: 'chaves sbt vila seu madruga paciencia',
    lines: [] },
  { id: 'luiza-canada', title: 'Menos a Luiza, que está no Canadá', cat: 'Memes BR', yt: 'K1iJ-eDxiJg', start: 0, end: 35,
    credit: { title: 'Menos a Luiza, que está no Canadá! [ORIGINAL]', channel: 'zatarustar', channelUrl: 'https://www.youtube.com/@zatarustar' },
    tags: 'luiza canada comercial paraiba familia',
    lines: [] },

  // ---------------- TV ----------------
  { id: 'caetano-burro', title: 'Como você é burro, que coisa absurda!', cat: 'TV', yt: '0j42NkX4QVo', start: 0, end: 45,
    credit: { title: 'Caetano Veloso: "Como você é burro, que coisa absurda!" | 1978', channel: 'TV Cultura', channelUrl: 'https://www.youtube.com/@TVCultura' },
    tags: 'caetano veloso entrevista burro absurda 1978',
    lines: [] },
  { id: 'sandra-deselegante', title: 'Que deselegante!', cat: 'TV', yt: 'pXbgaFVWJ_0', start: 0, end: 30,
    credit: { title: 'Sandra Annenberg repetindo o seu bordão que deselegante no Jornal Hoje (01/12/11)', channel: 'Gabriel Cruz', channelUrl: 'https://www.youtube.com/@GabrielCruzRT' },
    tags: 'sandra annenberg jornal hoje deselegante globo',
    lines: [] },
  { id: 'sweet-brown', title: 'Ain\'t nobody got time for that', cat: 'TV', yt: 'ydmPh4MXT3g', start: 0, end: 40,
    credit: { title: 'Sweet Brown on apartment fire: "Ain\'t Nobody Got Time for That!"', channel: 'KFOR Oklahoma\'s News 4', channelUrl: 'https://www.youtube.com/@kfor4news' },
    tags: 'sweet brown incendio jornal nobody time',
    lines: [] },

  // ---------------- Novelas ----------------
  { id: 'nazare-escada', title: 'Nazaré e a briga na escada', cat: 'Novelas', yt: 'vMHRvLlZAJo', start: 0, end: 60,
    credit: { title: 'FATAL! DJENANE ROLA ESCADA A BAIXO APÓS BRIGA COM NAZARÉ E MORRE! | SENHORA DO DESTINO | VIVA', channel: 'Globoplay Novelas', channelUrl: 'https://www.youtube.com/@globoplaynovelas' },
    tags: 'nazare tedesco senhora do destino escada vila novela renata sorrah',
    lines: [] },
  { id: 'carminha-me-serve', title: 'Me serve, vadia!', cat: 'Novelas', yt: 's_F6O91r4u4', start: 0, end: 60,
    credit: { title: 'Avenida Brasil - Nina obriga Carminha a servi-lá, me serve vadia', channel: 'Julyo Souza', channelUrl: 'https://www.youtube.com/@julyosouzaoficial' },
    tags: 'avenida brasil carminha nina me serve novela',
    lines: [] },

  // ---------------- Filmes ----------------
  { id: 'this-is-sparta', title: 'Isto é Esparta!', cat: 'Filmes', yt: 'QkWS9PiXekE', start: 0, end: 60,
    credit: { title: 'This is Sparta. Full scene.', channel: 'moodreel', channelUrl: 'https://www.youtube.com/@moodreel' },
    tags: '300 sparta leonidas poço mensageiro',
    lines: [] },
  { id: 'a-queda', title: 'A Queda: o chefe descobre tudo', cat: 'Filmes', yt: '9xUS30-RFf0', start: 0, end: 120,
    credit: { title: 'Usain Bolt Breaks 100m World Record and Hitler Reacts', channel: 'welcometo21', channelUrl: 'https://www.youtube.com/@welcometo21' },
    tags: 'a queda downfall bunker reage chefe paródia',
    lines: [] },

  // ---------------- Virais ----------------
  { id: 'shia-just-do-it', title: 'Just do it! (Shia LaBeouf)', cat: 'Virais', yt: 'ZXsQAXx_ao0', start: 0, end: 66,
    credit: { title: 'Shia LaBeouf "Just Do It" Motivational Speech (Original Video by LaBeouf, Rönkkö & Turner)', channel: 'MotivaShian', channelUrl: 'https://www.youtube.com/@motivashian4248' },
    tags: 'shia labeouf motivacional just do it faça',
    lines: [] },
  { id: 'charlie-bit', title: 'Charlie mordeu meu dedo', cat: 'Virais', yt: '_OBlgSz8sSM', start: 0, end: 56,
    credit: { title: 'Charlie bit my finger - again !', channel: 'HDCYT', channelUrl: 'https://www.youtube.com/@HDCYT' },
    tags: 'charlie bit my finger bebê irmão dedo',
    lines: [] },
  { id: 'double-rainbow', title: 'Arco-íris duplo', cat: 'Virais', yt: 'OQSNhk5ICTI', start: 0, end: 60,
    credit: { title: 'Yosemitebear Mountain Double Rainbow 1-8-10', channel: 'Yosemitebear62', channelUrl: 'https://www.youtube.com/@Hungrybear9562' },
    tags: 'double rainbow arco iris emoção',
    lines: [] },
  { id: 'david-dentista', title: 'David depois do dentista', cat: 'Virais', yt: 'txqiwrbYGrs', start: 0, end: 60,
    credit: { title: 'David After Dentist', channel: 'booba1234', channelUrl: 'https://www.youtube.com/@daviddentist' },
    tags: 'david dentista anestesia isso é real',
    lines: [] },
  { id: 'keyboard-cat', title: 'Gato tecladista', cat: 'Virais', yt: 'J---aiyznGQ', start: 0, end: 50,
    credit: { title: 'Keyboard Cat! - THE ORIGINAL!', channel: 'Keyboard Cat!', channelUrl: 'https://www.youtube.com/@keyboardcatreal' },
    tags: 'gato teclado musica animais',
    lines: [] },
  { id: 'britney', title: 'Deixem a Britney em paz!', cat: 'Virais', yt: 'VCcZSGYogLs', start: 0, end: 60,
    credit: { title: 'LEAVE BRITNEY ALONE! (Original)', channel: 'ImHavinChestPain', channelUrl: 'https://www.youtube.com/@ImHavinChestPain' },
    tags: 'leave britney alone choro fã',
    lines: [] },
  { id: 'star-wars-kid', title: 'Star Wars Kid', cat: 'Virais', yt: 'HPPj6viIBmU', start: 0, end: 40,
    credit: { title: 'Star Wars Kid', channel: 'Jimi Love', channelUrl: 'https://www.youtube.com/@raze7ds' },
    tags: 'star wars kid sabre luz narração épica',
    lines: [] },
  { id: 'bed-intruder', title: 'Escondam as crianças!', cat: 'Virais', yt: 'hMtZfW2z9dw', start: 0, end: 60,
    credit: { title: 'BED INTRUDER SONG!!!', channel: 'schmoyoho', channelUrl: 'https://www.youtube.com/@schmoyoho' },
    tags: 'antoine dodson hide your kids escondam',
    lines: [] },
  { id: 'charlie-unicorn', title: 'Charlie, o unicórnio', cat: 'Virais', yt: 'CsGYh8AacgY', start: 0, end: 75,
    credit: { title: 'Charlie the Unicorn', channel: 'FilmCow', channelUrl: 'https://www.youtube.com/@filmcow' },
    tags: 'charlie unicornio candy mountain animação',
    lines: [] },

  // ---------------- Música ----------------
  { id: 'ppap', title: 'Pen-Pineapple-Apple-Pen', cat: 'Música', yt: 'Ct6BUPvE2sM', start: 0, end: 60,
    credit: { title: 'PIKOTARO - PPAP (Pen Pineapple Apple Pen) (Long Version) (Official Video) [Ultra Records]', channel: 'Ultra Records', channelUrl: 'https://www.youtube.com/@ultrarecords' },
    tags: 'ppap pen apple caneta maçã abacaxi',
    lines: [] },
  { id: 'trololo', title: 'Trololo', cat: 'Música', yt: 'oavMtUWDBTM', start: 0, end: 60,
    credit: { title: 'Mr. Trololo original upload', channel: 'RealPapaPit', channelUrl: 'https://www.youtube.com/@RealPapaPit' },
    tags: 'trololo eduard khil cantor',
    lines: [] },
  { id: 'the-fox', title: 'O que a raposa diz?', cat: 'Música', yt: 'jofNR_WkoCE', start: 0, end: 60,
    credit: { title: 'Ylvis - The Fox (What Does The Fox Say?) [Official music video HD]', channel: 'TVNorge', channelUrl: 'https://www.youtube.com/@tvnorge' },
    tags: 'ylvis fox raposa what does',
    lines: [] },
  { id: 'gangnam', title: 'Gangnam Style', cat: 'Música', yt: '9bZkp7q19f0', start: 0, end: 45,
    credit: { title: 'PSY - GANGNAM STYLE(강남스타일) M/V', channel: 'officialpsy', channelUrl: 'https://www.youtube.com/@officialpsy' },
    tags: 'psy gangnam style dança cavalinho',
    lines: [] },
  { id: 'chocolate-rain', title: 'Chocolate Rain', cat: 'Música', yt: 'EwTZ2xpQwpA', start: 0, end: 45,
    credit: { title: '"Chocolate Rain" Original Song by Tay Zonday', channel: 'TayZonday', channelUrl: 'https://www.youtube.com/@tayzonday' },
    tags: 'chocolate rain tay zonday voz grave',
    lines: [] },
  { id: 'evolution-dance', title: 'Evolução da dança', cat: 'Música', yt: 'dMH0bHeiRNg', start: 0, end: 60,
    credit: { title: 'Evolution of Dance', channel: 'Judson Laipply', channelUrl: 'https://www.youtube.com/@judsonlaipply' },
    tags: 'dança evolution narração esportiva',
    lines: [] },
  { id: 'heyyeya', title: 'HEYYEYAAEYAAAEYAEYAA', cat: 'Música', yt: 'ZZ5LpwO-An4', start: 0, end: 60,
    credit: { title: 'HEYYEYAAEYAAAEYAEYAA', channel: 'ProtoOfSnagem', channelUrl: 'https://www.youtube.com/@ProtoOfSnagem' },
    tags: 'he-man heyyeya what\'s going on desenho',
    lines: [] },
  { id: 'sandstorm', title: 'Darude – Sandstorm', cat: 'Música', yt: 'y6120QOlsfU', start: 0, end: 40,
    credit: { title: 'Darude - Sandstorm', channel: 'Darude', channelUrl: 'https://www.youtube.com/@darude' },
    tags: 'darude sandstorm eletronica tempestade',
    lines: [] },
  { id: 'baby', title: 'Baby (paródia)', cat: 'Música', yt: 'kffacxfA7G4', start: 0, end: 60,
    credit: { title: 'Justin Bieber - Baby ft. Ludacris', channel: 'JustinBieberVEVO', channelUrl: 'https://www.youtube.com/@JustinBieberVEVO' },
    tags: 'justin bieber baby paródia',
    lines: [] },
  { id: 'rickroll', title: 'Rickroll', cat: 'Música', yt: 'dQw4w9WgXcQ', start: 0, end: 60,
    credit: { title: 'Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)', channel: 'Rick Astley', channelUrl: 'https://www.youtube.com/@RickAstleyYT' },
    tags: 'rick astley never gonna give you up rickroll',
    lines: [] },
];

export function ytUrl(id, start = 0) { return `https://www.youtube.com/watch?v=${id}${start ? `&t=${Math.floor(start)}s` : ''}`; }
export function ytThumb(id) { return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }

// Distribui falas sem tempo ao longo do corte
export function autoTime(lines, dur) {
  const n = lines.length || 1;
  const slot = dur / n;
  return lines.map((l, i) => ({ ...l, s: +(i * slot + slot * 0.12).toFixed(2), e: +(i * slot + slot * 0.88).toFixed(2) }));
}
