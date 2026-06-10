import { useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, SafeAreaView, Dimensions } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { BarChart } from 'react-native-gifted-charts'
import { getTransactions, getDasList, getConfig } from '../../lib/db'
import { calcularDasComAtraso } from '../../lib/das'
import { COLORS, FONTS, RADIUS, LIMITE_MEI_ANUAL } from '../../constants/theme'

const { width } = Dimensions.get('window')

export default function DashboardScreen() {
  const [kpis, setKpis] = useState<{ receitas: number; despesas: number; saldo: number; dasStatus: string; dasStatusColor: string; receitaAnual: number; limitePct: number }>({ receitas: 0, despesas: 0, saldo: 0, dasStatus: '...', dasStatusColor: COLORS.textMuted, receitaAnual: 0, limitePct: 0 })
  const [grafico, setGrafico] = useState<{ label: string; receita: number; despesa: number }[]>([])
  const [alertas, setAlertas] = useState<string[]>([])
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')

  useFocusEffect(useCallback(() => { loadData() }, []))

  function loadData() {
    setEmail(getConfig('email') ?? '')
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
    const limitePct = Math.min(100, (receitaAnual / LIMITE_MEI_ANUAL) * 100)

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
    setKpis({ receitas, despesas, saldo: receitas - despesas, dasStatus, dasStatusColor, receitaAnual, limitePct })

    // Gráfico: últimos 6 meses
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const txs = getTransactions(mesStr)
      meses.push({
        label: String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2),
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
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
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
            R$ {kpis.receitaAnual.toLocaleString('pt-BR')} de R$ {LIMITE_MEI_ANUAL.toLocaleString('pt-BR')}
          </Text>
          {kpis.limitePct >= 80 && (
            <Text style={s.limiteAviso}>⚠️ Próximo do limite MEI! Considere regularizar sua situação.</Text>
          )}
        </View>

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
  container: { padding: 16, paddingTop: 20, paddingBottom: 24 },
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
  limiteCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 16 },
  limiteTopo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  limiteLabel: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.text },
  limitePct: { fontSize: FONTS.sm, color: COLORS.textMuted },
  barBg: { height: 10, backgroundColor: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: 6 },
  barFill: { height: 10, borderRadius: RADIUS.full },
  limiteValores: { fontSize: FONTS.sm, color: COLORS.textMuted },
  limiteAviso: { fontSize: FONTS.sm, color: COLORS.danger, marginTop: 8, fontWeight: '600' },
  chartCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 16 },
  chartLegend: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: FONTS.sm, color: COLORS.textMuted },
  semDados: { textAlign: 'center', color: COLORS.textMuted, paddingVertical: 24, fontSize: FONTS.base },
})
