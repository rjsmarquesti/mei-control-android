import { useEffect } from 'react'
import { Tabs, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/theme'
import { getConfig, setConfig, criarRecorrenciasMensais } from '../../lib/db'
import { fetchMeiConfig } from '../../lib/mei-config'
import { agendarLembreteMensalDAS } from '../../lib/notifications'
import { getToken, clearAuth } from '../../lib/secure'
import { verifyTokenOnline } from '../../lib/activation'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

function TabIcon({ name, focused }: { name: IoniconName; focused: boolean }) {
  return <Ionicons name={name} size={22} color={focused ? COLORS.primary : COLORS.textLight} />
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets()

  useEffect(() => {
    async function checkAuth() {
      const token = await getToken()
      if (!token) {
        router.replace('/ativar')
        return
      }

      fetchMeiConfig()
      agendarLembreteMensalDAS().catch(() => {})
      criarRecorrenciasMensais()

      // Revalida online a cada 7 dias — silencioso, não bloqueia o usuário
      const lastVerified = parseInt(getConfig('lastTokenVerified') ?? '0')
      const sevenDays = 7 * 24 * 60 * 60 * 1000
      if (Date.now() - lastVerified > sevenDays) {
        verifyTokenOnline(token).then(valid => {
          if (!valid) {
            clearAuth().then(() => router.replace('/ativar'))
          } else {
            setConfig('lastTokenVerified', String(Date.now()))
          }
        })
      }
    }
    checkAuth()
  }, [])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          paddingBottom: insets.bottom + 4,
          height: 58 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Início', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} /> }} />
      <Tabs.Screen name="das" options={{ title: 'DAS', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'receipt' : 'receipt-outline'} focused={focused} /> }} />
      <Tabs.Screen name="financeiro" options={{ title: 'Financeiro', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'wallet' : 'wallet-outline'} focused={focused} /> }} />
      <Tabs.Screen name="irpf" options={{ title: 'IRPF', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'calculator' : 'calculator-outline'} focused={focused} /> }} />
      <Tabs.Screen name="configuracoes" options={{ title: 'Config', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'settings' : 'settings-outline'} focused={focused} /> }} />
    </Tabs>
  )
}
