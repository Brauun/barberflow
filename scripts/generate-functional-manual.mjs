import fs from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'

const rootDir = process.cwd()
const docsDir = path.join(rootDir, 'docs')
const markdownPath = path.join(docsDir, 'bw-barber-manual-funcionalidades.md')
const pdfPath = path.join(docsDir, 'bw-barber-manual-funcionalidades.pdf')

fs.mkdirSync(docsDir, { recursive: true })

const modules = [
  {
    id: 'autenticacao',
    title: 'Autenticação e controle de acesso',
    purpose:
      'Controla login, cadastro, sessão persistente, perfis de barbearia/cliente e permissões por papel no sistema.',
    access:
      'Administrador, gerente, barbeiro, recepção e cliente. Cada papel possui permissões centralizadas em src/auth/permissions.ts.',
    features: [
      'Login com e-mail ou telefone e senha usando Supabase Auth.',
      'Cadastro de barbearia com criação de empresa, usuário administrador e assinatura em trial.',
      'Cadastro de cliente com perfil próprio na tabela profiles.',
      'Recuperação de senha por e-mail.',
      'Proteção de rotas para painel da barbearia e portal do cliente.',
      'Convite de funcionário com aceite seguro e definição da própria senha.',
      'Sessão persistente com refresh automático de token.',
    ],
    integrations: [
      'Supabase Auth',
      'usuarios',
      'profiles',
      'empresas',
      'employees',
      'employee_invitations',
      'barbershop_employee_links',
    ],
    rules: [
      'Administrador gerencia tudo da própria empresa.',
      'Gerente gerencia operação, equipe e financeiro permitido.',
      'Barbeiro atua em agenda/atendimentos permitidos, sem criar serviços.',
      'Recepção acessa clientes, agenda e agendamentos sem financeiro completo.',
      'Cliente acessa apenas seus dados e seus agendamentos.',
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    purpose:
      'Apresenta visão executiva da barbearia com métricas de faturamento, atendimentos, clientes e receita.',
    access: 'Administrador, gerente, barbeiro e recepção conforme rota protegida da barbearia.',
    features: [
      'Cards de receita, atendimentos, ticket médio, lucro e indicadores mensais.',
      'Gráfico Fluxo de Receita dos últimos seis meses.',
      'Serviços populares e últimos atendimentos.',
      'Alertas de contas a pagar próximas do vencimento.',
      'Processamento de finalizações automáticas pendentes ao carregar.',
    ],
    integrations: [
      'dashboardService',
      'movimentacoes_financeiras',
      'comissoes',
      'atendimentos',
      'contas_pagar',
    ],
    rules: [
      'Receita considera movimentações confirmadas.',
      'Atendimentos concluídos automaticamente contam como concluídos.',
      'Contas pagas são refletidas como saídas quando ainda não existe movimentação equivalente.',
      'Dados são sempre filtrados por empresa_id.',
    ],
  },
  {
    id: 'clientes',
    title: 'Clientes',
    purpose:
      'Gerencia a base de clientes da empresa e consolida clientes originados de agendamentos online.',
    access: 'Administrador, gerente e recepção podem gerenciar. Cliente vê apenas seu próprio perfil no portal.',
    features: [
      'Listar, pesquisar, criar, editar e excluir clientes.',
      'Exibir telefone, e-mail, última visita, total gasto e número de visitas.',
      'Sincronizar clientes vindos de appointments/profiles quando há agendamento.',
      'Histórico de atendimentos por cliente.',
    ],
    integrations: ['clientesService', 'clientes', 'appointments', 'profiles', 'atendimentos'],
    rules: [
      'Cliente online com appointment pode aparecer na base da empresa.',
      'Telefone é tratado com máscara na UI e normalizado para dígitos.',
      'Histórico financeiro considera atendimentos concluídos e concluídos automaticamente.',
    ],
  },
  {
    id: 'barbeiros',
    title: 'Barbeiros e funcionários',
    purpose:
      'Controla funcionários vinculados à barbearia, papéis, comissões, convites e performance.',
    access: 'Administrador e gerente convidam/gerenciam. Barbeiro acessa apenas suas permissões operacionais.',
    features: [
      'Listar funcionários ativos e convites.',
      'Convidar funcionário por e-mail sem criar senha manualmente.',
      'Aceitar convite e vincular conta à barbearia.',
      'Editar dados de comissão e vínculo.',
      'Inativar funcionário preservando histórico.',
      'Controlar indisponibilidades por data, horário e motivo.',
      'Indicadores de atendimentos, faturamento e comissão acumulada.',
    ],
    integrations: [
      'employeesService',
      'barbeirosService',
      'barberUnavailabilityService',
      'employees',
      'barbeiros',
      'barbershop_employee_links',
      'employee_invitations',
      'barber_unavailability',
      'comissoes',
    ],
    rules: [
      'Funcionário não é excluído fisicamente; saída usa status inativo.',
      'Histórico financeiro, comissões e atendimentos antigos permanecem vinculados.',
      'Novos serviços criados pelo administrador são vinculados automaticamente aos barbeiros ativos.',
      'Funcionário inativo não deve receber novos agendamentos.',
    ],
  },
  {
    id: 'servicos',
    title: 'Serviços',
    purpose:
      'Mantém o catálogo de serviços da barbearia com preço, duração, comissão e disponibilidade por barbeiro.',
    access: 'Somente administrador cria, edita, inativa e vincula. Barbeiro e cliente apenas visualizam/selecionam.',
    features: [
      'Criar, editar, pesquisar e inativar serviços.',
      'Definir nome, categoria, descrição, preço, duração e comissão padrão.',
      'Vincular serviços aos barbeiros que executam.',
      'Vinculação automática de novo serviço a todos os barbeiros ativos.',
    ],
    integrations: ['servicosService', 'servicos', 'barber_services', 'barbeiros', 'clientService'],
    rules: [
      'Serviços pertencem à barbearia, não ao barbeiro.',
      'Barbeiro não cria, edita, exclui, altera preço ou duração.',
      'Serviço inativado preserva histórico.',
      'Cliente só agenda serviços vinculados ao barbeiro escolhido.',
    ],
  },
  {
    id: 'atendimentos',
    title: 'Atendimentos e agenda',
    purpose:
      'Registra atendimentos, agenda diária, status, remarcação, cancelamento, lista de espera e finalização financeira.',
    access: 'Administrador, gerente, barbeiro e recepção. Cliente gerencia seus próprios agendamentos no portal.',
    features: [
      'Registrar atendimento manual com cliente, barbeiro, serviço, data, hora, valor e forma de pagamento.',
      'Consultar atendimentos do dia por data, barbeiro e status.',
      'Alterar status: agendado, confirmado, em atendimento, finalização pendente, concluído, concluído automático, não compareceu, cancelado e remarcado.',
      'Remarcar e cancelar horários preservando histórico.',
      'Gerar entrada financeira e comissão ao concluir.',
      'Finalizar automaticamente atendimentos esquecidos após prazo configurável.',
      'Lista de espera com aviso de vaga liberada.',
    ],
    integrations: [
      'atendimentosService',
      'clientService',
      'appointments',
      'appointment_items',
      'appointment_status_logs',
      'movimentacoes_financeiras',
      'comissoes',
      'appointment_waitlist',
      'notifications',
    ],
    rules: [
      'Cancelados, remarcados e não compareceu não contam como receita ativa.',
      'Conclusão manual e automática usam fluxo transacional para evitar duplicidade financeira.',
      'Se não houver ação manual após o fim do atendimento, o status vira finalização pendente e depois concluído automático.',
      'Correção de conclusão automática pode marcar como concluído ou não compareceu dentro do prazo configurado.',
      'Ao cancelar, o horário é liberado e a lista de espera pode ser notificada.',
    ],
  },
  {
    id: 'produtos',
    title: 'Produtos',
    purpose:
      'Controla produtos, estoque, entradas, vendas e baixa automática de estoque.',
    access: 'Administrador e gerente gerenciam. Outros papéis podem ter visualização conforme rota protegida.',
    features: [
      'Cadastrar, editar, excluir e pesquisar produtos.',
      'Registrar entrada de estoque.',
      'Registrar venda de produto.',
      'Baixa automática de estoque na venda.',
      'Alertas visuais de estoque baixo.',
    ],
    integrations: ['produtosService', 'produtos', 'vendas_produtos', 'movimentacoes_financeiras'],
    rules: [
      'Venda de produto gera entrada no caixa da empresa.',
      'Produto não gera comissão para barbeiro.',
      'Estoque deve ser suficiente para venda.',
    ],
  },
  {
    id: 'planos-fidelidade',
    title: 'Planos e Fidelidade',
    purpose:
      'Permite que a barbearia crie programas próprios de benefício, pacotes, clube, cashback, cupons e fidelidade.',
    access: 'Disponível conforme feature HAS_LOYALTY. Administração configura; uso aparece nos atendimentos.',
    features: [
      'Criar programas ativos/inativos com nome, descrição, valor e validade.',
      'Configurar regras por quantidade, valor gasto, serviço específico, período ou manual.',
      'Configurar recompensas como serviço grátis, desconto, crédito, brinde ou manual.',
      'Vincular a todos os clientes, clientes específicos, todos os serviços ou serviços/categorias específicos.',
      'Acompanhar participantes e histórico de uso.',
    ],
    integrations: [
      'benefitsService',
      'benefit_programs',
      'benefit_rules',
      'benefit_rewards',
      'client_benefits',
      'benefit_usage_logs',
      'servicos',
      'clientes',
    ],
    rules: [
      'Programa pode ser acumulável ou não.',
      'Uso de benefício não deve duplicar receita.',
      'Descontos e impacto financeiro devem aparecer nos relatórios.',
    ],
  },
  {
    id: 'fluxo-caixa',
    title: 'Fluxo de Caixa',
    purpose:
      'Centraliza entradas, saídas, saldo atual e lucro líquido por período.',
    access: 'Administrador e gerente visualizam/gerenciam conforme canViewFinance/canManageFinance.',
    features: [
      'Listar movimentações financeiras por período.',
      'Cadastrar entrada ou saída manual.',
      'Exibir total de entradas, total de saídas, saldo e lucro líquido.',
      'Incluir contas pagas como saídas sintéticas quando necessário.',
    ],
    integrations: ['fluxoCaixaService', 'movimentacoes_financeiras', 'contas_pagar', 'atendimentos', 'produtos'],
    rules: [
      'Movimentações canceladas não entram nos totais.',
      'Atendimento concluído gera entrada automaticamente.',
      'Conta paga é refletida como saída sem duplicar lançamento existente.',
    ],
  },
  {
    id: 'contas-pagar',
    title: 'Contas a Pagar',
    purpose:
      'Organiza despesas, vencimentos, pagamentos e status de contas da barbearia.',
    access: 'Administrador e gerente.',
    features: [
      'Cadastrar, editar, excluir e filtrar contas por status.',
      'Marcar conta como paga por RPC segura.',
      'Exibir pendente, pago, vencido e cancelado.',
      'Alertar contas próximas do vencimento no dashboard.',
    ],
    integrations: ['contasPagarService', 'contas_pagar', 'movimentacoes_financeiras', 'dashboardService'],
    rules: [
      'Conta paga alimenta fluxo de caixa e relatórios como saída.',
      'Dados são filtrados por empresa_id.',
      'Exclusão/alteração respeita status e vínculo da empresa.',
    ],
  },
  {
    id: 'relatorios',
    title: 'Relatórios operacionais e executivos',
    purpose:
      'Gera análises financeiras, operacionais e executivas para tomada de decisão.',
    access:
      'Administrador e gerente. Relatórios executivos dependem de feature HAS_EXECUTIVE_REPORTS/BW Pro ou superior.',
    features: [
      'Filtros por tipo de relatório e período.',
      'Relatórios diário, mensal, anual, por barbeiro, financeiro e produtos.',
      'Exportação PDF e Excel.',
      'Relatórios executivos com score da operação, financeiro, equipe, clientes, agenda, produtos e previsões.',
      'KPIs de receita de serviços, produtos, despesas, lucro, comissões e ticket médio.',
    ],
    integrations: [
      'relatoriosService',
      'movimentacoes_financeiras',
      'comissoes',
      'vendas_produtos',
      'atendimentos',
      'clientes',
      'produtos',
      'subscriptionsService',
    ],
    rules: [
      'Receita considera concluído e concluído automático.',
      'Cancelados, remarcados, não compareceu e pendentes não contam como receita.',
      'PDF executivo é sempre gerado em layout claro/profissional.',
      'Relatórios avançados podem ser bloqueados por plano.',
    ],
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    purpose:
      'Parametriza empresa, perfil, tema, localização, horários, automações, backup e auditoria.',
    access: 'Administrador gerencia configurações e exportações. Usuário pode editar seu perfil quando permitido.',
    features: [
      'Editar dados da empresa, telefone, e-mail, endereço, logo e comissão padrão.',
      'Buscar cidade/estado por CEP.',
      'Alternar tema claro, escuro ou sistema.',
      'Editar avatar e perfil do usuário.',
      'Configurar horários de funcionamento por dia da semana.',
      'Configurar finalização automática de atendimentos.',
      'Exportar clientes, financeiro, atendimentos, produtos e dados completos.',
      'Visualizar auditoria de ações sensíveis.',
    ],
    integrations: [
      'configuracoesService',
      'businessHoursService',
      'backupService',
      'observabilityService',
      'assetsService',
      'cepService',
      'empresas',
      'barbershops',
      'configuracoes',
      'audit_logs',
      'Supabase Storage',
    ],
    rules: [
      'Apenas administrador exporta dados.',
      'Logo e avatar usam buckets dedicados.',
      'Horários inválidos não devem liberar agenda do cliente.',
      'Finalização automática padrão recomendada: 1 hora após fim.',
    ],
  },
  {
    id: 'assinatura',
    title: 'Assinatura',
    purpose:
      'Controla planos internos, trial, recursos disponíveis e limites por plano.',
    access: 'Administrador e gerente visualizam/gerenciam assinatura.',
    features: [
      'Exibir plano atual, status da assinatura e dias restantes do trial.',
      'Listar recursos disponíveis e consumo.',
      'Escolher plano internamente para testes.',
      'Comparar BW Start, BW Pro e BW Elite.',
      'Bloquear funcionalidades por feature quando necessário.',
    ],
    integrations: [
      'subscriptionsService',
      'plans',
      'subscriptions',
      'subscription_features',
      'subscription_usage',
      'useSubscription',
      'useFeatureAccess',
    ],
    rules: [
      'Nova barbearia inicia em TRIAL por 14 dias.',
      'Durante trial libera funcionalidades equivalentes ao BW Pro.',
      'BW Elite pode ser exibido como indisponível/bloqueado se definido pela UI.',
      'Sem schema de assinatura, o frontend usa fallback para não quebrar operação.',
    ],
  },
  {
    id: 'portal-cliente',
    title: 'Portal do Cliente',
    purpose:
      'Entrega experiência self-service para descobrir barbearias, escolher principal, agendar e acompanhar histórico.',
    access: 'Cliente autenticado.',
    features: [
      'Tela inicial com barbearia principal, próximo horário e histórico.',
      'Busca de barbearias por nome/endereço e favoritos.',
      'Favoritar/desfavoritar barbearias.',
      'Definir barbearia principal.',
      'Ver rota para endereço da barbearia.',
      'Agendar serviço escolhendo barbeiro, serviço, data e horário disponível.',
      'Cancelar/remarcar agendamentos próprios.',
      'Editar perfil e foto do cliente.',
    ],
    integrations: [
      'clientService',
      'profiles',
      'barbershops',
      'client_barbershop',
      'client_favorite_barbershops',
      'appointments',
      'appointment_items',
      'barber_services',
      'barbershop_business_hours',
    ],
    rules: [
      'Cliente vê apenas próprios agendamentos.',
      'Horários respeitam funcionamento da barbearia, duração do serviço, conflitos e indisponibilidades.',
      'Serviços exibidos dependem do barbeiro selecionado.',
      'Favoritos aparecem antes das demais barbearias.',
    ],
  },
  {
    id: 'notificacoes',
    title: 'Notificações',
    purpose:
      'Informa administradores e barbeiros sobre eventos relevantes dentro do app/web/PWA.',
    access: 'Administrador e gerente veem notificações gerais da empresa; barbeiro vê as destinadas a ele.',
    features: [
      'Sino no header com contador de não lidas.',
      'Painel de notificações com título, mensagem e horário.',
      'Marcar uma ou todas como lidas.',
      'Criar notificações para agendamento criado, cancelado, remarcado, lista de espera, vaga liberada e finalização pendente.',
    ],
    integrations: ['notificationsService', 'notifications', 'appointments', 'appointment_waitlist'],
    rules: [
      'Notificações são filtradas por empresa_id.',
      'Admin/gerente veem notificações amplas.',
      'Barbeiro sem usuário vinculado não recebe notificação individual; administradores ainda são notificados.',
      'Eventos externos de WhatsApp ficam preparados em notification_logs quando aplicável.',
    ],
  },
]

function anchor(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function buildMarkdown() {
  const lines = [
    '# BW Barber — Manual de Funcionalidades',
    '',
    '**Versão:** 1.0  ',
    `**Data:** ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())}`,
    '',
    'Este documento descreve os módulos funcionais do BW Barber com base no código-fonte React, serviços Supabase, tipos TypeScript e permissões por papel.',
    '',
    '## Sumário',
    '',
    ...modules.map((module, index) => `${index + 1}. [${module.title}](#${anchor(module.title)})`),
    '',
  ]

  modules.forEach((module) => {
    lines.push(`## ${module.title}`, '')
    lines.push(`### Nome e propósito`, module.purpose, '')
    lines.push(`### Quem pode acessar`, module.access, '')
    lines.push('### Funcionalidades detalhadas', ...module.features.map((item) => `- ${item}`), '')
    lines.push('### Integrações', ...module.integrations.map((item) => `- ${item}`), '')
    lines.push('### Regras de negócio', ...module.rules.map((item) => `- ${item}`), '')
  })

  lines.push(
    '## Matriz resumida de permissões',
    '',
    '| Ação | Administrador | Gerente | Barbeiro | Recepção | Cliente |',
    '| --- | --- | --- | --- | --- | --- |',
    '| Gerenciar serviços | Sim | Não | Não | Não | Visualiza disponíveis |',
    '| Ver financeiro | Sim | Sim | Não | Não | Não |',
    '| Gerenciar financeiro | Sim | Sim | Não | Não | Não |',
    '| Convidar funcionários | Sim | Sim | Não | Não | Não |',
    '| Exportar dados | Sim | Não | Não | Não | Não |',
    '| Gerenciar configurações | Sim | Não | Não | Não | Perfil próprio |',
    '| Gerenciar atendimentos | Sim | Sim | Sim | Sim | Próprios agendamentos |',
    '| Ver relatórios | Sim | Sim | Não | Não | Não |',
    '',
  )

  return lines.join('\n')
}

function addWrappedList(doc, items, x, y, width) {
  let cursor = y
  items.forEach((item) => {
    doc.fillColor('#0891b2').fontSize(9).text('•', x, cursor)
    doc.fillColor('#334155').fontSize(9).text(item, x + 12, cursor, {
      lineGap: 2,
      width: width - 12,
    })
    cursor = doc.y + 4
  })
  return cursor
}

function addSectionTitle(doc, title) {
  doc.moveDown(0.8)
  doc.fontSize(12).fillColor('#071426').text(title, { continued: false })
  doc.moveDown(0.25)
}

function ensureSpace(doc, needed = 120) {
  if (doc.y + needed > doc.page.height - 64) {
    doc.addPage()
  }
}

function generatePdf() {
  const doc = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    margins: { bottom: 56, left: 56, right: 56, top: 56 },
    size: 'A4',
  })
  doc.pipe(fs.createWriteStream(pdfPath))

  doc.addPage()
  doc.fontSize(28).fillColor('#071426').text('BW Barber', 56, 120)
  doc
    .fontSize(22)
    .fillColor('#0f172a')
    .text('Manual de Funcionalidades', 56, 158)
  doc
    .fontSize(11)
    .fillColor('#64748b')
    .text('Versão 1.0', 56, 205)
    .text(
      `Gerado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())}`,
      56,
      224,
    )
  doc
    .roundedRect(56, 288, 470, 74, 18)
    .fill('#e8fbff')
    .fillColor('#075985')
    .fontSize(12)
    .text(
      'Documento técnico-funcional para apoiar demonstração, treinamento, implantação e evolução do BW Barber.',
      78,
      314,
      { lineGap: 4, width: 420 },
    )

  doc.addPage()
  doc.fontSize(22).fillColor('#071426').text('Sumário navegável')
  doc.moveDown(0.8)
  modules.forEach((module, index) => {
    const destination = module.id
    doc
      .fontSize(10)
      .fillColor('#0f172a')
      .text(`${index + 1}. ${module.title}`, {
        goTo: destination,
        underline: true,
      })
    doc.moveDown(0.35)
  })

  modules.forEach((module, index) => {
    doc.addPage()
    doc.addNamedDestination(module.id)
    doc
      .fontSize(9)
      .fillColor('#0891b2')
      .text(`MÓDULO ${String(index + 1).padStart(2, '0')}`, { characterSpacing: 2 })
    doc.moveDown(0.4)
    doc.fontSize(22).fillColor('#071426').text(module.title)
    doc.moveDown(0.7)

    addSectionTitle(doc, 'Nome e propósito')
    doc.fontSize(10).fillColor('#334155').text(module.purpose, { lineGap: 3 })

    addSectionTitle(doc, 'Quem pode acessar')
    doc.fontSize(10).fillColor('#334155').text(module.access, { lineGap: 3 })

    ensureSpace(doc)
    addSectionTitle(doc, 'Funcionalidades detalhadas')
    doc.y = addWrappedList(doc, module.features, 62, doc.y, 480)

    ensureSpace(doc)
    addSectionTitle(doc, 'Integrações')
    doc.y = addWrappedList(doc, module.integrations, 62, doc.y, 480)

    ensureSpace(doc)
    addSectionTitle(doc, 'Regras de negócio')
    doc.y = addWrappedList(doc, module.rules, 62, doc.y, 480)
  })

  doc.addPage()
  doc.addNamedDestination('matriz-permissoes')
  doc.fontSize(22).fillColor('#071426').text('Matriz resumida de permissões')
  const rows = [
    ['Gerenciar serviços', 'Administrador'],
    ['Ver e gerenciar financeiro', 'Administrador, gerente'],
    ['Convidar funcionários', 'Administrador, gerente'],
    ['Exportar dados', 'Administrador'],
    ['Gerenciar configurações', 'Administrador'],
    ['Gerenciar atendimentos', 'Administrador, gerente, barbeiro, recepção'],
    ['Ver relatórios', 'Administrador, gerente'],
    ['Portal do cliente', 'Cliente autenticado'],
  ]
  doc.moveDown(1)
  rows.forEach(([action, roles]) => {
    doc
      .roundedRect(56, doc.y, 480, 34, 10)
      .fill('#f8fafc')
      .stroke('#e2e8f0')
    doc.fillColor('#071426').fontSize(10).text(action, 70, doc.y - 25, { width: 190 })
    doc.fillColor('#475569').fontSize(10).text(roles, 270, doc.y - 12, { width: 240 })
    doc.moveDown(1.1)
  })

  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i)
    doc
      .fontSize(8)
      .fillColor('#94a3b8')
      .text(`BW Barber — Manual de Funcionalidades • Página ${i + 1}`, 56, 812, {
        align: 'center',
        width: 484,
      })
  }

  doc.end()
}

const markdown = buildMarkdown()
fs.writeFileSync(markdownPath, markdown, 'utf8')
generatePdf()
console.info(`Manual Markdown gerado em: ${markdownPath}`)
console.info(`Manual PDF gerado em: ${pdfPath}`)
