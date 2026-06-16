import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { Transaction } from './db'

export async function exportFinanceiroCSV(transactions: Transaction[], mesAno: string): Promise<void> {
  const header = 'Data,Descrição,Categoria,Tipo,Valor\n'
  const rows = transactions.map(t => {
    const desc = `"${t.descricao.replace(/"/g, '""')}"`
    return `${t.data},${desc},${t.categoria},${t.type},${t.valor.toFixed(2).replace('.', ',')}`
  }).join('\n')

  const fileUri = `${FileSystem.documentDirectory}Financeiro-${mesAno}.csv`
  await FileSystem.writeAsStringAsync(fileUri, header + rows, { encoding: FileSystem.EncodingType.UTF8 })
  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: `Exportar CSV — ${mesAno}`,
    UTI: 'public.comma-separated-values-text',
  })
}
