import { getConfig, setConfig } from './db'

const API_URL = 'https://app.sismeipro.com.br/api/mei-config'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h

export interface MeiConfig {
  valorDAS: number
  limiteAnualMEI: number
  tabelaIRPF: { limite: number; aliquota: number; deducao: number }[]
}

const DEFAULTS: MeiConfig = {
  valorDAS: 75.90,
  limiteAnualMEI: 81000,
  tabelaIRPF: [
    { limite: 22847.76, aliquota: 0, deducao: 0 },
    { limite: 33919.80, aliquota: 0.075, deducao: 1713.58 },
    { limite: 45012.60, aliquota: 0.15, deducao: 4257.57 },
    { limite: 55976.16, aliquota: 0.225, deducao: 7633.51 },
    { limite: 999999999, aliquota: 0.275, deducao: 10432.32 },
  ],
}

function loadCached(): MeiConfig | null {
  try {
    const raw = getConfig('meiConfigCache')
    const ts = getConfig('meiConfigCachedAt')
    if (!raw || !ts) return null
    if (Date.now() - parseInt(ts) > CACHE_TTL_MS) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveCache(config: MeiConfig) {
  try {
    setConfig('meiConfigCache', JSON.stringify(config))
    setConfig('meiConfigCachedAt', String(Date.now()))
  } catch { /* sem crash em falha de cache */ }
}

export function getMeiConfig(): MeiConfig {
  const cached = loadCached()
  return cached ?? DEFAULTS
}

export async function fetchMeiConfig(): Promise<void> {
  try {
    const res = await fetch(API_URL, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return
    const data: MeiConfig = await res.json()
    if (data.valorDAS && data.limiteAnualMEI && Array.isArray(data.tabelaIRPF)) {
      saveCache(data)
    }
  } catch { /* falha silenciosa — usa fallback/cache */ }
}
