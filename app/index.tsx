import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Redirect } from 'expo-router'
import { getToken } from '../lib/secure'
import { COLORS } from '../constants/theme'

export default function Index() {
  const [ready, setReady] = useState(false)
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    getToken().then(token => {
      setHasToken(!!token)
      setReady(true)
    })
  }, [])

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg }}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )
  }

  return hasToken
    ? <Redirect href="/(tabs)/dashboard" />
    : <Redirect href="/ativar" />
}
