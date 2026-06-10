import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, RefreshControl, SafeAreaView,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import * as ScreenCapture from 'expo-screen-capture'
import { Ionicons } from '@expo/vector-icons'
import { getDasList, upsertDas, marcarDasPago, deleteDas, DasRow } from '../../lib/db'
import { calcularDasComAtraso, vencimentoDas, valorDasMEI } from '../../lib/das'
import { exportDasPDF } from '../../lib/pdf'
import { openGovLink } from '../../lib/gov-links'
import { COLORS, FONTS, RADIUS } from '../../constants/theme'

export default function DasScreen() {
  const [das, setDas] = useState<DasRow[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [form, setForm] = useState({ competencia: '', valor: '', vencimento: '' })

  useFocusEffect(useCallback(() => {
    ScreenCapture.preventScreenCaptureAsync()
    load()
    return () => { ScreenCapture.allowScreenCaptureAsync() }
  }, []))

  function load() { setDas(getDasList()) }

  function abrirModal() {
    const hoje = new Date()
    const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
    setForm({ competencia, valor: valorDasMEI().toFixed(2), vencimento: vencimentoDas(competencia) })
    setModalVisible(true)
  }

  function salvar() {
    if (!form.competencia || !form.valor || !form.vencimento) {
      Alert.alert('Campos obrigatórios', 'Preencha todos os campos.')
      return
    }
    upsertDas({ competencia: form.competencia, valor: parseFloat(form.valor.replace(',', '.')), vencimento: form.vencimento, pago: false })
    setModalVisible(false)
    load()
  }

  function confirmarPagamento(item: DasRow) {
    const hoje = new Date().toISOString().slice(0, 10)
    Alert.alert('Marcar como pago', `Confirmar pagamento do DAS de ${item.competencia}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => { marcarDasPago(item.competencia, hoje); load() } },
    ])
  }

  function confirmarDelete(item: DasRow) {
    Alert.alert('Excluir', `Excluir o DAS de ${item.competencia}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => { deleteDas(item.id!); load() } },
    ])
  }

  async function handleExport() {
    if (das.length === 0) { Alert.alert('Sem dados', 'Nenhum DAS para exportar.'); return }
    setExporting(true)
    try { await exportDasPDF(das) } catch { Alert.alert('Erro', 'Não foi possível gerar o PDF.') }
    finally { setExporting(false) }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Guia DAS</Text>
        <View style={s.headerActions}>
          <TouchableOpacity onPress={handleExport} style={s.iconBtn} disabled={exporting}>
            <Ionicons name="download-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={abrirModal} style={s.addBtn}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={s.addBtnText}>Novo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.govRow}>
        <TouchableOpacity style={s.govBtn} onPress={() => openGovLink('pgmei')}>
          <Ionicons name="globe-outline" size={14} color={COLORS.primary} />
          <Text style={s.govBtnText}>Emitir DAS (PGMEI)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.govBtn} onPress={() => openGovLink('situacaoFiscal')}>
          <Ionicons name="document-text-outline" size={14} color={COLORS.primary} />
          <Text style={s.govBtnText}>Situação Fiscal</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.list} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        {das.length === 0 && <Text style={s.empty}>Nenhum DAS registrado. Toque em "Novo" para adicionar.</Text>}
        {das.map(item => {
          const calc = calcularDasComAtraso(item.valor, item.vencimento)
          const atrasado = !item.pago && calc.diasAtraso > 0
          return (
            <View key={item.id} style={[s.card, item.pago && s.cardPago, atrasado && s.cardAtrasado]}>
              <View style={s.cardTop}>
                <View>
                  <Text style={s.competencia}>{item.competencia}</Text>
                  <Text style={s.venc}>Vence: {item.vencimento}</Text>
                </View>
                <View style={s.cardRight}>
                  <Text style={s.valor}>R$ {(item.pago ? item.valor : calc.total).toFixed(2).replace('.', ',')}</Text>
                  {atrasado && <Text style={s.atrasoLabel}>+multa/juros ({calc.diasAtraso}d)</Text>}
                </View>
              </View>
              <View style={s.cardActions}>
                {!item.pago && (
                  <TouchableOpacity style={s.actionBtn} onPress={() => confirmarPagamento(item)}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.success} />
                    <Text style={[s.actionText, { color: COLORS.success }]}>Pago</Text>
                  </TouchableOpacity>
                )}
                {item.pago && (
                  <View style={s.pagoTag}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                    <Text style={s.pagoText}>Pago em {item.pagadoEm}</Text>
                  </View>
                )}
                <TouchableOpacity style={s.actionBtn} onPress={() => confirmarDelete(item)}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )
        })}
        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Novo DAS</Text>
            <Text style={s.label}>Competência (AAAA-MM)</Text>
            <TextInput style={s.input} value={form.competencia} onChangeText={t => {
              setForm(f => ({ ...f, competencia: t, vencimento: t.length === 7 ? vencimentoDas(t) : f.vencimento }))
            }} placeholder="2025-01" placeholderTextColor={COLORS.textLight} />
            <Text style={s.label}>Valor (R$)</Text>
            <TextInput style={s.input} value={form.valor} onChangeText={t => setForm(f => ({ ...f, valor: t }))} keyboardType="decimal-pad" placeholder="75,90" placeholderTextColor={COLORS.textLight} />
            <Text style={s.label}>Vencimento (AAAA-MM-DD)</Text>
            <TextInput style={s.input} value={form.vencimento} onChangeText={t => setForm(f => ({ ...f, vencimento: t }))} placeholder="2025-02-20" placeholderTextColor={COLORS.textLight} />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={s.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={salvar}>
                <Text style={s.saveText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 20 },
  title: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 6 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 7, gap: 4 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: FONTS.sm },
  govRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  govBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.md, padding: 8, justifyContent: 'center' },
  govBtnText: { color: COLORS.primary, fontSize: 11, fontWeight: '600' },
  list: { flex: 1, paddingHorizontal: 16 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 48, fontSize: FONTS.base },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  cardPago: { borderLeftColor: COLORS.success, opacity: 0.85 },
  cardAtrasado: { borderLeftColor: COLORS.danger },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  competencia: { fontSize: FONTS.md, fontWeight: '700', color: COLORS.text },
  venc: { fontSize: FONTS.sm, color: COLORS.textMuted, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  valor: { fontSize: FONTS.md, fontWeight: '700', color: COLORS.text },
  atrasoLabel: { fontSize: 10, color: COLORS.danger, marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: FONTS.sm, fontWeight: '600' },
  pagoTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pagoText: { fontSize: FONTS.sm, color: COLORS.success },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  label: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: FONTS.base, color: COLORS.text, backgroundColor: COLORS.bg, marginBottom: 14 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 13, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, alignItems: 'center' },
  cancelText: { color: COLORS.textMuted, fontWeight: '600' },
  saveBtn: { flex: 1, padding: 13, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
})
