import { getMeiConfig } from './mei-config'

export const ATIVIDADES = [
  { id: 'comercio', label: 'Comércio / Indústria', pct: 0.08 },
  { id: 'servicos', label: 'Serviços em geral', pct: 0.32 },
  { id: 'transporte_carga', label: 'Transporte de carga', pct: 0.08 },
  { id: 'transporte_passageiros', label: 'Transporte de passageiros', pct: 0.16 },
  { id: 'profissional', label: 'Serviços profissionais', pct: 0.32 },
] as const

export type AtividadeId = (typeof ATIVIDADES)[number]['id']

export interface SimulacaoIRPF {
  receitaBruta: number
  dasPago: number
  atividade: AtividadeId
  rendimentoIsento: number
  rendimentoTributavel: number
  baseCalculo: number
  impostoDue: number
  aliquotaEfetiva: number
}

function calcularImpostoProgressivo(base: number): number {
  if (base <= 0) return 0
  const faixas = getMeiConfig().tabelaIRPF
  for (const faixa of faixas) {
    if (base <= faixa.limite) {
      return Math.max(0, base * faixa.aliquota - faixa.deducao)
    }
  }
  return 0
}

export function simularIRPF(
  receitaBruta: number,
  dasPago: number,
  atividade: AtividadeId
): SimulacaoIRPF {
  const pct = ATIVIDADES.find(a => a.id === atividade)?.pct ?? 0.32
  const rendimentoTributavel = receitaBruta * pct
  const rendimentoIsento = receitaBruta - rendimentoTributavel
  const baseCalculo = Math.max(0, rendimentoTributavel - dasPago)
  const impostoDue = calcularImpostoProgressivo(baseCalculo)
  const aliquotaEfetiva = receitaBruta > 0 ? (impostoDue / receitaBruta) * 100 : 0

  return { receitaBruta, dasPago, atividade, rendimentoIsento, rendimentoTributavel, baseCalculo, impostoDue, aliquotaEfetiva }
}
