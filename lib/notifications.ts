import * as Notifications from 'expo-notifications'
import { DasRow } from './db'

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

export async function agendarAlertasDAS(das: DasRow[], diasAntes: number): Promise<void> {
  const granted = await requestNotificationPermission()
  if (!granted) return

  await Notifications.cancelAllScheduledNotificationsAsync()

  const hoje = new Date()

  for (const d of das) {
    if (d.pago) continue

    const venc = new Date(d.vencimento + 'T00:00:00')
    const alerta = new Date(venc)
    alerta.setDate(alerta.getDate() - diasAntes)

    if (alerta > hoje) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📅 DAS vence em breve',
          body: `Competência ${d.competencia} vence em ${diasAntes} dia${diasAntes !== 1 ? 's' : ''} (${d.vencimento}).`,
          data: { competencia: d.competencia },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: alerta },
      })
    }

    if (venc > hoje) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ DAS vence hoje!',
          body: `Competência ${d.competencia} vence hoje. Evite multa e juros.`,
          data: { competencia: d.competencia },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: venc },
      })
    }
  }
}

export async function enviarNotificacaoTeste(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ Notificações funcionando',
      body: 'Você receberá alertas de DAS conforme configurado.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
  })
}
