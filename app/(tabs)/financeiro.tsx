import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, SafeAreaView,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import * as ScreenCapture from 'expo-screen-capture'
import { Ionicons } from '@expo/vector-icons'
import { getTransactions, insertTransaction, deleteTransaction, Transaction } from '../../lib/db'
import { exportFinanceiroPDF } from '../../lib/pdf'
import { COLORS, FONTS, RADIUS } from '../../constants/theme'

const CATEGORIAS_RECEITA = ['Vendas', 'Serviços', 'Outros']
const CATEGORIAS_DESPESA = ['Compras', 'Aluguel', 'Transporte', 'Marketing', 'Equipamentos', 'Outros']

export default function FinanceiroScreen() {
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  const [filtroMes, setFiltroMes] = useState(mesAtual)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('receita')
  const [form, setForm] = useState({ descricao: '', valor: '', data: hoje.toISOString().slice(0, 10), categoria: 'Vendas' })

  useFocusEffect(useCallback(() => {
    ScreenCapture.preventScreenCaptureAsync()
    load()
    return () => { ScreenCapture.allowScreenCaptureAsync() }
  }, [filtroMes]))

  function load() { setTransactions(getTransactions(filtroMes)) }

  const totalReceitas = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + t.valor, 0)
  const totalDespesas = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + t.valor, 0)
  const saldo = totalReceitas - totalDespesas

  function salvar() {
    if (!form.descricao || !form.valor || !form.data) {
      Alert.alert('Campos obrigatórios', 'Preencha todos os campos.')
      return
    }
    insertTransaction({ type: tipo, descricao: form.descricao.trim(), valor: parseFloat(form.valor.replace(',', '.')), data: form.data, categoria: form.categoria, createdAt: Date.now() })
    setModalVisible(false)
    setForm({ descricao: '', valor: '', data: hoje.toISOString().slice(0, 10), categoria: 'Vendas' })
    load()
  }

  function confirmarDelete(id: number) {
    Alert.alert('Excluir', 'Excluir este lançamento?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => { deleteTransaction(id); load() } },
    ])
  }

  async function handleExport() {
    if (transactions.length === 0) { Alert.alert('Sem dados', 'Nenhum lançamento para exportar.'); return }
    try { await exportFinanceiroPDF(transactions, filtroMes) }
    catch { Alert.alert('Erro', 'Não foi possível gerar o PDF.') }
  }

  function mudarMes(delta: number) {
    const [ano, mes] = filtroMes.split('-').map(Number)
    let novoMes = mes + delta, novoAno = ano
    if (novoMes < 1) { novoMes = 12; novoAno-- }
    if (novoMes > 12) { novoMes = 1; novoAno++ }
    setFiltroMes(`${novoAno}-${String(novoMes).padStart(2, '0')}`)
  }

  const categorias = tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Financeiro</Text>
        <View style={s.headerActions}>
          <TouchableOpacity onPress={handleExport} style={s.iconBtn}>
            <Ionicons name="download-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={() => setModalVisible(true)}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={s.addBtnText}>Novo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.mesRow}>
        <TouchableOpacity onPress={() => mudarMes(-1)} style={s.arrowBtn}><Ionicons name="chevron-back" size={20} color={COLORS.primary} /></TouchableOpacity>
        <Text style={s.mesLabel}>{filtroMes}</Text>
        <TouchableOpacity onPress={() => mudarMes(1)} style={s.arrowBtn}><Ionicons name="chevron-forward" size={20} color={COLORS.primary} /></TouchableOpacity>
      </View>

      <View style={s.kpiRow}>
        <View style={[s.kpi, { borderLeftColor: COLORS.success }]}>
          <Text style={s.kpiLabel}>Receitas</Text>
          <Text style={[s.kpiVal, { color: COLORS.success }]}>R$ {totalReceitas.toFixed(2).replace('.', ',')}</Text>
        </View>
        <View style={[s.kpi, { borderLeftColor: COLORS.danger }]}>
          <Text style={s.kpiLabel}>Despesas</Text>
          <Text style={[s.kpiVal, { color: COLORS.danger }]}>R$ {totalDespesas.toFixed(2).replace('.', ',')}</Text>
        </View>
        <View style={[s.kpi, { borderLeftColor: saldo >= 0 ? COLORS.primary : COLORS.danger }]}>
          <Text style={s.kpiLabel}>Saldo</Text>
          <Text style={[s.kpiVal, { color: saldo >= 0 ? COLORS.primary : COLORS.danger }]}>R$ {saldo.toFixed(2).replace('.', ',')}</Text>
        </View>
      </View>

      <ScrollView style={s.list}>
        {transactions.length === 0 && <Text style={s.empty}>Nenhum lançamento em {filtroMes}.</Text>}
        {transactions.map(t => (
          <View key={t.id} style={s.card}>
            <View style={[s.typeBar, { backgroundColor: t.type === 'receita' ? COLORS.success : COLORS.danger }]} />
            <View style={s.cardBody}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.descricao} numberOfLines={1}>{t.descricao}</Text>
                  <Text style={s.cat}>{t.categoria} · {t.data}</Text>
                </View>
                <View style={s.cardRight}>
                  <Text style={[s.valor, { color: t.type === 'receita' ? COLORS.success : COLORS.danger }]}>
                    {t.type === 'receita' ? '+' : '-'} R$ {t.valor.toFixed(2).replace('.', ',')}
                  </Text>
                  <TouchableOpacity onPress={() => confirmarDelete(t.id!)} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={16} color={COLORS.textLight} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Novo lançamento</Text>
            <View style={s.tipoRow}>
              {(['receita', 'despesa'] as const).map(t => (
                <TouchableOpacity key={t}
                  style={[s.tipoBtn, tipo === t && { backgroundColor: t === 'receita' ? COLORS.successLight : COLORS.dangerLight, borderColor: t === 'receita' ? COLORS.success : COLORS.danger }]}
                  onPress={() => { setTipo(t); setForm(f => ({ ...f, categoria: t === 'receita' ? 'Vendas' : 'Compras' })) }}>
                  <Text style={[s.tipoText, tipo === t && { color: COLORS.text }]}>{t === 'receita' ? 'Receita' : 'Despesa'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.label}>Descrição</Text>
            <TextInput style={s.input} value={form.descricao} onChangeText={t => setForm(f => ({ ...f, descricao: t }))} placeholder="Ex: Venda de produto" placeholderTextColor={COLORS.textLight} />
            <Text style={s.label}>Valor (R$)</Text>
            <TextInput style={s.input} value={form.valor} onChangeText={t => setForm(f => ({ ...f, valor: t }))} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={COLORS.textLight} />
            <Text style={s.label}>Data (AAAA-MM-DD)</Text>
            <TextInput style={s.input} value={form.data} onChangeText={t => setForm(f => ({ ...f, data: t }))} placeholder="2025-01-15" placeholderTextColor={COLORS.textLight} />
            <Text style={s.label}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {categorias.map(c => (
                <TouchableOpacity key={c} style={[s.catBtn, form.categoria === c && s.catBtnActive]} onPress={() => setForm(f => ({ ...f, categoria: c }))}>
                  <Text style={[s.catBtnText, form.categoria === c && s.catBtnTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={salvar}><Text style={s.saveText}>Salvar</Text></TouchableOpacity>
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
  mesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 },
  arrowBtn: { padding: 6 },
  mesLabel: { fontSize: FONTS.md, fontWeight: '700', color: COLORS.text, minWidth: 80, textAlign: 'center' },
  kpiRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  kpi: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: 10, borderLeftWidth: 3 },
  kpiLabel: { fontSize: 10, color: COLORS.textMuted, marginBottom: 2 },
  kpiVal: { fontSize: 13, fontWeight: '700' },
  list: { flex: 1, paddingHorizontal: 16 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 48, fontSize: FONTS.base },
  card: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, marginBottom: 8, overflow: 'hidden' },
  typeBar: { width: 4 },
  cardBody: { flex: 1, padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  descricao: { fontSize: FONTS.base, fontWeight: '600', color: COLORS.text },
  cat: { fontSize: FONTS.sm, color: COLORS.textMuted, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  valor: { fontSize: FONTS.base, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  tipoRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tipoBtn: { flex: 1, padding: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  tipoText: { fontSize: FONTS.base, color: COLORS.textMuted, fontWeight: '600' },
  label: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: FONTS.base, color: COLORS.text, backgroundColor: COLORS.bg, marginBottom: 14 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  catBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  catBtnText: { fontSize: FONTS.sm, color: COLORS.textMuted },
  catBtnTextActive: { color: COLORS.primary, fontWeight: '700' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 13, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, alignItems: 'center' },
  cancelText: { color: COLORS.textMuted, fontWeight: '600' },
  saveBtn: { flex: 1, padding: 13, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
})
