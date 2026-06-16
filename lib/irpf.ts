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

export interface ComparacaoMEIvsME {
  receitaBruta: number
  custoMEI: number
  custoME: number
  economiaMEI: number
  aliquotaMEIPct: number
  aliquotaMEPct: number
}

const TABELA_2024 = [
  { limite: 22847.76, aliquota: 0, deducao: 0 },
  { limite: 33919.80, aliquota: 0.075, deducao: 1713.58 },
  { limite: 45012.60, aliquota: 0.15, deducao: 4257.57 },
  { limite: 55976.16, aliquota: 0.225, deducao: 7633.51 },
  { limite: 999999999, aliquota: 0.275, deducao: 10432.32 },
]

const TABELA_2025 = [
  { limite: 33888.00, aliquota: 0, deducao: 0 },
  { limite: 45012.60, aliquota: 0.075, deducao: 2541.60 },
  { limite: 61704.00, aliquota: 0.15, deducao: 5909.88 },
  { limite: 77196.00, aliquota: 0.225, deducao: 10542.00 },
  { limite: 999999999, aliquota: 0.275, deducao: 14404.92 },
]

export const TABELAS_IRPF: Record<number, typeof TABELA_2024> = {
  2024: TABELA_2024,
  2025: TABELA_2025,
}

function calcularImposto(base: number, tabela: typeof TABELA_2024): number {
  if (base <= 0) return 0
  for (const faixa of tabela) {
    if (base <= faixa.limite) {
      return Math.max(0, base * faixa.aliquota - faixa.deducao)
    }
  }
  return 0
}

function calcularImpostoProgressivo(base: number): number {
  return calcularImposto(base, getMeiConfig().tabelaIRPF)
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

export function simularIRPFAno(
  receitaBruta: number,
  dasPago: number,
  atividade: AtividadeId,
  ano: number
): SimulacaoIRPF {
  const pct = ATIVIDADES.find(a => a.id === atividade)?.pct ?? 0.32
  const rendimentoTributavel = receitaBruta * pct
  const rendimentoIsento = receitaBruta - rendimentoTributavel
  const baseCalculo = Math.max(0, rendimentoTributavel - dasPago)
  const tabela = TABELAS_IRPF[ano] ?? getMeiConfig().tabelaIRPF
  const impostoDue = calcularImposto(baseCalculo, tabela)
  const aliquotaEfetiva = receitaBruta > 0 ? (impostoDue / receitaBruta) * 100 : 0
  return { receitaBruta, dasPago, atividade, rendimentoIsento, rendimentoTributavel, baseCalculo, impostoDue, aliquotaEfetiva }
}

const ALIQUOTA_SIMPLES: Record<AtividadeId, number> = {
  comercio: 0.04,
  transporte_carga: 0.04,
  servicos: 0.06,
  transporte_passageiros: 0.06,
  profissional: 0.06,
}

export function simularMEIvsME(receitaBruta: number, atividade: AtividadeId): ComparacaoMEIvsME {
  const custoMEI = getMeiConfig().valorDAS * 12
  const aliquotaME = ALIQUOTA_SIMPLES[atividade]
  const custoME = receitaBruta * aliquotaME
  const economiaMEI = custoME - custoMEI
  return {
    receitaBruta,
    custoMEI,
    custoME,
    economiaMEI,
    aliquotaMEIPct: receitaBruta > 0 ? (custoMEI / receitaBruta) * 100 : 0,
    aliquotaMEPct: aliquotaME * 100,
  }
}
