import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { DasRow, Transaction, getConfig } from './db'
import { calcularDasComAtraso } from './das'
import { SimulacaoIRPF } from './irpf'

function getPerfil() {
  const cnpjRaw = getConfig('cnpj') ?? ''
  const d = cnpjRaw.replace(/\D/g, '')
  const cnpjFmt = d.length === 14
    ? `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
    : d
  return {
    razaoSocial: getConfig('razaoSocial') ?? '',
    nomeFantasia: getConfig('nomeFantasia') ?? '',
    cnpj: cnpjFmt,
    telefone: getConfig('telefone') ?? '',
    logradouro: getConfig('logradouro') ?? '',
    numero: getConfig('numero') ?? '',
    complemento: getConfig('complemento') ?? '',
    bairro: getConfig('bairro') ?? '',
    cidade: getConfig('cidade') ?? '',
    uf: getConfig('uf') ?? '',
    cep: (() => { const c = (getConfig('cep') ?? '').replace(/\D/g,''); return c.length === 8 ? `${c.slice(0,5)}-${c.slice(5)}` : c })(),
  }
}

function perfilHeader(p: ReturnType<typeof getPerfil>): string {
  const linhas: string[] = []
  if (p.razaoSocial) linhas.push(`<strong>${p.razaoSocial}</strong>`)
  if (p.nomeFantasia && p.nomeFantasia !== p.razaoSocial) linhas.push(p.nomeFantasia)
  if (p.cnpj) linhas.push(`CNPJ: ${p.cnpj}`)
  const end = [p.logradouro, p.numero, p.complemento].filter(Boolean).join(', ')
  const cidadeUf = [p.bairro, p.cidade, p.uf].filter(Boolean).join(' — ')
  if (end) linhas.push(end + (p.cep ? ` — CEP ${p.cep}` : ''))
  if (cidadeUf) linhas.push(cidadeUf)
  if (p.telefone) linhas.push(`Tel: ${p.telefone}`)
  return linhas.map(l => `<p style="font-size:11px; color:#444; margin:1px 0;">${l}</p>`).join('')
}

const A4_BASE = `
  @page { size: A4 portrait; margin: 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; background: #fff; }
  h1 { font-size: 16px; font-weight: 700; color: #111; margin-bottom: 2px; }
  p { font-size: 11px; color: #555; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #7C3AED; }
  .badge { background: #7C3AED; color: #fff; border-radius: 4px; padding: 3px 10px; font-size: 10px; font-weight: 600; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  thead th { background: #7C3AED; color: #fff; padding: 7px 8px; text-align: left; font-size: 11px; }
  tbody tr:nth-child(even) { background: #F5F3FF; }
  tbody td { padding: 6px 8px; border-bottom: 1px solid #E5E7EB; font-size: 11px; }
  .total-row td { font-weight: 700; background: #EDE9FE; }
  .status-pago { color: #16A34A; font-weight: 600; }
  .status-pendente { color: #D97706; font-weight: 600; }
  .status-atrasado { color: #DC2626; font-weight: 600; }
  .footer { margin-top: 24px; text-align: right; font-size: 10px; color: #9CA3AF; }
`

function buildHtml(title: string, subtitle: string, body: string): string {
  const geradoEm = new Date().toLocaleString('pt-BR')
  const perfil = getPerfil()
  const headerPerfil = perfilHeader(perfil)
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>${A4_BASE}</style></head>
<body>
  <div class="header">
    <div>
      ${headerPerfil || '<h1>SismeiPro</h1>'}
      <p style="font-size:13px; font-weight:600; color:#333; margin-top:6px;">${title}</p>
      <p style="font-size:11px; color:#777;">${subtitle}</p>
    </div>
    <span class="badge">PRO</span>
  </div>
  ${body}
  <div class="footer">Gerado em ${geradoEm} · SismeiPro</div>
</body>
</html>`
}

async function share(html: string, filename: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, base64: false })
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Compartilhar ${filename}`,
    UTI: 'com.adobe.pdf',
  })
}

export async function exportDasPDF(das: DasRow[]): Promise<void> {
  const hoje = new Date().toISOString().slice(0, 10)
  const rows = das.map(d => {
    const calc = calcularDasComAtraso(d.valor, d.vencimento)
    let statusLabel = ''
    let statusClass = ''
    if (d.pago) {
      statusLabel = '✓ Pago'; statusClass = 'status-pago'
    } else if (calc.diasAtraso > 0) {
      statusLabel = `Atrasado ${calc.diasAtraso}d`; statusClass = 'status-atrasado'
    } else {
      statusLabel = 'Pendente'; statusClass = 'status-pendente'
    }
    const totalExibir = d.pago ? d.valor : calc.total
    return `<tr>
      <td>${d.competencia}</td>
      <td>${d.vencimento}</td>
      <td>R$ ${d.valor.toFixed(2).replace('.', ',')}</td>
      <td>R$ ${totalExibir.toFixed(2).replace('.', ',')}</td>
      <td class="${statusClass}">${statusLabel}</td>
    </tr>`
  }).join('')

  const body = `<table>
    <thead><tr><th>Competência</th><th>Vencimento</th><th>Valor Original</th><th>Total c/ Encargos</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`

  await share(buildHtml('Extrato DAS', `Gerado em ${hoje} · ${das.length} registro(s)`, body), 'Extrato-DAS.pdf')
}

export async function exportFinanceiroPDF(transactions: Transaction[], mesAno: string): Promise<void> {
  const receitas = transactions.filter(t => t.type === 'receita')
  const despesas = transactions.filter(t => t.type === 'despesa')
  const totalReceitas = receitas.reduce((s, t) => s + t.valor, 0)
  const totalDespesas = despesas.reduce((s, t) => s + t.valor, 0)
  const saldo = totalReceitas - totalDespesas

  const toRow = (t: Transaction) => `<tr>
    <td>${t.data}</td>
    <td>${t.descricao}</td>
    <td>${t.categoria}</td>
    <td style="color:${t.type === 'receita' ? '#16A34A' : '#DC2626'}">
      ${t.type === 'receita' ? '+' : '-'} R$ ${t.valor.toFixed(2).replace('.', ',')}
    </td>
  </tr>`

  const body = `
    <div style="display:flex; gap:24px; margin-bottom:16px;">
      <div style="background:#F0FDF4; border-radius:6px; padding:10px 16px; flex:1;">
        <p style="color:#16A34A; font-weight:700;">Receitas</p>
        <p style="font-size:16px; font-weight:700;">R$ ${totalReceitas.toFixed(2).replace('.', ',')}</p>
      </div>
      <div style="background:#FEF2F2; border-radius:6px; padding:10px 16px; flex:1;">
        <p style="color:#DC2626; font-weight:700;">Despesas</p>
        <p style="font-size:16px; font-weight:700;">R$ ${totalDespesas.toFixed(2).replace('.', ',')}</p>
      </div>
      <div style="background:#EDE9FE; border-radius:6px; padding:10px 16px; flex:1;">
        <p style="color:#7C3AED; font-weight:700;">Saldo</p>
        <p style="font-size:16px; font-weight:700; color:${saldo >= 0 ? '#16A34A' : '#DC2626'}">
          R$ ${saldo.toFixed(2).replace('.', ',')}
        </p>
      </div>
    </div>
    <table>
      <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr></thead>
      <tbody>
        ${transactions.map(toRow).join('')}
        <tr class="total-row">
          <td colspan="3">Saldo do período</td>
          <td style="color:${saldo >= 0 ? '#16A34A' : '#DC2626'}">R$ ${saldo.toFixed(2).replace('.', ',')}</td>
        </tr>
      </tbody>
    </table>`

  await share(buildHtml('Extrato Financeiro', `Período: ${mesAno} · ${transactions.length} lançamento(s)`, body), `Financeiro-${mesAno}.pdf`)
}

export async function exportIRPFPDF(sim: SimulacaoIRPF, atividadeLabel: string, atividadePct: number): Promise<void> {
  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const pctIsento = ((1 - atividadePct) * 100).toFixed(0)
  const pctTrib = (atividadePct * 100).toFixed(0)

  const rows: [string, string, boolean?, string?][] = [
    ['Atividade', atividadeLabel],
    [`Rendimento isento (${pctIsento}%)`, fmt(sim.rendimentoIsento), false, '#16A34A'],
    [`Rendimento tributável (${pctTrib}%)`, fmt(sim.rendimentoTributavel)],
    ['(-) DAS pago', fmt(sim.dasPago), false, '#6B7280'],
    ['Base de cálculo', fmt(sim.baseCalculo), true],
    ['Imposto estimado', fmt(sim.impostoDue), true, sim.impostoDue > 0 ? '#DC2626' : '#16A34A'],
    ['Alíquota efetiva', `${sim.aliquotaEfetiva.toFixed(2)}%`, false, '#6B7280'],
  ]

  const tableRows = rows.map(([label, value, bold, color]) =>
    `<tr style="${bold ? 'background:#EDE9FE;' : ''}">
      <td style="font-weight:${bold ? '700' : 'normal'}">${label}</td>
      <td style="text-align:right; font-weight:${bold ? '700' : 'normal'}; color:${color ?? '#111'}">${value}</td>
    </tr>`
  ).join('')

  const isentoBox = sim.impostoDue === 0
    ? `<div style="background:#F0FDF4; border-radius:6px; padding:12px; margin-top:16px; text-align:center;">
        <p style="color:#16A34A; font-weight:700; font-size:14px;">✅ Isento de IRPF</p>
        <p style="color:#166534; font-size:12px; margin-top:4px;">Com base nos dados informados.</p>
       </div>`
    : ''

  const body = `
    <div style="background:#FFFBEB; border-radius:6px; padding:10px 14px; margin-bottom:16px; border-left:3px solid #D97706;">
      <p style="font-size:11px; color:#92400E;">⚠️ Estimativa de IRPF para MEI — lucro presumido. A declaração real pode variar. Consulte um contador.</p>
    </div>
    <table>
      <thead><tr><th>Item</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>
        <tr><td>Receita bruta</td><td style="text-align:right; font-weight:700">${fmt(sim.receitaBruta)}</td></tr>
        ${tableRows}
      </tbody>
    </table>
    ${isentoBox}`

  await share(buildHtml('Simulação IRPF', `Gerado em ${new Date().toLocaleDateString('pt-BR')}`, body), 'Simulacao-IRPF.pdf')
}
