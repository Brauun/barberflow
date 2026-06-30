import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import puppeteer from 'puppeteer'
import ffmpegPath from 'ffmpeg-static'

const rootDir = process.cwd()
const outputDir = path.join(rootDir, 'docs', 'video')
const framesDir = path.join(outputDir, 'frames')
const segmentsDir = path.join(outputDir, 'segments')
const outputPath = path.join(outputDir, 'bw-barber-video-apresentacao.mp4')
const logoPath = path.join(rootDir, 'public', 'brand', 'bw-barber-login-logo.png')

const scenes = [
  {
    kind: 'cover',
    duration: 4,
    eyebrow: 'BW BARBER',
    title: 'Gestão completa. Experiência simples.',
    caption: 'Administração, rotina do barbeiro e jornada do cliente em uma única plataforma.',
  },
  {
    duration: 4,
    eyebrow: 'ACESSO SEGURO',
    title: 'Uma entrada para cada perfil',
    caption: 'Login responsivo para administrador, barbeiro e cliente, na web ou instalado como PWA.',
    assets: [path.join(rootDir, 'docs', 'web-prints', '01-login-web.png')],
  },
  {
    duration: 5,
    eyebrow: 'ADMINISTRADOR',
    title: 'O negócio em uma visão',
    caption: 'Receita, lucro, atendimentos e evolução do faturamento em um dashboard direto e acionável.',
    assets: [path.join(rootDir, 'docs', 'web-prints', '02-dashboard-web.png')],
  },
  {
    duration: 5,
    eyebrow: 'ADMINISTRADOR',
    title: 'Agenda e operação no mesmo fluxo',
    caption: 'Crie, acompanhe e finalize atendimentos com status, horários e profissionais organizados.',
    assets: [path.join(rootDir, 'docs', 'web-prints', '03-agendamento-web.png')],
  },
  {
    duration: 4.5,
    eyebrow: 'ADMINISTRADOR',
    title: 'Financeiro sob controle',
    caption: 'Entradas, saídas, saldo e lucro consolidados para decisões mais seguras.',
    assets: [path.join(rootDir, 'docs', 'web-prints', '04-financeiro-web.png')],
  },
  {
    duration: 4.5,
    eyebrow: 'ADMINISTRADOR',
    title: 'Relatórios que viram decisão',
    caption: 'Filtros, indicadores e exportações para acompanhar a operação com clareza.',
    assets: [path.join(rootDir, 'docs', 'web-prints', '05-relatorios-web.png')],
  },
  {
    duration: 4,
    eyebrow: 'ADMINISTRADOR',
    title: 'Planos preparados para crescer',
    caption: 'Trial, recursos e limites organizados em uma experiência de assinatura transparente.',
    assets: [path.join(rootDir, 'docs', 'web-prints', '06-assinatura-web.png')],
  },
  {
    duration: 5,
    eyebrow: 'BARBEIRO',
    title: 'A rotina certa, sem distrações',
    caption: 'O profissional acompanha sua agenda, atendimentos, comissão e histórico próprio.',
    layout: 'split',
    assets: [
      path.join(rootDir, 'docs', 'mobile-prints', '02-dashboard-barbearia.png'),
      path.join(rootDir, 'docs', 'mobile-prints', '03-agendamento-cliente.png'),
    ],
  },
  {
    duration: 5,
    eyebrow: 'BARBEIRO',
    title: 'Atendimento atualizado em tempo real',
    caption: 'Novos horários e alterações chegam por notificações internas e push no celular.',
    layout: 'split',
    assets: [
      path.join(rootDir, 'docs', 'mobile-prints', '06-equipe-comissoes.png'),
      'C:/Users/braia/Downloads/WhatsApp Image 2026-06-29 at 11.54.34.jpeg',
    ],
  },
  {
    duration: 5,
    eyebrow: 'CLIENTE',
    title: 'Agendar ficou natural',
    caption: 'O cliente escolhe barbearia, profissional, serviço e horário em poucos passos.',
    layout: 'split',
    assets: [
      path.join(rootDir, 'docs', 'mobile-prints', '04-home-cliente.png'),
      path.join(rootDir, 'docs', 'mobile-prints', '03-agendamento-cliente.png'),
    ],
  },
  {
    duration: 5,
    eyebrow: 'CLIENTE',
    title: 'Tudo acompanha o cliente',
    caption: 'Histórico, benefícios, barbearia principal e perfil sempre disponíveis no app.',
    layout: 'split',
    assets: [
      path.join(rootDir, 'docs', 'mobile-prints', '04-home-cliente.png'),
      path.join(rootDir, 'docs', 'screenshots', '14-portal-do-cliente.png'),
    ],
  },
  {
    duration: 4,
    eyebrow: 'WEB + PWA',
    title: 'Uma experiência em qualquer tela',
    caption: 'Instalável no iPhone, Android e computador, com a identidade BW Barber em cada detalhe.',
    layout: 'split',
    assets: [
      'C:/Users/braia/Downloads/WhatsApp Image 2026-06-25 at 19.03.48.jpeg',
      path.join(rootDir, 'docs', 'web-prints', '02-dashboard-web.png'),
    ],
  },
  {
    kind: 'cover',
    duration: 4,
    eyebrow: 'BW BARBER',
    title: 'Sua barbearia, pronta para o próximo nível.',
    caption: 'Operação profissional para quem cuida de cada detalhe.',
  },
]

function fileAsDataUrl(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Imagem não encontrada: ${filePath}`)
  }
  const extension = path.extname(filePath).toLowerCase()
  const mime = extension === '.svg' ? 'image/svg+xml' : extension === '.png' ? 'image/png' : 'image/jpeg'
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function sceneHtml(scene, index) {
  const logo = fileAsDataUrl(logoPath)
  const assets = (scene.assets ?? []).map(fileAsDataUrl)
  const cover = scene.kind === 'cover'
  const split = scene.layout === 'split'
  const media = assets.length
    ? split
      ? `<div class="phones">${assets
          .map(
            (asset, assetIndex) =>
              `<div class="phone phone-${assetIndex + 1}"><img src="${asset}" alt="" /></div>`,
          )
          .join('')}</div>`
      : `<div class="browser"><div class="browser-bar"><i></i><i></i><i></i><span>BW Barber</span></div><img src="${assets[0]}" alt="" /></div>`
    : ''

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        html, body { width: 1920px; height: 1080px; margin: 0; overflow: hidden; }
        body {
          font-family: Inter, "Segoe UI", Arial, sans-serif;
          color: #ffffff;
          background:
            radial-gradient(circle at 86% 18%, rgba(18,198,243,.14), transparent 28%),
            linear-gradient(135deg, #090f18 0%, #101820 55%, #0a111a 100%);
        }
        body::before {
          content: "";
          position: absolute;
          inset: 0;
          opacity: .11;
          background-image: linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: linear-gradient(to bottom, black, transparent 88%);
        }
        .frame { position: relative; width: 100%; height: 100%; padding: 72px 86px 58px; }
        .brand { display: flex; align-items: center; gap: 18px; position: relative; z-index: 3; }
        .brand img { width: 84px; height: 84px; object-fit: contain; }
        .brand-copy strong { display: block; font-size: 23px; letter-spacing: 4px; }
        .brand-copy span { color: #91a1b7; font-size: 15px; text-transform: uppercase; letter-spacing: 5px; }
        .copy { position: relative; z-index: 3; max-width: ${split ? '650px' : '1100px'}; margin-top: ${cover ? '158px' : '54px'}; }
        .eyebrow { color: #12c6f3; font-size: 18px; font-weight: 800; letter-spacing: 7px; text-transform: uppercase; }
        h1 { margin: 22px 0 18px; max-width: 1220px; font-size: ${cover ? '76px' : '58px'}; line-height: 1.02; letter-spacing: 0; }
        p { margin: 0; max-width: 920px; color: #aebbd0; font-size: ${cover ? '27px' : '23px'}; line-height: 1.48; }
        .accent { width: 96px; height: 7px; margin-top: 34px; border-radius: 8px; background: #12c6f3; box-shadow: 0 0 32px rgba(18,198,243,.48); }
        .browser { position: absolute; z-index: 2; left: 86px; right: 86px; bottom: 48px; height: 650px; overflow: hidden; border: 1px solid rgba(165,180,203,.25); border-radius: 20px; background: #071426; box-shadow: 0 34px 100px rgba(0,0,0,.48); }
        .browser-bar { height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 18px; color: #8492a7; background: #121b29; font-size: 13px; }
        .browser-bar i { width: 10px; height: 10px; border-radius: 50%; background: #344155; }
        .browser-bar span { margin-left: 10px; letter-spacing: 2px; }
        .browser > img { width: 100%; height: calc(100% - 44px); object-fit: cover; object-position: top center; }
        .phones { position: absolute; z-index: 2; right: 80px; top: 58px; width: 1020px; height: 960px; }
        .phone { position: absolute; width: 420px; height: 910px; overflow: hidden; border: 10px solid #202a39; border-radius: 50px; background: #071426; box-shadow: 0 38px 90px rgba(0,0,0,.55); }
        .phone::before { content: ""; position: absolute; z-index: 3; top: 12px; left: 50%; width: 116px; height: 26px; transform: translateX(-50%); border-radius: 22px; background: #05080d; }
        .phone img { width: 100%; height: 100%; object-fit: cover; object-position: top center; }
        .phone-1 { left: 60px; top: 34px; transform: rotate(-2.2deg); }
        .phone-2 { right: 64px; top: 8px; transform: rotate(2.4deg); }
        .counter { position: absolute; right: 86px; bottom: 28px; z-index: 4; color: #728299; font-size: 13px; letter-spacing: 4px; }
        .cover-layout { display: flex; height: calc(100% - 90px); align-items: center; justify-content: space-between; }
        .cover-mark { position: relative; width: 500px; height: 500px; display: grid; place-items: center; border: 1px solid rgba(18,198,243,.22); border-radius: 50%; }
        .cover-mark::before, .cover-mark::after { content: ""; position: absolute; border-radius: 50%; border: 1px solid rgba(18,198,243,.12); }
        .cover-mark::before { width: 390px; height: 390px; }
        .cover-mark::after { width: 610px; height: 610px; }
        .cover-mark img { width: 330px; height: 330px; object-fit: contain; filter: drop-shadow(0 0 34px rgba(18,198,243,.18)); }
      </style>
    </head>
    <body>
      <main class="frame">
        <div class="brand">
          <img src="${logo}" alt="BW Barber" />
          <div class="brand-copy"><strong>BW BARBER</strong><span>Sistema de gestão</span></div>
        </div>
        ${
          cover
            ? `<div class="cover-layout"><div class="copy"><div class="eyebrow">${escapeHtml(scene.eyebrow)}</div><h1>${escapeHtml(scene.title)}</h1><p>${escapeHtml(scene.caption)}</p><div class="accent"></div></div><div class="cover-mark"><img src="${logo}" alt="" /></div></div>`
            : `<div class="copy"><div class="eyebrow">${escapeHtml(scene.eyebrow)}</div><h1>${escapeHtml(scene.title)}</h1><p>${escapeHtml(scene.caption)}</p><div class="accent"></div></div>${media}`
        }
        <div class="counter">${String(index + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}</div>
      </main>
    </body>
  </html>`
}

function runFfmpeg(args, label) {
  const result = spawnSync(ffmpegPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (result.status !== 0) {
    throw new Error(`${label} falhou:\n${result.stderr}`)
  }
}

fs.mkdirSync(framesDir, { recursive: true })
fs.mkdirSync(segmentsDir, { recursive: true })

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
page.setDefaultNavigationTimeout(0)
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })

for (const [index, scene] of scenes.entries()) {
  const framePath = path.join(framesDir, `${String(index + 1).padStart(2, '0')}.png`)
  await page.setContent(sceneHtml(scene, index), { waitUntil: 'domcontentloaded', timeout: 0 })
  await Promise.race([
    page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images, (image) =>
          image.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                image.addEventListener('load', resolve, { once: true })
                image.addEventListener('error', resolve, { once: true })
              }),
        ),
      )
    }),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ])
  await page.screenshot({ path: framePath, type: 'png' })
}

await browser.close()

for (const [index, scene] of scenes.entries()) {
  const number = String(index + 1).padStart(2, '0')
  const framePath = path.join(framesDir, `${number}.png`)
  const segmentPath = path.join(segmentsDir, `${number}.mp4`)
  const fadeOutStart = Math.max(0, scene.duration - 0.35).toFixed(2)
  const frames = Math.round(scene.duration * 30)
  const movement = index % 2 === 0 ? 'min(zoom+0.00018,1.025)' : 'min(zoom+0.00014,1.020)'
  const filter = [
    `zoompan=z='${movement}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=30`,
    'fade=t=in:st=0:d=0.35',
    `fade=t=out:st=${fadeOutStart}:d=0.35`,
    'format=yuv420p',
  ].join(',')

  runFfmpeg(
    [
      '-y',
      '-loop',
      '1',
      '-i',
      framePath,
      '-t',
      String(scene.duration),
      '-vf',
      filter,
      '-r',
      '30',
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '16',
      '-movflags',
      '+faststart',
      segmentPath,
    ],
    `Renderização da cena ${number}`,
  )
}

const concatPath = path.join(outputDir, 'segments.txt')
fs.writeFileSync(
  concatPath,
  scenes
    .map((_, index) => `file '${path.join(segmentsDir, `${String(index + 1).padStart(2, '0')}.mp4`).replaceAll('\\', '/')}'`)
    .join('\n'),
)

runFfmpeg(
  [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatPath,
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    outputPath,
  ],
  'Montagem do vídeo final',
)

console.log(outputPath)
