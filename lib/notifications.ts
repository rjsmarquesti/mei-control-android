import * as Notifications from 'expo-notifications'
import { DasRow, getConfig, setConfig } from './db'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export async function agendarAlertasProgressivosDAS(
  das: DasRow[],
  diasAntes: number[] = [15, 7, 1]
): Promise<void> {
  const granted = await requestNotificationPermission()
  if (!granted) return

  // Cancela apenas notificações de DAS — preserva lembrete mensal e alertas de limite
  const agendadas = await Notifications.getAllScheduledNotificationsAsync()
  const dasCancelIds = agendadas
    .filter(n => n.content.data?.tipo === 'alerta_das')
    .map(n => n.identifier)
  await Promise.all(dasCancelIds.map(id => Notifications.cancelScheduledNotificationAsync(id)))

  const hoje = new Date()

  for (const d of das) {
    if (d.pago) continue
    const venc = new Date(d.vencimento + 'T00:00:00')

    for (const dias of diasAntes) {
      const alerta = new Date(venc)
      alerta.setDate(alerta.getDate() - dias)
      if (alerta > hoje) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: dias === 1 ? '⚠️ DAS vence amanhã!' : `📅 DAS vence em ${dias} dias`,
            body: `Competência ${d.competencia} vence em ${d.vencimento}. Evite multa de 2% + juros.`,
            data: { tipo: 'alerta_das', competencia: d.competencia },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: alerta },
        })
      }
    }

    // Alerta no próprio dia do vencimento
    if (venc > hoje) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚨 DAS vence hoje!',
          body: `Competência ${d.competencia} vence hoje. Pague agora para evitar multa.`,
          data: { tipo: 'alerta_das', competencia: d.competencia },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: venc },
      })
    }
  }
}

// Alias para compatibilidade — uso interno legado
export async function agendarAlertasDAS(das: DasRow[], _diasAntes: number): Promise<void> {
  return agendarAlertasProgressivosDAS(das)
}

export async function agendarLembreteMensalDAS(): Promise<void> {
  const granted = await requestNotificationPermission()
  if (!granted) return
  if (getConfig('lembreteMensalAgendado') === 'true') return

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📋 Emitir DAS deste mês',
      body: 'Não esqueça de emitir e registrar o DAS no PGMEI.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      repeats: true,
      day: 5,
      hour: 9,
      minute: 0,
    },
  })
  setConfig('lembreteMensalAgendado', 'true')
}

export async function verificarAlerteLimiteMEI(receitaAnual: number, limiteAnual: number): Promise<void> {
  if (receitaAnual <= 0) return
  const ano = String(new Date().getFullYear())
  const pct = receitaAnual / limiteAnual

  if (pct >= 0.90 && getConfig('alertaLimite90Ano') !== ano) {
    setConfig('alertaLimite90Ano', ano)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 90% do limite MEI atingido!',
        body: `Receita anual de R$ ${receitaAnual.toLocaleString('pt-BR')}. Consulte um contador sobre migração para ME.`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
    })
  } else if (pct >= 0.75 && getConfig('alertaLimite75Ano') !== ano) {
    setConfig('alertaLimite75Ano', ano)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ 75% do limite MEI atingido',
        body: `Receita anual de R$ ${receitaAnual.toLocaleString('pt-BR')}. Fique atento ao limite de R$ ${limiteAnual.toLocaleString('pt-BR')}.`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
    })
  }
}

export async function enviarNotificacaoTeste(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ Notificações funcionando',
      body: 'Você receberá alertas de DAS 15, 7 e 1 dia antes do vencimento.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
  })
}
