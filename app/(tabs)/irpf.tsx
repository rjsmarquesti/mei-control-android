import { useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, SafeAreaView } from 'react-native'
import { useFocusEffect } from 'expo-router'
import * as ScreenCapture from 'expo-screen-capture'
import { ATIVIDADES, AtividadeId, simularIRPF } from '../../lib/irpf'
import { getConfig } from '../../lib/db'
import { COLORS, FONTS, RADIUS } from '../../constants/theme'

function fmt(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function IRPFScreen() {
  const [atividade, setAtividade] = useState<AtividadeId>('comercio')
  const [receita, setReceita] = useState('')
  const [das, setDas] = useState('')

  useFocusEffect(useCallback(() => {
    ScreenCapture.preventScreenCaptureAsync()
    const saved = getConfig('atividadePrincipal') as AtividadeId | null
    if (saved) setAtividade(saved)
    return () => { ScreenCapture.allowScreenCaptureAsync() }
  }, []))

  const sim = receita
    ? simularIRPF(parseFloat(receita.replace(',', '.')) || 0, parseFloat(das.replace(',', '.')) || 0, atividade)
    : null

  const atividadeAtual = ATIVIDADES.find(a => a.id === atividade)!

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Simulador IRPF</Text>
        <Text style={s.sub}>Estimativa de imposto de renda para MEI — lucro presumido. Consulte um contador para a declaração oficial.</Text>

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
            <Text style={s.resultTitle}>Resultado</Text>
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

        <View style={s.disclaimer}>
          <Text style={s.disclaimerText}>
            ⚠️ Estimativa baseada na tabela progressiva IRPF 2024. A declaração real pode variar conforme outras rendas e deduções.
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
  container: { padding: 16, paddingTop: 20, paddingBottom: 32 },
  title: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  sub: { fontSize: FONTS.sm, color: COLORS.textMuted, lineHeight: 18, marginBottom: 20 },
  sectionTitle: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  ativBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  ativBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  ativText: { fontSize: FONTS.base, color: COLORS.textMuted },
  ativTextActive: { color: COLORS.primary, fontWeight: '700' },
  ativPct: { fontSize: FONTS.sm, color: COLORS.textLight },
  ativPctActive: { color: COLORS.primary, fontWeight: '700' },
  label: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.text, marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: FONTS.base, color: COLORS.text, backgroundColor: COLORS.card, marginBottom: 4 },
  result: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 16, marginTop: 20, marginBottom: 16 },
  resultTitle: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  isentoBox: { backgroundColor: COLORS.successLight, borderRadius: RADIUS.md, padding: 10, marginTop: 10 },
  isentoText: { fontSize: FONTS.sm, color: COLORS.success, fontWeight: '600' },
  disclaimer: { backgroundColor: COLORS.warningLight, borderRadius: RADIUS.md, padding: 12, marginBottom: 24 },
  disclaimerText: { fontSize: FONTS.sm, color: COLORS.warning, lineHeight: 18 },
})
