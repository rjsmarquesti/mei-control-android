import { Redirect } from 'expo-router'
import { getConfig } from '../lib/db'

export default function Index() {
  const activated = getConfig('activated')
  return activated === 'true'
    ? <Redirect href="/(tabs)/dashboard" />
    : <Redirect href="/ativar" />
}
