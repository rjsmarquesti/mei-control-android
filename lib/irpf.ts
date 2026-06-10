// Porta direta de sismei-lowticket/lib/irpf.ts — lógica pura sem deps de browser

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

// Tabela progressiva IRPF 2024 (anual)
const FAIXAS = [
  { limite: 22847.76, aliquota: 0, deducao: 0 },
  { limite: 33919.80, aliquota: 0.075, deducao: 1713.58 },
  { limite: 45012.60, aliquota: 0.15, deducao: 4257.57 },
  { limite: 55976.16, aliquota: 0.225, deducao: 7633.51 },
  { limite: Infinity, aliquota: 0.275, deducao: 10432.32 },
]

function calcularImpostoProgressivo(base: number): number {
  if (base <= 0) return 0
  for (const faixa of FAIXAS) {
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
