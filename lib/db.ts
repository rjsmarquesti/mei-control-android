import * as SQLite from 'expo-sqlite'

let _db: SQLite.SQLiteDatabase | null = null

function getDB(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('MeiControlKit.db')
    _db.execSync(`PRAGMA journal_mode = WAL;`)
    _db.execSync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        descricao TEXT NOT NULL,
        valor REAL NOT NULL,
        data TEXT NOT NULL,
        categoria TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS das (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competencia TEXT NOT NULL UNIQUE,
        valor REAL NOT NULL,
        vencimento TEXT NOT NULL,
        pago INTEGER NOT NULL DEFAULT 0,
        pagadoEm TEXT
      );
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
    // Migrations — safe ALTER TABLE (ignora erro se coluna já existe)
    try { _db.execSync(`ALTER TABLE transactions ADD COLUMN recorrente INTEGER NOT NULL DEFAULT 0`) } catch {}
    try { _db.execSync(`ALTER TABLE transactions ADD COLUMN recorrencia_dia INTEGER`) } catch {}
  }
  return _db
}

export interface Transaction {
  id?: number
  type: 'receita' | 'despesa'
  descricao: string
  valor: number
  data: string
  categoria: string
  createdAt: number
  recorrente?: boolean
  recorrenciaDia?: number
}

export interface DasRow {
  id?: number
  competencia: string
  valor: number
  vencimento: string
  pago: boolean
  pagadoEm?: string
}

// --- Config ---
export function getConfig(key: string): string | null {
  const db = getDB()
  const row = db.getFirstSync<{ value: string }>(`SELECT value FROM config WHERE key = ?`, [key])
  return row?.value ?? null
}

export function setConfig(key: string, value: string): void {
  const db = getDB()
  db.runSync(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`, [key, value])
}

export function resetAllData(): void {
  const db = getDB()
  db.execSync(`DELETE FROM transactions; DELETE FROM das; DELETE FROM config;`)
}

// --- Transactions ---
export function insertTransaction(t: Omit<Transaction, 'id'>): void {
  const db = getDB()
  db.runSync(
    `INSERT INTO transactions (type, descricao, valor, data, categoria, createdAt, recorrente, recorrencia_dia) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [t.type, t.descricao, t.valor, t.data, t.categoria, t.createdAt, t.recorrente ? 1 : 0, t.recorrenciaDia ?? null]
  )
}

export function updateTransaction(id: number, t: Omit<Transaction, 'id' | 'createdAt'>): void {
  const db = getDB()
  db.runSync(
    `UPDATE transactions SET type=?, descricao=?, valor=?, data=?, categoria=?, recorrente=?, recorrencia_dia=? WHERE id=?`,
    [t.type, t.descricao, t.valor, t.data, t.categoria, t.recorrente ? 1 : 0, t.recorrenciaDia ?? null, id]
  )
}

export function getTransactions(prefixo?: string): Transaction[] {
  const db = getDB()
  const map = (r: any): Transaction => ({ ...r, recorrente: r.recorrente === 1 })
  if (prefixo) {
    return db.getAllSync<any>(
      `SELECT * FROM transactions WHERE data LIKE ? ORDER BY data DESC`,
      [`${prefixo}%`]
    ).map(map)
  }
  return db.getAllSync<any>(`SELECT * FROM transactions ORDER BY data DESC`).map(map)
}

export function deleteTransaction(id: number): void {
  const db = getDB()
  db.runSync(`DELETE FROM transactions WHERE id = ?`, [id])
}

export function getTransacoesRecorrentes(): Transaction[] {
  const db = getDB()
  return db.getAllSync<any>(`SELECT * FROM transactions WHERE recorrente = 1`).map(r => ({ ...r, recorrente: true }))
}

export function criarRecorrenciasMensais(): void {
  const db = getDB()
  const hoje = new Date()
  const mesStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const recorrentes = getTransacoesRecorrentes()

  for (const t of recorrentes) {
    const dia = t.recorrenciaDia ?? parseInt(t.data.slice(8, 10))
    const dataStr = `${mesStr}-${String(dia).padStart(2, '0')}`
    const count = db.getFirstSync<{ n: number }>(
      `SELECT COUNT(*) as n FROM transactions WHERE type=? AND descricao=? AND categoria=? AND data LIKE ?`,
      [t.type, t.descricao, t.categoria, `${mesStr}%`]
    )
    if (!count || count.n === 0) {
      insertTransaction({ type: t.type, descricao: t.descricao, valor: t.valor, data: dataStr, categoria: t.categoria, createdAt: Date.now(), recorrente: true, recorrenciaDia: dia })
    }
  }
}

// --- DAS ---
export function getDasList(): DasRow[] {
  const db = getDB()
  const rows = db.getAllSync<{
    id: number; competencia: string; valor: number
    vencimento: string; pago: number; pagadoEm: string | null
  }>(`SELECT * FROM das ORDER BY competencia DESC`)
  return rows.map(r => ({ ...r, pago: r.pago === 1, pagadoEm: r.pagadoEm ?? undefined }))
}

export function upsertDas(d: Omit<DasRow, 'id'>): void {
  const db = getDB()
  db.runSync(
    `INSERT OR REPLACE INTO das (competencia, valor, vencimento, pago, pagadoEm) VALUES (?, ?, ?, ?, ?)`,
    [d.competencia, d.valor, d.vencimento, d.pago ? 1 : 0, d.pagadoEm ?? null]
  )
}

export function updateDas(id: number, d: { competencia: string; valor: number; vencimento: string }): void {
  const db = getDB()
  db.runSync(
    `UPDATE das SET competencia=?, valor=?, vencimento=? WHERE id=?`,
    [d.competencia, d.valor, d.vencimento, id]
  )
}

export function marcarDasPago(competencia: string, pagadoEm: string): void {
  const db = getDB()
  db.runSync(`UPDATE das SET pago = 1, pagadoEm = ? WHERE competencia = ?`, [pagadoEm, competencia])
}

export function deleteDas(id: number): void {
  const db = getDB()
  db.runSync(`DELETE FROM das WHERE id = ?`, [id])
}
