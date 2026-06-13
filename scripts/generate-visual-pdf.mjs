import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import PDFDocument from 'pdfkit'
import puppeteer from 'puppeteer'

const rootDir = process.cwd()
const docsDir = path.join(rootDir, 'docs')
const screenshotsDir = path.join(docsDir, 'screenshots')
const outputPath = path.join(docsDir, 'bw-barber-apresentacao.pdf')
const logoPath = path.join(rootDir, 'public', 'brand', 'bw-barber-login-logo.png')

const appUrl = process.env.BW_BARBER_APP_URL || 'http://127.0.0.1:5173'
const loginEmail = process.env.BW_BARBER_TEST_EMAIL || ''
const loginPassword = process.env.BW_BARBER_TEST_PASSWORD || ''
const version = process.env.BW_BARBER_VERSION || '1.0'

const pages = [
  {
    path: '/login',
    title: 'Login',
    description:
      'Tela de acesso do BW Barber com autenticação para barbearias, funcionários e clientes. Mantém a identidade visual premium do sistema.',
  },
  {
    path: '/app/dashboard',
    title: 'Dashboard',
    description:
      'Visão executiva da operação com faturamento, atendimentos, ticket médio, gráfico de receita e serviços populares.',
  },
  {
    path: '/app/clientes',
    title: 'Clientes',
    description:
      'Base de clientes da empresa com cadastro, pesquisa, histórico de visitas, gasto total e integração com agendamentos online.',
  },
  {
    path: '/app/barbeiros',
    title: 'Equipe e comissões',
    description:
      'Gestão de funcionários por convite, vínculos com a barbearia, comissões e indicadores de desempenho por profissional.',
  },
  {
    path: '/app/servicos',
    title: 'Serviços',
    description:
      'Catálogo de serviços da barbearia com preço, duração, comissão padrão, status e vínculo automático com barbeiros ativos.',
  },
  {
    path: '/app/atendimentos',
    title: 'Atendimentos',
    description:
      'Agenda operacional com atendimentos do dia, status, remarcação, cancelamento, lista de espera e finalização financeira segura.',
  },
  {
    path: '/app/produtos',
    title: 'Produtos',
    description:
      'Controle de estoque, cadastro de produtos, entrada de estoque, venda e baixa automática sem gerar comissão ao barbeiro.',
  },
  {
    path: '/app/planos-fidelidade',
    title: 'Planos e Fidelidade',
    description:
      'Construtor de benefícios, planos, pacotes, regras de acúmulo, recompensas e histórico de uso por cliente.',
  },
  {
    path: '/app/fluxo-de-caixa',
    title: 'Fluxo de Caixa',
    description:
      'Lançamentos financeiros de entrada e saída, totais por período, lucro líquido e integração com contas pagas e atendimentos.',
  },
  {
    path: '/app/contas-a-pagar',
    title: 'Contas a Pagar',
    description:
      'Gestão de despesas, vencimentos, status de pagamento, alertas e reflexo automático no fluxo financeiro.',
  },
  {
    path: '/app/relatorios',
    title: 'Relatórios',
    description:
      'Relatórios operacionais por período com indicadores financeiros, produtos, barbeiros e exportação para PDF e Excel.',
  },
  {
    path: '/app/configuracoes',
    title: 'Configurações',
    description:
      'Parametrização da empresa, perfil, tema, horários de funcionamento, automação de atendimentos, backup e auditoria.',
  },
  {
    path: '/app/assinatura',
    title: 'Assinatura',
    description:
      'Controle de plano, trial, recursos disponíveis, limites de uso e escolha entre BW Start, BW Pro e BW Elite.',
  },
  {
    path: '/cliente',
    title: 'Portal do Cliente',
    description:
      'Experiência self-service para cliente acompanhar sua barbearia principal, agendar horário, ver histórico e favoritar barbearias.',
  },
]

fs.mkdirSync(screenshotsDir, { recursive: true })

function todayPtBr() {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
  }).format(new Date())
}

function safeName(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function tryLogin(page) {
  if (!loginEmail || !loginPassword) {
    return false
  }

  try {
    await page.goto(`${appUrl}/login`, { waitUntil: 'networkidle0', timeout: 30000 })
    const userSelector =
      'input[name="email"], input[name="identifier"], input[type="email"], input[type="text"]'
    const passwordSelector = 'input[name="password"], input[type="password"]'
    await page.waitForSelector(userSelector, { timeout: 8000 })
    await page.click(userSelector, { clickCount: 3 })
    await page.type(userSelector, loginEmail, { delay: 10 })
    await page.click(passwordSelector, { clickCount: 3 })
    await page.type(passwordSelector, loginPassword, { delay: 10 })
    await Promise.allSettled([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }),
      page.click('button[type="submit"], button'),
    ])

    return !page.url().includes('/login')
  } catch (error) {
    console.warn(`Login automático indisponível: ${error.message}`)
    return false
  }
}

async function renderMockScreenshot(page, item, index) {
  const metricLabels = [
    'Receita hoje',
    'Atendimentos',
    'Ticket médio',
    'Clientes ativos',
  ]
  const html = `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          width: 1440px;
          height: 900px;
          font-family: Inter, Arial, sans-serif;
          background: #f6f8fb;
          color: #071426;
        }
        .shell { display: grid; grid-template-columns: 240px 1fr; height: 100%; }
        .side {
          background: #fff;
          border-right: 1px solid #dfe7f0;
          padding: 28px 20px;
          display: flex;
          flex-direction: column;
          gap: 26px;
        }
        .brand { display:flex; align-items:center; gap:14px; }
        .brand img { width:56px; height:56px; object-fit:contain; border-radius:18px; background:#071426; }
        .brand strong { display:block; font-size:18px; }
        .brand span { color:#60708a; letter-spacing:3px; font-size:11px; font-weight:700; }
        .nav { display:grid; gap:10px; }
        .nav div { padding:13px 14px; border-radius:18px; color:#61728c; font-weight:700; }
        .nav div:nth-child(${(index % 8) + 1}) { background:#e9fbff; color:#008fb3; }
        .content { padding: 34px 44px; overflow:hidden; }
        .top { display:flex; justify-content:space-between; align-items:center; }
        .eyebrow { color:#00a8d6; letter-spacing:5px; font-size:12px; font-weight:900; text-transform:uppercase; }
        h1 { font-size:36px; margin:10px 0 8px; letter-spacing:-0.02em; }
        .sub { color:#52627a; font-size:16px; max-width:720px; line-height:1.6; }
        .search { width:300px; height:48px; border:1px solid #d9e3ee; border-radius:18px; background:#fff; }
        .cards { display:grid; grid-template-columns: repeat(4, 1fr); gap:18px; margin-top:34px; }
        .card {
          min-height:120px;
          background:#fff;
          border:1px solid #dce6f1;
          border-radius:24px;
          padding:24px;
          box-shadow:0 22px 80px rgba(15,23,42,.05);
        }
        .card p { margin:0 0 16px; color:#687994; font-size:14px; }
        .card strong { font-size:26px; }
        .main { display:grid; grid-template-columns: 1.35fr .85fr; gap:22px; margin-top:24px; }
        .panel {
          background:#fff;
          border:1px solid #dce6f1;
          border-radius:28px;
          padding:28px;
          min-height:360px;
          box-shadow:0 28px 90px rgba(15,23,42,.055);
        }
        .chart { height:220px; margin-top:35px; border-radius:22px; background:linear-gradient(180deg, rgba(18,198,243,.18), rgba(18,198,243,0)); border:1px solid #dce6f1; position:relative; overflow:hidden; }
        .chart:after { content:''; position:absolute; inset:42px 42px 48px; border-bottom:4px solid #12c6f3; border-right:4px solid #12c6f3; border-radius:0 80px 0 0; transform:skewX(-18deg); }
        .list { display:grid; gap:14px; margin-top:28px; }
        .row { min-height:62px; border:1px solid #dce6f1; border-radius:20px; background:#fafcff; padding:16px; display:flex; justify-content:space-between; align-items:center; }
        .pill { padding:7px 12px; border-radius:999px; background:#e9fbff; color:#008fb3; font-weight:800; font-size:12px; }
      </style>
    </head>
    <body>
      <div class="shell">
        <aside class="side">
          <div class="brand">
            <img src="file:///${logoPath.replaceAll('\\', '/')}" />
            <div><strong>BW Barber</strong><span>SAAS</span></div>
          </div>
          <div class="nav">
            ${pages.slice(1, 9).map((screen) => `<div>${screen.title}</div>`).join('')}
          </div>
        </aside>
        <main class="content">
          <div class="top">
            <div>
              <div class="eyebrow">${item.path}</div>
              <h1>${item.title}</h1>
              <div class="sub">${item.description}</div>
            </div>
            <div class="search"></div>
          </div>
          <section class="cards">
            ${metricLabels
              .map((label, metricIndex) => `<div class="card"><p>${label}</p><strong>${metricIndex === 0 ? 'R$ 8.420' : metricIndex === 1 ? '42' : metricIndex === 2 ? 'R$ 118' : '1.248'}</strong></div>`)
              .join('')}
          </section>
          <section class="main">
            <div class="panel">
              <div class="eyebrow">Visão operacional</div>
              <h1 style="font-size:26px">Resumo da tela</h1>
              <div class="chart"></div>
            </div>
            <div class="panel">
              <div class="eyebrow">Atividade</div>
              <div class="list">
                <div class="row"><strong>Cliente agendado</strong><span class="pill">Confirmado</span></div>
                <div class="row"><strong>Receita registrada</strong><span class="pill">R$ 120</span></div>
                <div class="row"><strong>Notificação interna</strong><span class="pill">Nova</span></div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </body>
  </html>`

  await page.setContent(html, { waitUntil: 'load' })
  return page.screenshot({
    path: path.join(screenshotsDir, `${String(index + 1).padStart(2, '0')}-${safeName(item.title)}.png`),
    fullPage: false,
  })
}

async function captureRealScreenshot(page, item, index) {
  await page.goto(`${appUrl}${item.path}`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((resolve) => setTimeout(resolve, 900))

  const isLoginAgain = item.path !== '/login' && page.url().includes('/login')
  if (isLoginAgain) {
    throw new Error('Sessão não autenticada para captura real.')
  }

  return page.screenshot({
    path: path.join(screenshotsDir, `${String(index + 1).padStart(2, '0')}-${safeName(item.title)}.png`),
    fullPage: false,
  })
}

function addFooter(doc, pageNumber) {
  const { width, height } = doc.page
  doc
    .fontSize(8)
    .fillColor('#64748b')
    .text(`BW Barber • Apresentação visual • Página ${pageNumber}`, 56, height - 36, {
      align: 'center',
      width: width - 112,
    })
}

function addHeader(doc, title) {
  doc
    .fontSize(10)
    .fillColor('#0891b2')
    .text('BW BARBER', 56, 34, { characterSpacing: 3 })
  doc.fontSize(10).fillColor('#334155').text(title, 650, 34, { align: 'right', width: 170 })
}

function generatePdf() {
  const doc = new PDFDocument({
    autoFirstPage: false,
    margins: { bottom: 56.7, left: 56.7, right: 56.7, top: 56.7 },
    layout: 'landscape',
    size: 'A4',
  })

  doc.pipe(fs.createWriteStream(outputPath))

  let pageNumber = 0
  const addPage = (title) => {
    doc.addPage()
    pageNumber += 1
    addHeader(doc, title)
    addFooter(doc, pageNumber)
  }

  addPage('Capa')
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 86, 92, { fit: [210, 150], align: 'center' })
  }
  doc
    .fontSize(42)
    .fillColor('#071426')
    .text('BW Barber', 330, 135, { width: 420 })
  doc
    .fontSize(17)
    .fillColor('#475569')
    .text('Sistema de gestão para barbearias', 334, 192, { width: 420 })
  doc
    .roundedRect(334, 238, 220, 40, 18)
    .fill('#e8fbff')
    .fillColor('#007fa3')
    .fontSize(12)
    .text(`Versão ${version} • ${todayPtBr()}`, 354, 251)
  doc
    .fontSize(12)
    .fillColor('#64748b')
    .text('Apresentação visual gerada automaticamente a partir do projeto BW Barber.', 86, 430, {
      width: 650,
    })

  addPage('Índice')
  doc.fontSize(28).fillColor('#071426').text('Índice de seções', 86, 96)
  pages.forEach((item, index) => {
    const y = 152 + index * 24
    doc.fontSize(12).fillColor('#0f172a').text(`${index + 1}. ${item.title}`, 92, y)
    doc.fontSize(10).fillColor('#64748b').text(item.path, 310, y)
  })

  pages.forEach((item, index) => {
    addPage(item.title)
    doc.fontSize(25).fillColor('#071426').text(item.title, 56.7, 66)
    doc.fontSize(10).fillColor('#0891b2').text(item.path, 56.7, 96, { characterSpacing: 2 })
    doc.fontSize(11).fillColor('#475569').text(item.description, 56.7, 116, {
      width: 720,
      lineGap: 3,
    })

    const imagePath = path.join(
      screenshotsDir,
      `${String(index + 1).padStart(2, '0')}-${safeName(item.title)}.png`,
    )

    if (fs.existsSync(imagePath)) {
      doc
        .roundedRect(56.7, 165, 728, 350, 18)
        .fill('#f8fafc')
        .stroke('#dbeafe')
      doc.image(imagePath, 70, 178, { fit: [700, 320], align: 'center', valign: 'center' })
    }
  })

  addPage('Contracapa')
  doc
    .fontSize(34)
    .fillColor('#071426')
    .text('BW Barber', 86, 150)
  doc
    .fontSize(15)
    .fillColor('#475569')
    .text('Gestão premium para barbearias, equipes e clientes.', 86, 205, {
      width: 520,
    })
  doc
    .fontSize(11)
    .fillColor('#64748b')
    .text('Contato comercial: personalize esta página com os canais oficiais da sua empresa.', 86, 300, {
      width: 520,
    })
  doc
    .roundedRect(86, 350, 260, 42, 20)
    .fill('#071426')
    .fillColor('#ffffff')
    .fontSize(13)
    .text('Gerado por BW Barber', 112, 364)

  doc.end()
}

async function main() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: {
      deviceScaleFactor: 2,
      height: 900,
      width: 1440,
    },
    headless: 'new',
  })
  const page = await browser.newPage()
  const loggedIn = await tryLogin(page)

  for (const [index, item] of pages.entries()) {
    try {
      if (loggedIn || item.path === '/login') {
        await captureRealScreenshot(page, item, index)
      } else {
        await renderMockScreenshot(page, item, index)
      }
    } catch (error) {
      console.warn(`Usando mock para ${item.title}: ${error.message}`)
      await renderMockScreenshot(page, item, index)
    }
  }

  await browser.close()
  generatePdf()
  console.info(`PDF visual gerado em: ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
