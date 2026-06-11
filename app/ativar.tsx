import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import { validateCode } from '../lib/activation'
import { setConfig, getConfig } from '../lib/db'
import { COLORS, FONTS, RADIUS } from '../constants/theme'

const APP_VERSION = Constants.expoConfig?.version ?? '1.0'

const MAX_TENTATIVAS = 5
const LOCKOUT_MS = 30 * 60 * 1000  // 30 minutos
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getTentativas(): number {
  return parseInt(getConfig('activationAttempts') ?? '0')
}

function getLockedUntil(): number {
  return parseInt(getConfig('activationLockedUntil') ?? '0')
}

export default function AtivarScreen() {
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [tentativas, setTentativas] = useState(0)
  const [segundosRestantes, setSegundosRestantes] = useState(0)

  useEffect(() => {
    setTentativas(getTentativas())
    verificarLockout()
  }, [])

  useEffect(() => {
    if (segundosRestantes <= 0) return
    const t = setInterval(() => {
      setSegundosRestantes(s => {
        if (s <= 1) { clearInterval(t); setTentativas(0); setConfig('activationAttempts', '0'); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [segundosRestantes])

  function verificarLockout() {
    const lockedUntil = getLockedUntil()
    if (lockedUntil > Date.now()) {
      const restante = Math.ceil((lockedUntil - Date.now()) / 1000)
      setSegundosRestantes(restante)
    }
  }

  function formatarTempo(seg: number): string {
    const m = Math.floor(seg / 60)
    const s = seg % 60
    return m > 0 ? `${m}min ${s}s` : `${s}s`
  }

  async function handleAtivar() {
    const lockedUntil = getLockedUntil()
    if (lockedUntil > Date.now()) {
      verificarLockout()
      return
    }

    const emailTrimmed = email.trim().toLowerCase()
    const codigoTrimmed = codigo.trim().toUpperCase()

    if (!emailTrimmed || !codigoTrimmed) {
      Alert.alert('Campos obrigatórios', 'Preencha o e-mail e o código de ativação.')
      return
    }

    if (!EMAIL_REGEX.test(emailTrimmed)) {
      Alert.alert('E-mail inválido', 'Informe um endereço de e-mail válido.')
      return
    }

    setLoading(true)
    try {
      const ok = await validateCode(emailTrimmed, codigoTrimmed)
      if (!ok) {
        const novas = getTentativas() + 1
        setConfig('activationAttempts', String(novas))
        setTentativas(novas)

        if (novas >= MAX_TENTATIVAS) {
          const ate = Date.now() + LOCKOUT_MS
          setConfig('activationLockedUntil', String(ate))
          setSegundosRestantes(LOCKOUT_MS / 1000)
          Alert.alert(
            'Muitas tentativas',
            `Você excedeu ${MAX_TENTATIVAS} tentativas. Tente novamente em 30 minutos.`
          )
        } else {
          const restam = MAX_TENTATIVAS - novas
          Alert.alert(
            'Código inválido',
            `Verifique o e-mail e o código.\n${restam} tentativa${restam > 1 ? 's' : ''} restante${restam > 1 ? 's' : ''}.`
          )
        }
        return
      }

      setConfig('activated', 'true')
      setConfig('email', emailTrimmed)
      setConfig('activationAttempts', '0')
      setConfig('activationLockedUntil', '0')
      router.replace('/(tabs)/dashboard')
    } catch {
      Alert.alert('Erro', 'Não foi possível validar o código. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const bloqueado = segundosRestantes > 0

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.logoBox}>
          <Image
            source={require('../assets/logo-sismei.webp')}
            style={s.logoImg}
            resizeMode="contain"
          />
          <Text style={s.badge}>PRO</Text>
          <Text style={s.version}>v{APP_VERSION}</Text>
        </View>

        <Text style={s.title}>Ativar aplicativo</Text>
        <Text style={s.sub}>
          Insira o e-mail usado na compra e o código recebido por WhatsApp ou e-mail.
        </Text>

        {bloqueado && (
          <View style={s.lockBox}>
            <Text style={s.lockIcon}>🔒</Text>
            <Text style={s.lockText}>Muitas tentativas incorretas.</Text>
            <Text style={s.lockTimer}>Tente novamente em {formatarTempo(segundosRestantes)}</Text>
          </View>
        )}

        <View style={s.form}>
          <Text style={s.label}>E-mail</Text>
          <TextInput
            style={[s.input, bloqueado && s.inputDisabled]}
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            placeholderTextColor={COLORS.textLight}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!bloqueado}
          />

          <Text style={s.label}>Código de ativação</Text>
          <TextInput
            style={[s.input, s.codeInput, bloqueado && s.inputDisabled]}
            value={codigo}
            onChangeText={t => setCodigo(t.toUpperCase())}
            placeholder="Ex: A1B2C3D4"
            placeholderTextColor={COLORS.textLight}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            editable={!bloqueado}
          />

          {!bloqueado && tentativas > 0 && (
            <Text style={s.tentativasText}>
              {MAX_TENTATIVAS - tentativas} tentativa{MAX_TENTATIVAS - tentativas !== 1 ? 's' : ''} restante{MAX_TENTATIVAS - tentativas !== 1 ? 's' : ''}
            </Text>
          )}

          <TouchableOpacity
            style={[s.btn, (loading || bloqueado) && s.btnDisabled]}
            onPress={handleAtivar}
            disabled={loading || bloqueado}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>{bloqueado ? `Bloqueado (${formatarTempo(segundosRestantes)})` : 'Ativar agora'}</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={s.help}>
          Não recebeu o código? Entre em contato pelo WhatsApp da sismeipro.com.br
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoBox: { alignItems: 'center', marginBottom: 32 },
  logoImg: { width: 120, height: 120, marginBottom: 8 },
  badge: {
    marginTop: 8, backgroundColor: COLORS.primaryLight, color: COLORS.primary,
    paddingHorizontal: 12, paddingVertical: 3, borderRadius: RADIUS.full,
    fontSize: FONTS.sm, fontWeight: '700', overflow: 'hidden',
  },
  title: { fontSize: FONTS['2xl'], fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  sub: { fontSize: FONTS.base, color: COLORS.textMuted, marginBottom: 28, lineHeight: 20 },
  lockBox: {
    backgroundColor: COLORS.dangerLight, borderRadius: RADIUS.lg,
    padding: 16, alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.danger,
  },
  lockIcon: { fontSize: 28, marginBottom: 6 },
  lockText: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.danger },
  lockTimer: { fontSize: FONTS.sm, color: COLORS.danger, marginTop: 4 },
  form: { gap: 8 },
  label: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: FONTS.base,
    color: COLORS.text, backgroundColor: COLORS.card, marginBottom: 16,
  },
  inputDisabled: { opacity: 0.5 },
  codeInput: { letterSpacing: 4, textAlign: 'center', fontSize: FONTS.lg, fontWeight: '700' },
  tentativasText: { fontSize: FONTS.sm, color: COLORS.warning, marginBottom: 8, textAlign: 'center' },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: FONTS.md, fontWeight: '700' },
  help: { marginTop: 24, fontSize: FONTS.sm, color: COLORS.textLight, textAlign: 'center', lineHeight: 18 },
  version: { fontSize: FONTS.xs ?? 11, color: COLORS.textLight, marginTop: 4 },
})
