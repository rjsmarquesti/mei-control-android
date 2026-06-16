import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, SafeAreaView,
  KeyboardAvoidingView, Platform, Switch,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useFocusEffect } from 'expo-router'
import * as ScreenCapture from 'expo-screen-capture'
import { Ionicons } from '@expo/vector-icons'
import { PieChart } from 'react-native-gifted-charts'
import { getTransactions, insertTransaction, updateTransaction, deleteTransaction, Transaction } from '../../lib/db'
import { exportFinanceiroPDF } from '../../lib/pdf'
import { exportFinanceiroCSV } from '../../lib/csv'
import { COLORS, FONTS, RADIUS } from '../../constants/theme'

const CATEGORIAS_RECEITA = ['Vendas', 'Serviços', 'Outros']
const CATEGORIAS_DESPESA = ['Compras', 'Aluguel', 'Transporte', 'Marketing', 'Equipamentos', 'Outros']

function formInicial(t: 'receita' | 'despesa') {
  return { descricao: '', valor: '', data: new Date().toISOString().slice(0, 10), categoria: t === 'receita' ? 'Vendas' : 'Compras', recorrente: false }
}

export default function FinanceiroScreen() {
  const insets = useSafeAreaInsets()
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  const [filtroMes, setFiltroMes] = useState(mesAtual)
  const [filtroCat, setFiltroCat] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('receita')
  const [form, setForm] = useState(formInicial('receita'))

  useFocusEffect(useCallback(() => {
    ScreenCapture.preventScreenCaptureAsync()
    load()
    return () => { ScreenCapture.allowScreenCaptureAsync() }
  }, [filtroMes]))

  function load() { setTransactions(getTransactions(filtroMes)) }

  const allCats = [...new Set(transactions.map(t => t.categoria))]
  const filtered = filtroCat ? transactions.filter(t => t.categoria === filtroCat) : transactions
  const totalReceitas = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + t.valor, 0)
  const totalDespesas = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + t.valor, 0)
  const saldo = totalReceitas - totalDespesas

  const pieData = [
    ...(totalReceitas > 0 ? [{ value: totalReceitas, color: COLORS.success }] : []),
    ...(totalDespesas > 0 ? [{ value: totalDespesas, color: COLORS.danger }] : []),
  ]

  function abrirDatePicker() {
    DateTimePickerAndroid.open({
      value: new Date(form.data + 'T00:00:00'),
      onChange: (_, date) => { if (date) setForm(f => ({ ...f, data: date.toISOString().slice(0, 10) })) },
      mode: 'date',
    })
  }

  function abrirNovo() {
    setEditingId(null)
    setTipo('receita')
    setForm(formInicial('receita'))
    setModalVisible(true)
  }

  function abrirEditar(t: Transaction) {
    setEditingId(t.id!)
    setTipo(t.type)
    setForm({ descricao: t.descricao, valor: String(t.valor), data: t.data, categoria: t.categoria, recorrente: t.recorrente ?? false })
    setModalVisible(true)
  }

  function fecharModal() {
    setModalVisible(false)
    setEditingId(null)
    setForm(formInicial('receita'))
  }

  function salvar() {
    if (!form.descricao || !form.valor || !form.data) {
      Alert.alert('Campos obrigatórios', 'Preencha todos os campos.')
      return
    }
    const valor = parseFloat(String(form.valor).replace(',', '.'))
    if (isNaN(valor) || valor <= 0) { Alert.alert('Valor inválido', 'Informe um valor maior que zero.'); return }

    const t = { type: tipo, descricao: form.descricao.trim(), valor, data: form.data, categoria: form.categoria, recorrente: form.recorrente }
    if (editingId !== null) {
      updateTransaction(editingId, t)
    } else {
      insertTransaction({ ...t, createdAt: Date.now() })
    }
    fecharModal()
    load()
  }

  function confirmarDelete(id: number) {
    Alert.alert('Excluir', 'Excluir este lançamento?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => { deleteTransaction(id); load() } },
    ])
  }

  async function handleExportPDF() {
    if (transactions.length === 0) { Alert.alert('Sem dados', 'Nenhum lançamento para exportar.'); return }
    try { await exportFinanceiroPDF(transactions, filtroMes) }
    catch { Alert.alert('Erro', 'Não foi possível gerar o PDF.') }
  }

  async function handleExportCSV() {
    if (transactions.length === 0) { Alert.alert('Sem dados', 'Nenhum lançamento para exportar.'); return }
    try { await exportFinanceiroCSV(transactions, filtroMes) }
    catch { Alert.alert('Erro', 'Não foi possível exportar o CSV.') }
  }

  function mudarMes(delta: number) {
    const [ano, mes] = filtroMes.split('-').map(Number)
    let novoMes = mes + delta, novoAno = ano
    if (novoMes < 1) { novoMes = 12; novoAno-- }
    if (novoMes > 12) { novoMes = 1; novoAno++ }
    setFiltroCat(null)
    setFiltroMes(`${novoAno}-${String(novoMes).padStart(2, '0')}`)
  }

  const categorias = tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA

  return (
    <SafeAreaView style={[s.safe, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.title}>Financeiro</Text>
        <View style={s.headerActions}>
          <TouchableOpacity onPress={handleExportCSV} style={s.iconBtn}>
            <Ionicons name="document-text-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleExportPDF} style={s.iconBtn}>
            <Ionicons name="download-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={abrirNovo}>
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

      {pieData.length >= 2 && (
        <View style={s.pieRow}>
          <PieChart
            data={pieData}
            radius={44}
            donut
            innerRadius={28}
            centerLabelComponent={() => (
              <Text style={{ fontSize: 9, color: saldo >= 0 ? COLORS.primary : COLORS.danger, fontWeight: '700', textAlign: 'center' }}>
                {saldo >= 0 ? '+' : ''}{saldo.toFixed(0)}
              </Text>
            )}
          />
          <View style={s.pieLegend}>
            <View style={s.pieLegendItem}><View style={[s.pieDot, { backgroundColor: COLORS.success }]} /><Text style={s.pieLegendText}>Receitas R$ {totalReceitas.toFixed(2).replace('.', ',')}</Text></View>
            <View style={s.pieLegendItem}><View style={[s.pieDot, { backgroundColor: COLORS.danger }]} /><Text style={s.pieLegendText}>Despesas R$ {totalDespesas.toFixed(2).replace('.', ',')}</Text></View>
          </View>
        </View>
      )}

      {allCats.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catFilterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}>
          <TouchableOpacity style={[s.catChip, !filtroCat && s.catChipActive]} onPress={() => setFiltroCat(null)}>
            <Text style={[s.catChipText, !filtroCat && s.catChipTextActive]}>Todos</Text>
          </TouchableOpacity>
          {allCats.map(c => (
            <TouchableOpacity key={c} style={[s.catChip, filtroCat === c && s.catChipActive]} onPress={() => setFiltroCat(filtroCat === c ? null : c)}>
              <Text style={[s.catChipText, filtroCat === c && s.catChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView style={s.list}>
        {filtered.length === 0 && (
          <Text style={s.empty}>{transactions.length === 0 ? `Nenhum lançamento em ${filtroMes}.` : 'Nenhum lançamento nesta categoria.'}</Text>
        )}
        {filtered.map(t => (
          <View key={t.id} style={s.card}>
            <View style={[s.typeBar, { backgroundColor: t.type === 'receita' ? COLORS.success : COLORS.danger }]} />
            <View style={s.cardBody}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.descricao} numberOfLines={1}>{t.descricao}{t.recorrente ? ' 🔁' : ''}</Text>
                  <Text style={s.cat}>{t.categoria} · {t.data}</Text>
                </View>
                <View style={s.cardRight}>
                  <Text style={[s.valor, { color: t.type === 'receita' ? COLORS.success : COLORS.danger }]}>
                    {t.type === 'receita' ? '+' : '-'} R$ {t.valor.toFixed(2).replace('.', ',')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => abrirEditar(t)} style={{ padding: 4 }}>
                      <Ionicons name="pencil-outline" size={15} color={COLORS.textLight} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmarDelete(t.id!)} style={{ padding: 4 }}>
                      <Ionicons name="trash-outline" size={15} color={COLORS.textLight} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ))}
        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.overlay}>
            <View style={[s.modal, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={s.modalTitle}>{editingId ? 'Editar lançamento' : 'Novo lançamento'}</Text>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
                <TextInput style={s.input} value={form.descricao} onChangeText={v => setForm(f => ({ ...f, descricao: v }))} placeholder="Ex: Venda de produto" placeholderTextColor={COLORS.textLight} />
                <Text style={s.label}>Valor (R$)</Text>
                <TextInput style={s.input} value={String(form.valor)} onChangeText={v => setForm(f => ({ ...f, valor: v }))} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={COLORS.textLight} />
                <Text style={s.label}>Data</Text>
                <TouchableOpacity style={s.datePicker} onPress={abrirDatePicker}>
                  <Text style={s.datePickerText}>{form.data}</Text>
                  <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={s.label}>Categoria</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {categorias.map(c => (
                    <TouchableOpacity key={c} style={[s.catBtn, form.categoria === c && s.catBtnActive]} onPress={() => setForm(f => ({ ...f, categoria: c }))}>
                      <Text style={[s.catBtnText, form.categoria === c && s.catBtnTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={s.recorrenteRow}>
                  <View>
                    <Text style={s.label}>Recorrente mensal 🔁</Text>
                    <Text style={s.recorrenteHint}>Lançado automaticamente todo mês</Text>
                  </View>
                  <Switch value={form.recorrente} onValueChange={v => setForm(f => ({ ...f, recorrente: v }))} trackColor={{ true: COLORS.primary }} thumbColor="#fff" />
                </View>
                <View style={s.modalBtns}>
                  <TouchableOpacity style={s.cancelBtn} onPress={fecharModal}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
                  <TouchableOpacity style={s.saveBtn} onPress={salvar}><Text style={s.saveText}>Salvar</Text></TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  kpiRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  kpi: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: 10, borderLeftWidth: 3 },
  kpiLabel: { fontSize: 10, color: COLORS.textMuted, marginBottom: 2 },
  kpiVal: { fontSize: 12, fontWeight: '700' },
  pieRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 16, marginBottom: 10, backgroundColor: COLORS.card, marginHorizontal: 16, borderRadius: RADIUS.lg, paddingVertical: 12 },
  pieLegend: { gap: 8 },
  pieLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pieDot: { width: 10, height: 10, borderRadius: 5 },
  pieLegendText: { fontSize: FONTS.sm, color: COLORS.textMuted },
  catFilterRow: { maxHeight: 36, marginBottom: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  catChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  catChipText: { fontSize: FONTS.sm, color: COLORS.textMuted },
  catChipTextActive: { color: COLORS.primary, fontWeight: '700' },
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
  datePicker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: COLORS.bg, marginBottom: 14 },
  datePickerText: { fontSize: FONTS.base, color: COLORS.text },
  catBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  catBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  catBtnText: { fontSize: FONTS.sm, color: COLORS.textMuted },
  catBtnTextActive: { color: COLORS.primary, fontWeight: '700' },
  recorrenteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  recorrenteHint: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 13, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, alignItems: 'center' },
  cancelText: { color: COLORS.textMuted, fontWeight: '600' },
  saveBtn: { flex: 1, padding: 13, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
})
