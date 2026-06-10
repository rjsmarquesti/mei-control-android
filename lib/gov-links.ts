import { Linking, Alert } from 'react-native'

const GOV_LINKS = {
  pgmei: 'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao',
  situacaoFiscal: 'https://www.regularize.pgfn.gov.br',
  cnpj: 'https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/Cnpjreva_Solicitacao.asp',
  simplesNacional: 'https://www8.receita.fazenda.gov.br/SimplesNacional/',
} as const

export type GovLinkKey = keyof typeof GOV_LINKS

export async function openGovLink(key: GovLinkKey): Promise<void> {
  const url = GOV_LINKS[key]
  let canOpen = false
  try {
    canOpen = await Linking.canOpenURL(url)
  } catch {
    canOpen = false
  }
  if (!canOpen) {
    Alert.alert(
      'Sem conexão',
      'Você precisa de internet para acessar o site do governo federal.',
      [{ text: 'OK' }]
    )
    return
  }
  await Linking.openURL(url)
}
