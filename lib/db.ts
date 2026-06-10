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
    `INSERT INTO transactions (type, descricao, valor, data, categoria, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
    [t.type, t.descricao, t.valor, t.data, t.categoria, t.createdAt]
  )
}

export function getTransactions(prefixo?: string): Transaction[] {
  const db = getDB()
  if (prefixo) {
    return db.getAllSync<Transaction>(
      `SELECT * FROM transactions WHERE data LIKE ? ORDER BY data DESC`,
      [`${prefixo}%`]
    )
  }
  return db.getAllSync<Transaction>(`SELECT * FROM transactions ORDER BY data DESC`)
}

export function deleteTransaction(id: number): void {
  const db = getDB()
  db.runSync(`DELETE FROM transactions WHERE id = ?`, [id])
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

export function marcarDasPago(competencia: string, pagadoEm: string): void {
  const db = getDB()
  db.runSync(`UPDATE das SET pago = 1, pagadoEm = ? WHERE competencia = ?`, [pagadoEm, competencia])
}

export function deleteDas(id: number): void {
  const db = getDB()
  db.runSync(`DELETE FROM das WHERE id = ?`, [id])
}
