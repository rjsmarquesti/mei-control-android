import { useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, SafeAreaView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import * as ScreenCapture from 'expo-screen-capture'
import { Ionicons } from '@expo/vector-icons'
import { ATIVIDADES, AtividadeId, simularIRPFAno, simularMEIvsME } from '../../lib/irpf'
import { getConfig } from '../../lib/db'
import { exportIRPFPDF } from '../../lib/pdf'
import { COLORS, FONTS, RADIUS } from '../../constants/theme'

function fmt(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const ANOS = [2024, 2025]

export default function IRPFScreen() {
  const insets = useSafeAreaInsets()
  const [atividade, setAtividade] = useState<AtividadeId>('comercio')
  const [receita, setReceita] = useState('')
  const [das, setDas] = useState('')
  const [ano, setAno] = useState(new Date().getFullYear() >= 2025 ? 2025 : 2024)
  const [showMEIvsME, setShowMEIvsME] = useState(false)

  useFocusEffect(useCallback(() => {
    ScreenCapture.preventScreenCaptureAsync()
    const saved = getConfig('atividadePrincipal') as AtividadeId | null
    if (saved) setAtividade(saved)
    return () => { ScreenCapture.allowScreenCaptureAsync() }
  }, []))

  const receitaNum = parseFloat(receita.replace(',', '.')) || 0
  const dasNum = parseFloat(das.replace(',', '.')) || 0
  const sim = receita ? simularIRPFAno(receitaNum, dasNum, atividade, ano) : null
  const comp = receita && showMEIvsME ? simularMEIvsME(receitaNum, atividade) : null
  const atividadeAtual = ATIVIDADES.find(a => a.id === atividade)!

  async function handleExportPDF() {
    if (!sim) return
    try { await exportIRPFPDF(sim, atividadeAtual.label, atividadeAtual.pct) } catch {}
  }

  return (
    <SafeAreaView style={[s.safe, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={s.headerRow}>
          <Text style={s.title}>Simulador IRPF</Text>
          {sim && (
            <TouchableOpacity onPress={handleExportPDF} style={s.pdfBtn}>
              <Ionicons name="download-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={s.sub}>Estimativa para MEI — lucro presumido. Consulte um contador para a declaração oficial.</Text>

        <Text style={s.sectionTitle}>Ano-calendário</Text>
        <View style={s.anoRow}>
          {ANOS.map(a => (
            <TouchableOpacity key={a} style={[s.anoBtn, ano === a && s.anoBtnActive]} onPress={() => setAno(a)}>
              <Text style={[s.anoText, ano === a && s.anoTextActive]}>{a}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.sectionTitle}>Atividade principal</Text>
        {ATIVIDADES.map(a => (
          <TouchableOpacity key={a.id} style={[s.ativBtn, atividade === a.id && s.ativBtnActive]} onPress={() => setAtividade(a.id)}>
            <Text style={[s.ativText, atividade === a.id && s.ativTextActive]}>{a.label}</Text>
            <Text style={[s.ativPct, atividade === a.id && s.ativPctActive]}>{(a.pct * 100).toFixed(0)}% tributável</Text>
          </TouchableOpacity>
        ))}

        <Text style={s.sectionTitle}>Dados anuais</Text>
        <Text style={s.label}>Receita bruta anual (R$)</Text>
        <TextInput style={s.input} value={receita} onChangeText={setReceita} keyboardType="decimal-pad" placeholder="Ex: 50000,00" placeholderTextColor={COLORS.textLight} />
        <Text style={s.label}>Total DAS pago no ano (R$)</Text>
        <TextInput style={s.input} value={das} onChangeText={setDas} keyboardType="decimal-pad" placeholder="Ex: 910,80" placeholderTextColor={COLORS.textLight} />

        {sim && (
          <View style={s.result}>
            <Text style={s.resultTitle}>Resultado {ano}</Text>
            <Row label="Receita bruta" value={fmt(sim.receitaBruta)} />
            <Row label={`Rendimento isento (${((1 - atividadeAtual.pct) * 100).toFixed(0)}%)`} value={fmt(sim.rendimentoIsento)} color={COLORS.success} />
            <Row label={`Rendimento tributável (${(atividadeAtual.pct * 100).toFixed(0)}%)`} value={fmt(sim.rendimentoTributavel)} />
            <Row label="(-) DAS pago" value={`- ${fmt(sim.dasPago)}`} color={COLORS.textMuted} />
            <View style={s.divider} />
            <Row label="Base de cálculo" value={fmt(sim.baseCalculo)} bold />
            <Row label="Imposto estimado" value={fmt(sim.impostoDue)} bold color={sim.impostoDue > 0 ? COLORS.danger : COLORS.success} />
            <Row label="Alíquota efetiva" value={`${sim.aliquotaEfetiva.toFixed(2)}%`} color={COLORS.textMuted} />
            {sim.impostoDue === 0 && (
              <View style={s.isentoBox}>
                <Text style={s.isentoText}>✅ Isento de IRPF com base nos dados informados.</Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity style={s.toggleBtn} onPress={() => setShowMEIvsME(v => !v)}>
          <Text style={s.toggleBtnText}>⚖️ Comparar MEI vs Simples Nacional</Text>
          <Ionicons name={showMEIvsME ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.primary} />
        </TouchableOpacity>

        {comp && showMEIvsME && (
          <View style={s.result}>
            <Text style={s.resultTitle}>MEI vs Simples Nacional</Text>
            <Row label="Receita anual" value={fmt(comp.receitaBruta)} />
            <View style={s.divider} />
            <Row label={`MEI — DAS fixo anual`} value={fmt(comp.custoMEI)} color={COLORS.success} bold />
            <Row label="Alíquota efetiva MEI" value={`${comp.aliquotaMEIPct.toFixed(2)}%`} color={COLORS.textMuted} />
            <View style={s.divider} />
            <Row label={`Simples Nacional (~${comp.aliquotaMEPct.toFixed(0)}%)`} value={fmt(comp.custoME)} color={COLORS.danger} bold />
            <View style={s.divider} />
            <Row label="Economia com MEI" value={fmt(comp.economiaMEI)} bold color={comp.economiaMEI >= 0 ? COLORS.success : COLORS.danger} />
            <View style={[s.isentoBox, { backgroundColor: COLORS.primaryLight, marginTop: 10 }]}>
              <Text style={[s.isentoText, { color: COLORS.primary }]}>
                {comp.economiaMEI > 0
                  ? `Simulação: com MEI o custo tributário seria ${fmt(comp.economiaMEI)}/ano menor. Consulte um contador.`
                  : '⚠️ Simples Nacional pode ser vantajoso nesta simulação. Consulte um contador.'}
              </Text>
            </View>
            {comp.receitaBruta > 81000 && (
              <View style={[s.isentoBox, { backgroundColor: COLORS.warningLight, marginTop: 8 }]}>
                <Text style={[s.isentoText, { color: COLORS.warning }]}>⚠️ Receita acima do limite MEI (R$ 81.000/ano). Consulte um contador sobre as opções de enquadramento.</Text>
              </View>
            )}
          </View>
        )}

        <View style={s.disclaimer}>
          <Text style={s.disclaimerText}>
            ⚠️ Estimativa baseada na tabela progressiva IRPF {ano}. Alíquotas Simples Nacional são aproximadas (Anexo I/III). Consulte um contador.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ fontSize: FONTS.sm, color: COLORS.textMuted, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: bold ? FONTS.base : FONTS.sm, fontWeight: bold ? '700' : '600', color: color ?? COLORS.text }}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 16, paddingTop: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.text },
  pdfBtn: { padding: 8, borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.md },
  sub: { fontSize: FONTS.sm, color: COLORS.textMuted, lineHeight: 18, marginBottom: 20 },
  sectionTitle: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  anoRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  anoBtn: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.card },
  anoBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  anoText: { fontSize: FONTS.base, color: COLORS.textMuted, fontWeight: '600' },
  anoTextActive: { color: COLORS.primary, fontWeight: '700' },
  ativBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  ativBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  ativText: { fontSize: FONTS.base, color: COLORS.textMuted },
  ativTextActive: { color: COLORS.primary, fontWeight: '700' },
  ativPct: { fontSize: FONTS.sm, color: COLORS.textLight },
  ativPctActive: { color: COLORS.primary, fontWeight: '700' },
  label: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.text, marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: FONTS.base, color: COLORS.text, backgroundColor: COLORS.card, marginBottom: 4 },
  result: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 16, marginTop: 16, marginBottom: 12 },
  resultTitle: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  isentoBox: { backgroundColor: COLORS.successLight, borderRadius: RADIUS.md, padding: 10, marginTop: 10 },
  isentoText: { fontSize: FONTS.sm, color: COLORS.success, fontWeight: '600' },
  toggleBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: 14, marginTop: 4, marginBottom: 4, borderWidth: 1, borderColor: COLORS.border },
  toggleBtnText: { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '600' },
  disclaimer: { backgroundColor: COLORS.warningLight, borderRadius: RADIUS.md, padding: 12, marginBottom: 8, marginTop: 8 },
  disclaimerText: { fontSize: FONTS.sm, color: COLORS.warning, lineHeight: 18 },
})
