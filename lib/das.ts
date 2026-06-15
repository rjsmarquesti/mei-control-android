import { getMeiConfig } from './mei-config'

export interface DasCalculo {
  valorOriginal: number
  multa: number
  juros: number
  total: number
  diasAtraso: number
  mesesAtraso: number
}

export function calcularDasComAtraso(
  valorOriginal: number,
  vencimento: string,
  multaPct = 2,
  jurosPctMes = 1
): DasCalculo {
  const hoje = new Date()
  const dataVenc = new Date(vencimento + 'T00:00:00')
  const diasAtraso = Math.max(0, Math.floor((hoje.getTime() - dataVenc.getTime()) / (1000 * 60 * 60 * 24)))
  const mesesAtraso = Math.ceil(diasAtraso / 30)

  if (diasAtraso === 0) {
    return { valorOriginal, multa: 0, juros: 0, total: valorOriginal, diasAtraso: 0, mesesAtraso: 0 }
  }

  const multa = valorOriginal * (multaPct / 100)
  const juros = valorOriginal * (jurosPctMes / 100) * mesesAtraso
  const total = valorOriginal + multa + juros

  return { valorOriginal, multa, juros, total, diasAtraso, mesesAtraso }
}

export function vencimentoDas(competencia: string): string {
  // competencia = YYYY-MM → vencimento = dia 20 do mês seguinte
  const [ano, mes] = competencia.split('-').map(Number)
  const proxMes = mes === 12 ? 1 : mes + 1
  const proxAno = mes === 12 ? ano + 1 : ano
  return `${proxAno}-${String(proxMes).padStart(2, '0')}-20`
}

export function valorDasMEI(): number {
  return getMeiConfig().valorDAS
}
