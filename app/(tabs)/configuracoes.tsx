import { useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert, TextInput } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Constants from 'expo-constants'
import { useFocusEffect, router } from 'expo-router'
import { getConfig, setConfig, resetAllData, getDasList } from '../../lib/db'
import { agendarAlertasDAS, enviarNotificacaoTeste, requestNotificationPermission } from '../../lib/notifications'
import { ATIVIDADES, AtividadeId } from '../../lib/irpf'
import { COLORS, FONTS, RADIUS } from '../../constants/theme'

const DIAS_OPCOES = [1, 3, 5, 7, 10]

function formatCNPJ(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function formatTelefone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function formatCEP(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export default function ConfiguracoesScreen() {
  const insets = useSafeAreaInsets()
  const [diasAntes, setDiasAntes] = useState(5)
  const [notifPermitida, setNotifPermitida] = useState(false)

  // Perfil
  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [atividadePrincipal, setAtividadePrincipal] = useState<AtividadeId>('comercio')
  const [telefone, setTelefone] = useState('')
  const [cep, setCep] = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')

  useFocusEffect(useCallback(() => {
    const salvo = getConfig('diasAlertaDAS')
    if (salvo) setDiasAntes(parseInt(salvo))
    requestNotificationPermission().then(setNotifPermitida)

    setRazaoSocial(getConfig('razaoSocial') ?? '')
    setNomeFantasia(getConfig('nomeFantasia') ?? '')
    setCnpj(formatCNPJ(getConfig('cnpj') ?? ''))
    setAtividadePrincipal((getConfig('atividadePrincipal') as AtividadeId) ?? 'comercio')
    setTelefone(formatTelefone(getConfig('telefone') ?? ''))
    setCep(formatCEP(getConfig('cep') ?? ''))
    setLogradouro(getConfig('logradouro') ?? '')
    setNumero(getConfig('numero') ?? '')
    setComplemento(getConfig('complemento') ?? '')
    setBairro(getConfig('bairro') ?? '')
    setCidade(getConfig('cidade') ?? '')
    setUf(getConfig('uf') ?? '')
  }, []))

  function salvarPerfil() {
    setConfig('razaoSocial', razaoSocial.trim())
    setConfig('nomeFantasia', nomeFantasia.trim())
    setConfig('cnpj', cnpj.replace(/\D/g, ''))
    setConfig('atividadePrincipal', atividadePrincipal)
    setConfig('telefone', telefone.replace(/\D/g, ''))
    setConfig('cep', cep.replace(/\D/g, ''))
    setConfig('logradouro', logradouro.trim())
    setConfig('numero', numero.trim())
    setConfig('complemento', complemento.trim())
    setConfig('bairro', bairro.trim())
    setConfig('cidade', cidade.trim())
    setConfig('uf', uf.trim().toUpperCase().slice(0, 2))
    Alert.alert('Perfil salvo', 'Dados do MEI atualizados com sucesso.')
  }

  function salvarDias(dias: number) {
    setDiasAntes(dias)
    setConfig('diasAlertaDAS', String(dias))
    agendarAlertasDAS(getDasList(), dias)
  }

  async function testarNotificacao() {
    const ok = await requestNotificationPermission()
    if (!ok) {
      Alert.alert('Permissão negada', 'Ative as notificações nas configurações do celular.')
      return
    }
    await enviarNotificacaoTeste()
    Alert.alert('Teste enviado', 'A notificação aparecerá em 2 segundos.')
  }

  function confirmarReset() {
    Alert.alert('Apagar todos os dados', 'Esta ação é irreversível. Todos os lançamentos, DAS e configurações serão apagados.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar tudo', style: 'destructive', onPress: () =>
          Alert.alert('Confirmar exclusão', 'Tem certeza absoluta? Esta ação não pode ser desfeita.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Sim, apagar', style: 'destructive', onPress: () => { resetAllData(); router.replace('/ativar') } },
          ])
      },
    ])
  }

  return (
    <SafeAreaView style={[s.safe, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Configurações</Text>

        {/* PERFIL MEI */}
        <Text style={s.sectionTitle}>Meu Perfil MEI</Text>
        <View style={s.card}>
          <Field label="Razão Social" value={razaoSocial} onChangeText={setRazaoSocial} placeholder="Nome Empresarial Ltda" />
          <Field label="Nome Fantasia" value={nomeFantasia} onChangeText={setNomeFantasia} placeholder="Nome Fantasia (opcional)" />
          <Field
            label="CNPJ"
            value={cnpj}
            onChangeText={t => setCnpj(formatCNPJ(t))}
            placeholder="00.000.000/0001-00"
            keyboardType="numeric"
          />
          <Field
            label="Telefone / WhatsApp"
            value={telefone}
            onChangeText={t => setTelefone(formatTelefone(t))}
            placeholder="(61) 99999-9999"
            keyboardType="phone-pad"
          />

          <Text style={s.subLabel}>Atividade Principal</Text>
          {ATIVIDADES.map(a => (
            <TouchableOpacity
              key={a.id}
              style={[s.ativBtn, atividadePrincipal === a.id && s.ativBtnActive]}
              onPress={() => setAtividadePrincipal(a.id)}
            >
              <View style={[s.radio, atividadePrincipal === a.id && s.radioActive]}>
                {atividadePrincipal === a.id && <View style={s.radioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.ativLabel, atividadePrincipal === a.id && s.ativLabelActive]}>{a.label}</Text>
                <Text style={s.ativPct}>{(a.pct * 100).toFixed(0)}% tributável — lucro presumido</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ENDEREÇO */}
        <Text style={s.sectionTitle}>Endereço</Text>
        <View style={s.card}>
          <Field
            label="CEP"
            value={cep}
            onChangeText={t => setCep(formatCEP(t))}
            placeholder="00000-000"
            keyboardType="numeric"
          />
          <Field label="Logradouro" value={logradouro} onChangeText={setLogradouro} placeholder="Rua, Avenida..." />
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Field label="Número" value={numero} onChangeText={setNumero} placeholder="123" keyboardType="numeric" />
            </View>
            <View style={{ width: 8 }} />
            <View style={{ flex: 2 }}>
              <Field label="Complemento" value={complemento} onChangeText={setComplemento} placeholder="Sala 01" />
            </View>
          </View>
          <Field label="Bairro" value={bairro} onChangeText={setBairro} placeholder="Centro" />
          <View style={s.row}>
            <View style={{ flex: 3 }}>
              <Field label="Cidade" value={cidade} onChangeText={setCidade} placeholder="Brasília" />
            </View>
            <View style={{ width: 8 }} />
            <View style={{ flex: 1 }}>
              <Field label="UF" value={uf} onChangeText={t => setUf(t.toUpperCase().slice(0, 2))} placeholder="DF" autoCapitalize="characters" />
            </View>
          </View>
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={salvarPerfil}>
          <Text style={s.saveBtnText}>Salvar perfil</Text>
        </TouchableOpacity>

        {/* ALERTAS DAS */}
        <Text style={s.sectionTitle}>Alertas de DAS</Text>
        <View style={s.card}>
          <Text style={s.cardLabel}>Avisar quantos dias antes do vencimento?</Text>
          <View style={s.diasRow}>
            {DIAS_OPCOES.map(d => (
              <TouchableOpacity key={d} style={[s.diaBtn, diasAntes === d && s.diaBtnActive]} onPress={() => salvarDias(d)}>
                <Text style={[s.diaBtnText, diasAntes === d && s.diaBtnTextActive]}>{d}d</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={s.testBtn} onPress={testarNotificacao}>
            <Text style={s.testBtnText}>Testar notificação agora</Text>
          </TouchableOpacity>
          {!notifPermitida && (
            <Text style={s.aviso}>⚠️ Notificações desativadas. Ative nas configurações do celular.</Text>
          )}
        </View>

        {/* BACKUP */}
        <Text style={s.sectionTitle}>Backup automático</Text>
        <View style={[s.card, s.backupCard]}>
          <Text style={s.backupIcon}>☁️</Text>
          <Text style={s.backupTitle}>Seus dados estão protegidos</Text>
          <Text style={s.backupDesc}>
            O app salva automaticamente todos os seus dados no Google Drive da sua conta, quando o celular estiver carregando e conectado ao Wi-Fi — igual ao WhatsApp.
          </Text>
          <View style={s.backupDivider} />
          <Text style={s.backupDesc}>
            <Text style={{ fontWeight: '700' }}>Para restaurar:</Text> reinstale o app no mesmo celular ou em um novo dispositivo com a mesma conta Google. Os dados voltam automaticamente.
          </Text>
          <View style={[s.backupPill, { marginTop: 12 }]}>
            <Text style={s.backupPillText}>🔐 Código de ativação não é salvo no backup por segurança</Text>
          </View>
        </View>

        {/* SOBRE */}
        <Text style={s.sectionTitle}>Sobre</Text>
        <View style={s.card}>
          {[
            ['Produto', 'MEI Control Pro — PRO'],
            ['Versão', Constants.expoConfig?.version ?? '1.1.0'],
            ['Desenvolvido por', 'sismeipro.com.br'],
            ['Limite MEI 2025', 'R$ 81.000,00/ano'],
          ].map(([label, value]) => (
            <View key={label} style={s.infoRow}>
              <Text style={s.infoLabel}>{label}</Text>
              <Text style={s.infoValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* ZONA DE PERIGO */}
        <Text style={[s.sectionTitle, { color: COLORS.danger }]}>Zona de perigo</Text>
        <TouchableOpacity style={s.dangerBtn} onPress={confirmarReset}>
          <Text style={s.dangerBtnText}>Apagar todos os dados</Text>
        </TouchableOpacity>
        <Text style={s.dangerHint}>
          Remove todos os lançamentos, DAS e configurações. O app retornará para a tela de ativação.
        </Text>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize }: {
  label: string
  value: string
  onChangeText: (t: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'phone-pad' | 'email-address'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
}) {
  return (
    <>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textLight}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'words'}
        autoCorrect={false}
      />
    </>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 16, paddingTop: 20, paddingBottom: 40 },
  title: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  sectionTitle: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text, marginBottom: 10, marginTop: 8 },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 16, marginBottom: 16 },
  subLabel: { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.text, marginBottom: 10, marginTop: 4 },
  label: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: FONTS.base,
    color: COLORS.text, backgroundColor: COLORS.bg, marginBottom: 14,
  },
  row: { flexDirection: 'row' },
  ativBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: 10,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 8,
  },
  ativBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: COLORS.primary },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  ativLabel: { fontSize: FONTS.sm, color: COLORS.textMuted, fontWeight: '600' },
  ativLabelActive: { color: COLORS.primary },
  ativPct: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 14, alignItems: 'center', marginBottom: 24,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: FONTS.base },
  cardLabel: { fontSize: FONTS.sm, color: COLORS.textMuted, marginBottom: 12 },
  diasRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  diaBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  diaBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  diaBtnText: { fontSize: FONTS.sm, color: COLORS.textMuted, fontWeight: '600' },
  diaBtnTextActive: { color: '#fff' },
  testBtn: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.md, padding: 10, alignItems: 'center' },
  testBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: FONTS.sm },
  aviso: { fontSize: FONTS.sm, color: COLORS.warning, marginTop: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel: { fontSize: FONTS.sm, color: COLORS.textMuted },
  infoValue: { fontSize: FONTS.sm, color: COLORS.text, fontWeight: '600', flex: 1, textAlign: 'right' },
  backupCard: { alignItems: 'center', paddingVertical: 20 },
  backupIcon: { fontSize: 36, marginBottom: 8 },
  backupTitle: { fontSize: FONTS.md, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  backupDesc: { fontSize: FONTS.sm, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  backupDivider: { height: 1, backgroundColor: COLORS.border, width: '100%', marginVertical: 12 },
  backupPill: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 6 },
  backupPillText: { fontSize: 11, color: COLORS.primary, fontWeight: '600', textAlign: 'center' },
  dangerBtn: { backgroundColor: COLORS.dangerLight, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.danger },
  dangerBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: FONTS.base },
  dangerHint: { fontSize: FONTS.sm, color: COLORS.textMuted, marginTop: 8, lineHeight: 18 },
})
