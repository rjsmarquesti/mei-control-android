import { useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, SafeAreaView, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { BarChart } from 'react-native-gifted-charts'
import { getTransactions, getDasList, getConfig } from '../../lib/db'
import { getSecure } from '../../lib/secure'
import { calcularDasComAtraso, valorDasMEI } from '../../lib/das'
import { getMeiConfig } from '../../lib/mei-config'
import { verificarAlerteLimiteMEI } from '../../lib/notifications'
import { COLORS, FONTS, RADIUS } from '../../constants/theme'

const { width } = Dimensions.get('window')

interface Kpis {
  receitas: number
  despesas: number
  saldo: number
  dasStatus: string
  dasStatusColor: string
  receitaAnual: number
  limitePct: number
  limiteAnual: number
}

interface Projecao {
  mediaMensal: number
  mesesParaLimite: number | null
  dataLimite: string | null
  retiradaSugerida: number
  lucroMes: number
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets()
  const [kpis, setKpis] = useState<Kpis>({ receitas: 0, despesas: 0, saldo: 0, dasStatus: '...', dasStatusColor: COLORS.textMuted, receitaAnual: 0, limitePct: 0, limiteAnual: getMeiConfig().limiteAnualMEI })
  const [grafico, setGrafico] = useState<{ label: string; receita: number; despesa: number }[]>([])
  const [alertas, setAlertas] = useState<string[]>([])
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [projecao, setProjecao] = useState<Projecao | null>(null)

  useFocusEffect(useCallback(() => { loadData() }, []))

  async function loadData() {
    setEmail((await getSecure('email')) ?? '')
    setNome(getConfig('razaoSocial') ?? getConfig('nomeFantasia') ?? '')
    const cnpjRaw = getConfig('cnpj') ?? ''
    const d = cnpjRaw.replace(/\D/g, '')
    setCnpj(d.length === 14
      ? `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
      : '')

    const hoje = new Date()
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

    const txMes = getTransactions(mesAtual)
    const receitas = txMes.filter(t => t.type === 'receita').reduce((s, t) => s + t.valor, 0)
    const despesas = txMes.filter(t => t.type === 'despesa').reduce((s, t) => s + t.valor, 0)

    const txAno = getTransactions(String(hoje.getFullYear()))
    const receitaAnual = txAno.filter(t => t.type === 'receita').reduce((s, t) => s + t.valor, 0)
    const limiteAnual = getMeiConfig().limiteAnualMEI
    const limitePct = Math.min(100, (receitaAnual / limiteAnual) * 100)

    const dasList = getDasList()
    const novosAlertas: string[] = []
    let dasStatus = '✅ Em dia'
    let dasStatusColor = COLORS.success

    for (const d of dasList.filter(d => !d.pago)) {
      const calc = calcularDasComAtraso(d.valor, d.vencimento)
      if (calc.diasAtraso > 0) {
        dasStatus = `⚠️ Atrasado (${d.competencia})`
        dasStatusColor = COLORS.danger
        novosAlertas.push(`DAS ${d.competencia} está ${calc.diasAtraso} dia(s) em atraso.`)
      } else {
        const dias = Math.floor((new Date(d.vencimento + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)
        if (dias <= 7) {
          novosAlertas.push(`DAS ${d.competencia} vence em ${dias} dia(s).`)
          if (dasStatusColor !== COLORS.danger) { dasStatus = `📅 Vence em ${dias}d`; dasStatusColor = COLORS.warning }
        }
      }
    }

    setAlertas(novosAlertas)
    setKpis({ receitas, despesas, saldo: receitas - despesas, dasStatus, dasStatusColor, receitaAnual, limitePct, limiteAnual })

    // Projeção de limite MEI
    const mesesDecorridos = hoje.getMonth() + 1
    const mediaMensal = mesesDecorridos > 0 && receitaAnual > 0 ? receitaAnual / mesesDecorridos : 0
    const receitaRestante = limiteAnual - receitaAnual
    let mesesParaLimite: number | null = null
    let dataLimite: string | null = null
    if (mediaMensal > 0 && receitaRestante > 0) {
      mesesParaLimite = Math.ceil(receitaRestante / mediaMensal)
      const dataProj = new Date(hoje.getFullYear(), hoje.getMonth() + mesesParaLimite, 1)
      dataLimite = `${String(dataProj.getMonth() + 1).padStart(2, '0')}/${dataProj.getFullYear()}`
    }

    // Calculadora de retirada
    const dasProvisao = valorDasMEI()
    const lucroMes = receitas - despesas
    const disponivelAposProvisao = lucroMes - dasProvisao
    const reserva = Math.max(0, disponivelAposProvisao * 0.20)
    const retiradaSugerida = Math.max(0, disponivelAposProvisao - reserva)

    setProjecao({ mediaMensal, mesesParaLimite, dataLimite, retiradaSugerida, lucroMes })

    // Alerta de limite MEI via notificação push
    verificarAlerteLimiteMEI(receitaAnual, limiteAnual).catch(() => {})

    // Gráfico: últimos 6 meses
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const dd = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const mesStr = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}`
      const txs = getTransactions(mesStr)
      meses.push({
        label: String(dd.getMonth() + 1).padStart(2, '0') + '/' + String(dd.getFullYear()).slice(2),
        receita: txs.filter(t => t.type === 'receita').reduce((s, t) => s + t.valor, 0),
        despesa: txs.filter(t => t.type === 'despesa').reduce((s, t) => s + t.valor, 0),
      })
    }
    setGrafico(meses)
  }

  const barData = grafico.flatMap(m => [
    { value: m.receita, label: m.label, frontColor: COLORS.success, spacing: 2, labelWidth: 40, labelTextStyle: { color: COLORS.textMuted, fontSize: 10 } },
    { value: m.despesa, frontColor: COLORS.danger, spacing: 14 },
  ])

  return (
    <SafeAreaView style={[s.safe, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 40 }]}>
        <Text style={s.greeting}>{nome ? `Olá, ${nome.split(' ')[0]}! 👋` : 'Olá, MEI! 👋'}</Text>
        {cnpj ? <Text style={s.cnpjText}>CNPJ: {cnpj}</Text> : null}
        {email ? <Text style={s.emailText}>{email}</Text> : null}

        {alertas.map((a, i) => (
          <View key={i} style={s.alerta}>
            <Text style={s.alertaText}>⚠️ {a}</Text>
          </View>
        ))}

        <Text style={s.sectionTitle}>Este mês</Text>
        <View style={s.kpiGrid}>
          <View style={[s.kpiCard, { borderLeftColor: COLORS.success }]}>
            <Text style={s.kpiLabel}>Receitas</Text>
            <Text style={[s.kpiVal, { color: COLORS.success }]}>R$ {kpis.receitas.toFixed(2).replace('.', ',')}</Text>
          </View>
          <View style={[s.kpiCard, { borderLeftColor: COLORS.danger }]}>
            <Text style={s.kpiLabel}>Despesas</Text>
            <Text style={[s.kpiVal, { color: COLORS.danger }]}>R$ {kpis.despesas.toFixed(2).replace('.', ',')}</Text>
          </View>
          <View style={[s.kpiCard, { borderLeftColor: COLORS.primary }]}>
            <Text style={s.kpiLabel}>Saldo</Text>
            <Text style={[s.kpiVal, { color: kpis.saldo >= 0 ? COLORS.primary : COLORS.danger }]}>
              R$ {kpis.saldo.toFixed(2).replace('.', ',')}
            </Text>
          </View>
          <View style={[s.kpiCard, { borderLeftColor: kpis.dasStatusColor }]}>
            <Text style={s.kpiLabel}>DAS</Text>
            <Text style={[s.kpiVal, { color: kpis.dasStatusColor, fontSize: 12 }]}>{kpis.dasStatus}</Text>
          </View>
        </View>

        {/* Calculadora de retirada */}
        {projecao && projecao.lucroMes > 0 && (
          <>
            <Text style={s.sectionTitle}>Retirada sugerida este mês</Text>
            <View style={s.retiradaCard}>
              <View style={s.retiradaRow}>
                <Text style={s.retiradaLabel}>Lucro bruto</Text>
                <Text style={s.retiradaVal}>R$ {projecao.lucroMes.toFixed(2).replace('.', ',')}</Text>
              </View>
              <View style={s.retiradaRow}>
                <Text style={s.retiradaLabel}>(-) Provisão DAS</Text>
                <Text style={[s.retiradaVal, { color: COLORS.textMuted }]}>- R$ {valorDasMEI().toFixed(2).replace('.', ',')}</Text>
              </View>
              <View style={[s.retiradaRow, { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 4, paddingTop: 8 }]}>
                <Text style={[s.retiradaLabel, { fontWeight: '700', color: COLORS.text }]}>Retirada segura (80%)</Text>
                <Text style={[s.retiradaVal, { color: COLORS.success, fontWeight: '700' }]}>R$ {projecao.retiradaSugerida.toFixed(2).replace('.', ',')}</Text>
              </View>
              <Text style={s.retiradaHint}>20% mantidos como reserva. Consulte um contador para planejamento personalizado.</Text>
            </View>
          </>
        )}

        <Text style={s.sectionTitle}>Limite anual MEI</Text>
        <View style={s.limiteCard}>
          <View style={s.limiteTopo}>
            <Text style={s.limiteLabel}>Receita {new Date().getFullYear()}</Text>
            <Text style={s.limitePct}>{kpis.limitePct.toFixed(1)}% usado</Text>
          </View>
          <View style={s.barBg}>
            <View style={[s.barFill, {
              width: `${kpis.limitePct}%` as `${number}%`,
              backgroundColor: kpis.limitePct >= 90 ? COLORS.danger : kpis.limitePct >= 75 ? COLORS.warning : COLORS.primary,
            }]} />
          </View>
          <Text style={s.limiteValores}>
            R$ {kpis.receitaAnual.toLocaleString('pt-BR')} de R$ {kpis.limiteAnual.toLocaleString('pt-BR')}
          </Text>
          {kpis.limitePct >= 80 && (
            <Text style={s.limiteAviso}>⚠️ Próximo do limite MEI! Considere regularizar sua situação.</Text>
          )}
        </View>

        {/* Projeção de limite */}
        {projecao && projecao.mediaMensal > 0 && (
          <View style={s.projecaoCard}>
            <Text style={s.projecaoTitle}>📈 Projeção de limite</Text>
            <Text style={s.projecaoSub}>Média mensal: R$ {projecao.mediaMensal.toFixed(2).replace('.', ',')}</Text>
            {projecao.mesesParaLimite !== null && projecao.dataLimite ? (
              <Text style={s.projecaoVal}>
                Estimativa: atingirá o limite em <Text style={{ fontWeight: '700' }}>{projecao.mesesParaLimite} mese{projecao.mesesParaLimite !== 1 ? 's' : ''}</Text> ({projecao.dataLimite})
              </Text>
            ) : (
              <Text style={s.projecaoVal}>Receita anual já atingiu ou está próxima do limite.</Text>
            )}
          </View>
        )}

        <Text style={s.sectionTitle}>Últimos 6 meses</Text>
        <View style={s.chartCard}>
          <View style={s.chartLegend}>
            <View style={s.legendItem}><View style={[s.dot, { backgroundColor: COLORS.success }]} /><Text style={s.legendText}>Receita</Text></View>
            <View style={s.legendItem}><View style={[s.dot, { backgroundColor: COLORS.danger }]} /><Text style={s.legendText}>Despesa</Text></View>
          </View>
          {barData.some(b => b.value > 0) ? (
            <BarChart
              data={barData}
              barWidth={16}
              noOfSections={4}
              barBorderRadius={4}
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={COLORS.border}
              yAxisTextStyle={{ color: COLORS.textLight, fontSize: 10 }}
              width={width - 80}
              isAnimated
              hideRules
            />
          ) : (
            <Text style={s.semDados}>Sem dados nos últimos 6 meses.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 16, paddingTop: 20 },
  greeting: { fontSize: FONTS['2xl'], fontWeight: '800', color: COLORS.text },
  cnpjText: { fontSize: FONTS.sm, color: COLORS.textMuted, marginTop: 2 },
  emailText: { fontSize: FONTS.sm, color: COLORS.textLight, marginBottom: 16 },
  alerta: { backgroundColor: COLORS.warningLight, borderRadius: RADIUS.md, padding: 10, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: COLORS.warning },
  alertaText: { fontSize: FONTS.sm, color: COLORS.warning, fontWeight: '600' },
  sectionTitle: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 10 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: 12, borderLeftWidth: 3, flex: 1, minWidth: '45%' },
  kpiLabel: { fontSize: 11, color: COLORS.textMuted, marginBottom: 4 },
  kpiVal: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text },
  retiradaCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 16, marginBottom: 4 },
  retiradaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  retiradaLabel: { fontSize: FONTS.sm, color: COLORS.textMuted },
  retiradaVal: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.text },
  retiradaHint: { fontSize: 11, color: COLORS.textLight, marginTop: 8, lineHeight: 16 },
  limiteCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 16 },
  limiteTopo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  limiteLabel: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.text },
  limitePct: { fontSize: FONTS.sm, color: COLORS.textMuted },
  barBg: { height: 10, backgroundColor: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: 6 },
  barFill: { height: 10, borderRadius: RADIUS.full },
  limiteValores: { fontSize: FONTS.sm, color: COLORS.textMuted },
  limiteAviso: { fontSize: FONTS.sm, color: COLORS.danger, marginTop: 8, fontWeight: '600' },
  projecaoCard: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: 14, marginTop: 10, borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  projecaoTitle: { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  projecaoSub: { fontSize: FONTS.sm, color: COLORS.textMuted, marginBottom: 2 },
  projecaoVal: { fontSize: FONTS.sm, color: COLORS.text, lineHeight: 18 },
  chartCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 16 },
  chartLegend: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: FONTS.sm, color: COLORS.textMuted },
  semDados: { textAlign: 'center', color: COLORS.textMuted, paddingVertical: 24, fontSize: FONTS.base },
})
