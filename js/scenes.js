// Biblioteca de cenas: vídeos reais do YouTube (player oficial incorporado) com créditos.
// Os roteiros são sugestões de dublagem em português ("o" = fala original, quando conhecida).
// Tempos sem "s/e" são distribuídos automaticamente e podem ser ajustados no Editor de cena.

export const CATEGORIES = ['Memes BR', 'Virais', 'Filmes', 'Novelas', 'TV', 'Música'];

const L = (c, t, o) => ({ c, t, o });

export const SCENES = [
  // ---------------- Memes BR ----------------
  { id: 'para-nossa-alegria', title: 'Para nossa alegria', cat: 'Memes BR', yt: 'K02Cxo3fAC8', start: 0, end: 45,
    credit: { title: 'VÍDEO OFICIAL: Para nossa alegria =)', channel: 'Juliana Crispiniano', channelUrl: 'https://www.youtube.com/@Juliana38668' },
    tags: 'jefferson suellen gospel cantar familia risada',
    lines: [L('Jefferson', 'Para nossa alegria...'), L('Suellen', '(tentando não rir) Para nossa alegria...'), L('Jefferson', 'Gente, foco! É a nossa grande chance!'), L('Suellen', 'Não dá, não dá! Olha a cara dele!'), L('Mãe', 'Vamos de novo, do começo, com emoção!')] },
  { id: 'ja-acabou-jessica', title: 'Já acabou, Jéssica?', cat: 'Memes BR', yt: 'Vdj-jhayGz0', start: 0, end: 40,
    credit: { title: 'Já Acabou, Jéssica? VIDEO OFICIAL COMPLETO!!', channel: 'The Smurf3', channelUrl: 'https://www.youtube.com/@thesmurf3143' },
    tags: 'jessica briga escola acabou',
    lines: [L('Narrador', 'Ao vivo, direto do pátio da escola...'), L('Plateia', 'Eita! Eita! Eita!'), L('Narrador', 'Ninguém entende como começou.'), L('Menina', 'Já acabou, Jéssica?'), L('Narrador', 'Sim. Acabou.')] },
  { id: 'irineu', title: 'Irineu, você não sabe nem eu', cat: 'Memes BR', yt: 'Odu55a5QtTE', start: 0, end: 25,
    credit: { title: 'IRINEU você não sabe nem eu (video original)', channel: 'Goden', channelUrl: 'https://www.youtube.com/@goden6108' },
    tags: 'irineu nao sabe nem eu',
    lines: [L('Voz 1', 'Ô Irineu!'), L('Voz 2', 'Você sabe quem eu sou?'), L('Voz 1', 'Você não sabe nem eu!')] },
  { id: 'ai-que-burro', title: 'Ai que burro, dá zero pra ele!', cat: 'Memes BR', yt: 'zyq6jQRRYVs', start: 0, end: 30,
    credit: { title: 'Ai que Burro, dá zero pra Ele! Animação', channel: 'Art Animada | ED GADELHA DESENHOS!', channelUrl: 'https://www.youtube.com/@EDGADELHADESENHOS' },
    tags: 'burro zero animação professor',
    lines: [L('Professor', 'Quanto é dois mais dois?'), L('Aluno', 'Hmm... vinte e dois?'), L('Professor', 'Ai que burro! Dá zero pra ele!')] },
  { id: 'chaves-paciencia', title: 'Ninguém tem paciência comigo', cat: 'Memes BR', yt: 'Y6dI89z25Gg', start: 0, end: 25,
    credit: { title: 'Chaves ninguém tem paciência comigo', channel: 'Ruan Silva', channelUrl: 'https://www.youtube.com/@RuanSilva-th7oo' },
    tags: 'chaves sbt vila seu madruga paciencia',
    lines: [L('Chaves', 'Ninguém tem paciência comigo...'), L('Chaves', 'Eu só queria um sanduíche de presunto!'), L('Chaves', 'Ninguém tem paciência comigo!')] },
  { id: 'luiza-canada', title: 'Menos a Luiza, que está no Canadá', cat: 'Memes BR', yt: 'K1iJ-eDxiJg', start: 0, end: 35,
    credit: { title: 'Menos a Luiza, que está no Canadá! [ORIGINAL]', channel: 'zatarustar', channelUrl: 'https://www.youtube.com/@zatarustar' },
    tags: 'luiza canada comercial paraiba familia',
    lines: [L('Pai', 'Olá! Eu sou o Gerardo, sou de João Pessoa.'), L('Pai', 'Estamos aqui reunidos com toda a família...'), L('Pai', 'Menos a Luiza, que está no Canadá!')] },

  // ---------------- TV ----------------
  { id: 'caetano-burro', title: 'Como você é burro, que coisa absurda!', cat: 'TV', yt: '0j42NkX4QVo', start: 0, end: 45,
    credit: { title: 'Caetano Veloso: "Como você é burro, que coisa absurda!" | 1978', channel: 'TV Cultura', channelUrl: 'https://www.youtube.com/@TVCultura' },
    tags: 'caetano veloso entrevista burro absurda 1978',
    lines: [L('Entrevistador', 'Mas o senhor não acha que...'), L('Caetano', 'Não, não, não. Espera aí.'), L('Caetano', 'Como você é burro, cara! Que coisa absurda!'), L('Entrevistador', '...Próxima pergunta.')] },
  { id: 'sandra-deselegante', title: 'Que deselegante!', cat: 'TV', yt: 'pXbgaFVWJ_0', start: 0, end: 30,
    credit: { title: 'Sandra Annenberg repetindo o seu bordão que deselegante no Jornal Hoje (01/12/11)', channel: 'Gabriel Cruz', channelUrl: 'https://www.youtube.com/@GabrielCruzRT' },
    tags: 'sandra annenberg jornal hoje deselegante globo',
    lines: [L('Apresentadora', 'Boa tarde. Começamos com uma notícia.'), L('Repórter', 'Ele simplesmente comeu o último pedaço de pizza.'), L('Apresentadora', 'Que deselegante!')] },
  { id: 'sweet-brown', title: 'Ain\'t nobody got time for that', cat: 'TV', yt: 'ydmPh4MXT3g', start: 0, end: 40,
    credit: { title: 'Sweet Brown on apartment fire: "Ain\'t Nobody Got Time for That!"', channel: 'KFOR Oklahoma\'s News 4', channelUrl: 'https://www.youtube.com/@kfor4news' },
    tags: 'sweet brown incendio jornal nobody time',
    lines: [L('Repórter', 'Moradores saíram correndo do prédio.'), L('Sweet Brown', 'Eu acordei pra ir pegar um refri...', 'I woke up to go get me a cold pop...'), L('Sweet Brown', 'E eu pensei que era um incêndio!'), L('Sweet Brown', 'Ninguém tem tempo pra isso!', 'Ain\'t nobody got time for that!')] },

  // ---------------- Novelas ----------------
  { id: 'nazare-escada', title: 'Nazaré e a briga na escada', cat: 'Novelas', yt: 'vMHRvLlZAJo', start: 0, end: 60,
    credit: { title: 'FATAL! DJENANE ROLA ESCADA A BAIXO APÓS BRIGA COM NAZARÉ E MORRE! | SENHORA DO DESTINO | VIVA', channel: 'Globoplay Novelas', channelUrl: 'https://www.youtube.com/@globoplaynovelas' },
    tags: 'nazare tedesco senhora do destino escada vila novela renata sorrah',
    lines: [L('Djenane', 'Eu sei de tudo, Nazaré! Tudo!'), L('Nazaré', 'Você não sabe de nada, querida.'), L('Djenane', 'Eu vou contar pra todo mundo!'), L('Nazaré', 'Cuidado com o degrau...'), L('Nazaré', 'Ops. Que pena.')] },
  { id: 'carminha-me-serve', title: 'Me serve, vadia!', cat: 'Novelas', yt: 's_F6O91r4u4', start: 0, end: 60,
    credit: { title: 'Avenida Brasil - Nina obriga Carminha a servi-lá, me serve vadia', channel: 'Julyo Souza', channelUrl: 'https://www.youtube.com/@julyosouzaoficial' },
    tags: 'avenida brasil carminha nina me serve novela',
    lines: [L('Nina', 'Senta. Não, melhor: fica de pé.'), L('Carminha', 'Você não manda em mim!'), L('Nina', 'Mando sim. Agora... me serve.'), L('Carminha', 'Eu vou acabar com você!'), L('Nina', 'Me serve, vadia!')] },

  // ---------------- Filmes ----------------
  { id: 'this-is-sparta', title: 'Isto é Esparta!', cat: 'Filmes', yt: 'QkWS9PiXekE', start: 0, end: 60,
    credit: { title: 'This is Sparta. Full scene.', channel: 'moodreel', channelUrl: 'https://www.youtube.com/@moodreel' },
    tags: '300 sparta leonidas poço mensageiro',
    lines: [L('Mensageiro', 'Escolha suas palavras com cuidado, Leônidas.'), L('Leônidas', 'Terra e água...'), L('Mensageiro', 'Isso é loucura!', 'This is madness!'), L('Leônidas', 'Loucura?'), L('Leônidas', 'ISTO É ESPARTAAA!', 'THIS IS SPARTA!')] },
  { id: 'a-queda', title: 'A Queda: o chefe descobre tudo', cat: 'Filmes', yt: '9xUS30-RFf0', start: 0, end: 120,
    credit: { title: 'Usain Bolt Breaks 100m World Record and Hitler Reacts', channel: 'welcometo21', channelUrl: 'https://www.youtube.com/@welcometo21' },
    tags: 'a queda downfall bunker reage chefe paródia',
    lines: [L('General', 'Senhor... temos notícias.'), L('Oficial', 'O Wi-Fi caiu. De novo.'), L('Chefe', 'Quem quiser ficar, fica. O resto sai da sala.'), L('Chefe', 'Eu pago a internet há 12 anos!'), L('Chefe', 'E vocês me dizem que o roteador está piscando LARANJA?'), L('Chefe', 'Quem desligou da tomada pra carregar o celular?!'), L('Chefe', 'Eu não aguento mais. Liguem pro suporte!'), L('Secretária', '(chorando) Eles colocaram a gente em espera...')] },

  // ---------------- Virais ----------------
  { id: 'shia-just-do-it', title: 'Just do it! (Shia LaBeouf)', cat: 'Virais', yt: 'ZXsQAXx_ao0', start: 0, end: 66,
    credit: { title: 'Shia LaBeouf "Just Do It" Motivational Speech (Original Video by LaBeouf, Rönkkö & Turner)', channel: 'MotivaShian', channelUrl: 'https://www.youtube.com/@motivashian4248' },
    tags: 'shia labeouf motivacional just do it faça',
    lines: [L('Shia', 'Faça! Simplesmente faça!', 'Do it! Just do it!'), L('Shia', 'Não deixe seus sonhos serem só sonhos!', "Don't let your dreams be dreams"), L('Shia', 'Ontem você disse amanhã.', 'Yesterday you said tomorrow'), L('Shia', 'Então FAÇA!', 'So just do it!'), L('Shia', 'Faça seus sonhos virarem realidade!', 'Make your dreams come true'), L('Shia', 'Simplesmente faça!', 'Just do it!'), L('Shia', 'Nada é impossível!', 'Nothing is impossible'), L('Shia', 'Cansou de começar de novo? Pare de desistir!', "If you're tired of starting over, stop giving up"), L('Shia', 'Hoje é o dia! FAÇA!', 'Just do it!')] },
  { id: 'charlie-bit', title: 'Charlie mordeu meu dedo', cat: 'Virais', yt: '_OBlgSz8sSM', start: 0, end: 56,
    credit: { title: 'Charlie bit my finger - again !', channel: 'HDCYT', channelUrl: 'https://www.youtube.com/@HDCYT' },
    tags: 'charlie bit my finger bebê irmão dedo',
    lines: [L('Harry', 'Olha, o Charlie vai morder.'), L('Harry', 'Ai! Charlie!', 'Ouch! Charlie!'), L('Harry', 'Charlie, isso doeu muito!', 'Ouch Charlie, that really hurt!'), L('Charlie', '(risada maligna de bebê)'), L('Harry', 'O Charlie me mordeu... e doeu de verdade.', 'Charlie bit me... and that really hurt')] },
  { id: 'double-rainbow', title: 'Arco-íris duplo', cat: 'Virais', yt: 'OQSNhk5ICTI', start: 0, end: 60,
    credit: { title: 'Yosemitebear Mountain Double Rainbow 1-8-10', channel: 'Yosemitebear62', channelUrl: 'https://www.youtube.com/@Hungrybear9562' },
    tags: 'double rainbow arco iris emoção',
    lines: [L('Homem', 'Uau... uau, uau, uau!', 'Whoa... whoa...'), L('Homem', 'É um arco-íris DUPLO!', "It's a double rainbow!"), L('Homem', 'Meu Deus do céu!', 'Oh my God!'), L('Homem', 'Vai de ponta a ponta!', 'All the way across the sky!'), L('Homem', 'O que isso significa?!', 'What does this mean?!'), L('Homem', '(chorando de emoção) É lindo demais...')] },
  { id: 'david-dentista', title: 'David depois do dentista', cat: 'Virais', yt: 'txqiwrbYGrs', start: 0, end: 60,
    credit: { title: 'David After Dentist', channel: 'booba1234', channelUrl: 'https://www.youtube.com/@daviddentist' },
    tags: 'david dentista anestesia isso é real',
    lines: [L('David', 'Eu tô me sentindo esquisito.', 'I feel funny'), L('Pai', 'É a anestesia, filho.'), L('David', 'Eu tenho dois dedos?'), L('David', 'Isso é a vida real?', 'Is this real life?'), L('David', 'Por que isso tá acontecendo comigo?', 'Why is this happening to me?'), L('David', 'Vai ser pra sempre?!', 'Is this gonna be forever?')] },
  { id: 'keyboard-cat', title: 'Gato tecladista', cat: 'Virais', yt: 'J---aiyznGQ', start: 0, end: 50,
    credit: { title: 'Keyboard Cat! - THE ORIGINAL!', channel: 'Keyboard Cat!', channelUrl: 'https://www.youtube.com/@keyboardcatreal' },
    tags: 'gato teclado musica animais',
    lines: [L('Gato', 'Boa noite, Brasil! Essa é pra vocês!'), L('Gato', 'Ninguém me ensinou, eu nasci assim.'), L('Gato', 'Agora a parte difícil... segura!'), L('Gato', 'Obrigado, obrigado. Aceito sachê como cachê.')] },
  { id: 'britney', title: 'Deixem a Britney em paz!', cat: 'Virais', yt: 'VCcZSGYogLs', start: 0, end: 60,
    credit: { title: 'LEAVE BRITNEY ALONE! (Original)', channel: 'ImHavinChestPain', channelUrl: 'https://www.youtube.com/@ImHavinChestPain' },
    tags: 'leave britney alone choro fã',
    lines: [L('Chris', 'Como vocês têm coragem?!', 'How dare you!'), L('Chris', 'Ela é um ser humano!'), L('Chris', 'Deixem ela em paz!', 'Leave her alone!'), L('Chris', 'DEIXEM A BRITNEY EM PAZ!', 'LEAVE BRITNEY ALONE!')] },
  { id: 'star-wars-kid', title: 'Star Wars Kid', cat: 'Virais', yt: 'HPPj6viIBmU', start: 0, end: 40,
    credit: { title: 'Star Wars Kid', channel: 'Jimi Love', channelUrl: 'https://www.youtube.com/@raze7ds' },
    tags: 'star wars kid sabre luz narração épica',
    lines: [L('Narrador', 'Em uma garagem muito, muito distante...'), L('Jedi', 'Sinta a Força...'), L('Jedi', 'Hiaaa! Hiaaa!'), L('Narrador', 'O Império nunca esteve tão ameaçado.')] },
  { id: 'bed-intruder', title: 'Escondam as crianças!', cat: 'Virais', yt: 'hMtZfW2z9dw', start: 0, end: 60,
    credit: { title: 'BED INTRUDER SONG!!!', channel: 'schmoyoho', channelUrl: 'https://www.youtube.com/@schmoyoho' },
    tags: 'antoine dodson hide your kids escondam',
    lines: [L('Antoine', 'Escondam as crianças, escondam a esposa!', 'Hide your kids, hide your wife'), L('Antoine', 'Porque tão invadindo tudo aqui!'), L('Antoine', 'Você não precisa vir confessar...'), L('Antoine', 'A gente tá te procurando!', "We're looking for you")] },
  { id: 'charlie-unicorn', title: 'Charlie, o unicórnio', cat: 'Virais', yt: 'CsGYh8AacgY', start: 0, end: 75,
    credit: { title: 'Charlie the Unicorn', channel: 'FilmCow', channelUrl: 'https://www.youtube.com/@filmcow' },
    tags: 'charlie unicornio candy mountain animação',
    lines: [L('Unicórnio azul', 'Charlie! Charlie!'), L('Unicórnio rosa', 'Charlie, acorda! A gente vai pra Montanha de Doces!', "We're going to Candy Mountain, Charlie!"), L('Charlie', 'Me deixem dormir, gente...'), L('Unicórnio azul', 'Montanha de Doces, Charlie!'), L('Charlie', 'Tá, tá... eu vou. Mas é a última vez.'), L('Unicórnio rosa', 'Uhuuul! Charlie vai!')] },

  // ---------------- Música ----------------
  { id: 'ppap', title: 'Pen-Pineapple-Apple-Pen', cat: 'Música', yt: 'Ct6BUPvE2sM', start: 0, end: 60,
    credit: { title: 'PIKOTARO - PPAP (Pen Pineapple Apple Pen) (Long Version) (Official Video) [Ultra Records]', channel: 'Ultra Records', channelUrl: 'https://www.youtube.com/@ultrarecords' },
    tags: 'ppap pen apple caneta maçã abacaxi',
    lines: [L('Piko', 'Eu tenho uma caneta. Eu tenho uma maçã.', 'I have a pen, I have an apple'), L('Piko', 'Ãh! Maçã-caneta!', 'Uh! Apple-pen!'), L('Piko', 'Eu tenho uma caneta. Eu tenho um abacaxi.', 'I have a pen, I have pineapple'), L('Piko', 'Ãh! Abacaxi-caneta!', 'Uh! Pineapple-pen!'), L('Piko', 'Maçã-caneta... abacaxi-caneta...', 'Apple-pen, pineapple-pen'), L('Piko', 'Ãh! CANETA-ABACAXI-MAÇÃ-CANETA!', 'Pen-Pineapple-Apple-Pen!')] },
  { id: 'trololo', title: 'Trololo', cat: 'Música', yt: 'oavMtUWDBTM', start: 0, end: 60,
    credit: { title: 'Mr. Trololo original upload', channel: 'RealPapaPit', channelUrl: 'https://www.youtube.com/@RealPapaPit' },
    tags: 'trololo eduard khil cantor',
    lines: [L('Cantor', 'Trololó, lololó, lalala...'), L('Cantor', 'Ô-ô-ô, hahaha!'), L('Cantor', 'Eu esqueci a letra, mas sigo sorrindo!'), L('Cantor', 'Trololó... lololó!')] },
  { id: 'the-fox', title: 'O que a raposa diz?', cat: 'Música', yt: 'jofNR_WkoCE', start: 0, end: 60,
    credit: { title: 'Ylvis - The Fox (What Does The Fox Say?) [Official music video HD]', channel: 'TVNorge', channelUrl: 'https://www.youtube.com/@tvnorge' },
    tags: 'ylvis fox raposa what does',
    lines: [L('Cantor', 'Cachorro faz au-au.'), L('Cantor', 'Gato faz miau.'), L('Cantor', 'Vaca faz muuu.'), L('Cantor', 'Mas... e a raposa?'), L('Cantor', 'O QUE A RAPOSA DIZ?!', 'What does the fox say?')] },
  { id: 'gangnam', title: 'Gangnam Style', cat: 'Música', yt: '9bZkp7q19f0', start: 0, end: 45,
    credit: { title: 'PSY - GANGNAM STYLE(강남스타일) M/V', channel: 'officialpsy', channelUrl: 'https://www.youtube.com/@officialpsy' },
    tags: 'psy gangnam style dança cavalinho',
    lines: [L('PSY', 'Relaxa... eu tô de férias.'), L('PSY', 'Eu sou do estilo... Gangnam!'), L('PSY', 'Agora todo mundo: cavalinho!'), L('PSY', 'Eeeei, sexy lady!')] },
  { id: 'chocolate-rain', title: 'Chocolate Rain', cat: 'Música', yt: 'EwTZ2xpQwpA', start: 0, end: 45,
    credit: { title: '"Chocolate Rain" Original Song by Tay Zonday', channel: 'TayZonday', channelUrl: 'https://www.youtube.com/@tayzonday' },
    tags: 'chocolate rain tay zonday voz grave',
    lines: [L('Tay', 'Chuva de chocolate...'), L('Tay', '(eu me afasto do microfone pra respirar)', 'I move away from the mic to breathe in'), L('Tay', 'Chuva de chocolate...'), L('Tay', 'Alguns ficam no sol, outros sentem a chuva.')] },
  { id: 'evolution-dance', title: 'Evolução da dança', cat: 'Música', yt: 'dMH0bHeiRNg', start: 0, end: 60,
    credit: { title: 'Evolution of Dance', channel: 'Judson Laipply', channelUrl: 'https://www.youtube.com/@judsonlaipply' },
    tags: 'dança evolution narração esportiva',
    lines: [L('Narrador', 'E ele entra no palco! Que confiança!'), L('Narrador', 'Olha esse rebolado, minha gente!'), L('Narrador', 'Mudou o ritmo! Mudou TUDO!'), L('Narrador', 'É dança de casamento? É dança de formatura? É TUDO!'), L('Narrador', 'Que fôlego! Esse homem é uma máquina!')] },
  { id: 'heyyeya', title: 'HEYYEYAAEYAAAEYAEYAA', cat: 'Música', yt: 'ZZ5LpwO-An4', start: 0, end: 60,
    credit: { title: 'HEYYEYAAEYAAAEYAEYAA', channel: 'ProtoOfSnagem', channelUrl: 'https://www.youtube.com/@ProtoOfSnagem' },
    tags: 'he-man heyyeya what\'s going on desenho',
    lines: [L('He-Man', 'E aí, galera do castelo!'), L('He-Man', 'Eu disse: HEY! O que tá acontecendo?', "And I said hey, what's going on?"), L('Esqueleto', 'Para de cantar, He-Man!'), L('He-Man', 'HEYYEYAAEYAAAEYAEYAA!')] },
  { id: 'sandstorm', title: 'Darude – Sandstorm', cat: 'Música', yt: 'y6120QOlsfU', start: 0, end: 40,
    credit: { title: 'Darude - Sandstorm', channel: 'Darude', channelUrl: 'https://www.youtube.com/@darude' },
    tags: 'darude sandstorm eletronica tempestade',
    lines: [L('Locutor', 'Atenção, motoristas: tempestade de areia na pista!'), L('Locutor', 'Tu-tu-tu-tu-tuuu!'), L('Locutor', 'Qual o nome dessa música? Sandstorm!')] },
  { id: 'baby', title: 'Baby (paródia)', cat: 'Música', yt: 'kffacxfA7G4', start: 0, end: 60,
    credit: { title: 'Justin Bieber - Baby ft. Ludacris', channel: 'JustinBieberVEVO', channelUrl: 'https://www.youtube.com/@JustinBieberVEVO' },
    tags: 'justin bieber baby paródia',
    lines: [L('Cantor', 'Ô, mãe... cadê o carregador?'), L('Cantor', 'Eu deixei bem aqui do lado da cama!'), L('Cantor', 'Bateria em um por cento... baby, baby, baby, ôôô!')] },
  { id: 'rickroll', title: 'Rickroll', cat: 'Música', yt: 'dQw4w9WgXcQ', start: 0, end: 60,
    credit: { title: 'Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)', channel: 'Rick Astley', channelUrl: 'https://www.youtube.com/@RickAstleyYT' },
    tags: 'rick astley never gonna give you up rickroll',
    lines: [L('Rick', 'Você caiu no meu golpe de novo...'), L('Rick', 'Nunca vou te abandonar!', 'Never gonna give you up'), L('Rick', 'Nunca vou te decepcionar!', 'Never gonna let you down'), L('Rick', 'Nunca vou sair correndo e te largar!', 'Never gonna run around and desert you')] },
];

export function ytUrl(id, start = 0) { return `https://www.youtube.com/watch?v=${id}${start ? `&t=${Math.floor(start)}s` : ''}`; }
export function ytThumb(id) { return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }

// Distribui falas sem tempo ao longo do corte
export function autoTime(lines, dur) {
  const n = lines.length || 1;
  const slot = dur / n;
  return lines.map((l, i) => ({ ...l, s: +(i * slot + slot * 0.12).toFixed(2), e: +(i * slot + slot * 0.88).toFixed(2) }));
}
