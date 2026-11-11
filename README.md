# Dublamento — estúdio de dublagem de cenas e memes

Site (HTML/CSS/JS puro, sem servidor próprio) para dublar cenas famosas fala por fala, no celular ou no computador. Pode ser instalado como app (PWA).

## Como colocar no ar (o microfone exige HTTPS)

**GitHub Pages (link fixo):**
1. Crie um repositório (ex.: `dublamento`) e envie todos os arquivos desta pasta.
2. Settings → Pages → Branch `main` / pasta `/ (root)` → Save.
3. Em 1–2 minutos o site abre em `https://SEU-USUARIO.github.io/dublamento/`.

**Netlify Drop (mais rápido):** acesse https://app.netlify.com/drop e arraste esta pasta.

**Testar no computador:** dentro da pasta rode `python3 -m http.server 8080` e abra http://localhost:8080 (o microfone funciona em localhost). Abrir o `index.html` direto com duplo clique NÃO funciona (o navegador bloqueia módulos e microfone em `file://`).

**Instalar no celular:** abra o link → Chrome: menu ⋮ → *Instalar app* · iPhone (Safari): Compartilhar → *Adicionar à Tela de Início*.

## O que tem
- 32 cenas reais do YouTube (memes BR, virais, filmes, novelas, TV, música) tocadas pelo player oficial, com créditos (título, canal, link).
- Adicionar qualquer link do YouTube (com início/fim do trecho) ou importar vídeo do celular (funciona offline).
- Falas com janela fixa: o take dura exatamente o tempo da fala e a gravação para sozinha.
- Gravar fala, cena inteira ou só as pendentes; contagem 3-2-1, pré-rolagem, retakes com histórico.
- Régua de tempo com blocos das falas (duração), forma de onda dos takes, sons; arrastar para ajustar.
- Editor de cena: “Marcar no ritmo”, ajuste fino ±0,01 s, dividir/juntar/adicionar falas, importar/exportar .srt.
- Sincronia: ajuste por take (±10/±50 ms, arrastar, encaixe automático) e latência geral do aparelho.
- 15 efeitos de voz, 16 efeitos sonoros, 8 trilhas (geradas no app, sem direitos autorais), mixer.
- Exportar: vídeo dublado (vídeo próprio direto no app; YouTube via gravação da aba no computador ou modo apresentação + gravador de tela no celular), áudio .wav, legendas .srt e arquivo de projeto para compartilhar.
- Projetos salvos automaticamente no aparelho (IndexedDB).

## Estrutura
- `index.html`, `css/app.css`, `manifest.webmanifest`, `sw.js`, `icons/`
- `js/app.js` (telas), `js/studio.js` (estúdio), `js/audio.js` (microfone, efeitos, sons, mixagem), `js/player.js` (YouTube e vídeo local), `js/export.js`, `js/scenes.js` (biblioteca e créditos), `js/db.js`, `js/util.js`

Atalhos no computador: Espaço = play/pause · R = gravar fala · ←/→ = fala anterior/próxima.
