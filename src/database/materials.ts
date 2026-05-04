import { open } from '@op-engineering/op-sqlite';

export type Material = {
  id: string;
  nombre: string;
  precioPorLibra: number;
};

export type Purchase = {
  id: string;
  businessDate: string;
  fecha: string;
  materialId: string;
  material: string;
  precioPorLibra: number;
  libras: number;
  total: number;
};

export type Sale = {
  id: string;
  businessDate: string;
  fecha: string;
  descripcion: string;
  monto: number;
};

export type Expense = {
  id: string;
  businessDate: string;
  fecha: string;
  categoria: string;
  descripcion: string;
  monto: number;
};

export type DailyLedger = {
  businessDate: string;
  saldoInicial: number;
  saldoActual: number;
  totalCompras: number;
  totalVentas: number;
  totalGastos: number;
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
};

export type ExportPayload = {
  exportedAt: string;
  materials: Material[];
  ledgers: DailyLedger[];
};

type MaterialRow = {
  id: string;
  nombre: string;
  precio_por_libra: number;
};

type BalanceRow = {
  business_date: string;
  saldo_inicial: number;
  saldo_actual: number;
};

type PurchaseRow = {
  id: string;
  business_date: string;
  material_id: string;
  material_nombre: string;
  precio_por_libra: number;
  libras: number;
  total: number;
  created_at: string;
};

type SaleRow = {
  id: string;
  business_date: string;
  descripcion: string;
  monto: number;
  created_at: string;
};

type ExpenseRow = {
  id: string;
  business_date: string;
  categoria: string;
  descripcion: string;
  monto: number;
  created_at: string;
};

type QueryResult = {
  rows: Array<Record<string, unknown>>;
};

type Database = {
  execute: (query: string, params?: Array<string | number>) => Promise<QueryResult>;
};

const DB_NAME = 'rcontrol.sqlite';
const MATERIALS_TABLE = 'materials';
const BALANCES_TABLE = 'daily_balances';
const PURCHASES_TABLE = 'purchases';
const SALES_TABLE = 'sales';
const EXPENSES_TABLE = 'expenses';

const DEFAULT_MATERIALS: Material[] = [
  { id: 'hierro', nombre: 'Hierro', precioPorLibra: 1.8 },
  { id: 'aluminio', nombre: 'Aluminio', precioPorLibra: 6.5 },
  { id: 'cobre', nombre: 'Cobre', precioPorLibra: 22 },
];

let db: Database | null = null;
let databaseReady: Promise<void> | null = null;

const nowIso = (): string => new Date().toISOString();
const todayBusinessDate = (): string => nowIso().slice(0, 10);
const createId = (): string => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createDatabase = (): Database => {
  if (!db) {
    db = open({ name: DB_NAME });
  }

  return db;
};

const run = async (
  database: Database,
  query: string,
  params: Array<string | number> = [],
): Promise<QueryResult> => database.execute(query, params);

const fromMaterialRow = (row: Record<string, unknown>): Material => ({
  id: String(row.id),
  nombre: String(row.nombre),
  precioPorLibra: Number(row.precio_por_libra),
});

const fromBalanceRow = (row: Record<string, unknown>): BalanceRow => ({
  business_date: String(row.business_date),
  saldo_inicial: Number(row.saldo_inicial ?? 0),
  saldo_actual: Number(row.saldo_actual ?? 0),
});

const fromPurchaseRow = (row: Record<string, unknown>): Purchase => ({
  id: String(row.id),
  businessDate: String(row.business_date),
  fecha: new Date(String(row.created_at)).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  }),
  materialId: String(row.material_id),
  material: String(row.material_nombre),
  precioPorLibra: Number(row.precio_por_libra),
  libras: Number(row.libras),
  total: Number(row.total),
});

const fromSaleRow = (row: Record<string, unknown>): Sale => ({
  id: String(row.id),
  businessDate: String(row.business_date),
  fecha: new Date(String(row.created_at)).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  }),
  descripcion: String(row.descripcion),
  monto: Number(row.monto),
});

const fromExpenseRow = (row: Record<string, unknown>): Expense => ({
  id: String(row.id),
  businessDate: String(row.business_date),
  fecha: new Date(String(row.created_at)).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  }),
  categoria: String(row.categoria),
  descripcion: String(row.descripcion),
  monto: Number(row.monto),
});

const ensureDatabase = async (): Promise<Database> => {
  const database = createDatabase();

  if (!databaseReady) {
    databaseReady = (async () => {
      await run(
        database,
        `CREATE TABLE IF NOT EXISTS ${MATERIALS_TABLE} (
          id TEXT PRIMARY KEY NOT NULL,
          nombre TEXT NOT NULL UNIQUE,
          precio_por_libra REAL NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
      );

      await run(
        database,
        `CREATE TABLE IF NOT EXISTS ${BALANCES_TABLE} (
          business_date TEXT PRIMARY KEY NOT NULL,
          saldo_inicial REAL NOT NULL,
          saldo_actual REAL NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
      );

      await run(
        database,
        `CREATE TABLE IF NOT EXISTS ${PURCHASES_TABLE} (
          id TEXT PRIMARY KEY NOT NULL,
          business_date TEXT NOT NULL,
          material_id TEXT NOT NULL,
          material_nombre TEXT NOT NULL,
          precio_por_libra REAL NOT NULL,
          libras REAL NOT NULL,
          total REAL NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (business_date) REFERENCES ${BALANCES_TABLE} (business_date) ON DELETE CASCADE
        )`,
      );

      await run(
        database,
        `CREATE TABLE IF NOT EXISTS ${SALES_TABLE} (
          id TEXT PRIMARY KEY NOT NULL,
          business_date TEXT NOT NULL,
          descripcion TEXT NOT NULL,
          monto REAL NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (business_date) REFERENCES ${BALANCES_TABLE} (business_date) ON DELETE CASCADE
        )`,
      );

      await run(
        database,
        `CREATE TABLE IF NOT EXISTS ${EXPENSES_TABLE} (
          id TEXT PRIMARY KEY NOT NULL,
          business_date TEXT NOT NULL,
          categoria TEXT NOT NULL,
          descripcion TEXT NOT NULL,
          monto REAL NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (business_date) REFERENCES ${BALANCES_TABLE} (business_date) ON DELETE CASCADE
        )`,
      );

      const countResult = await run(database, `SELECT COUNT(*) AS total FROM ${MATERIALS_TABLE}`);
      const total = Number(countResult.rows[0]?.total ?? 0);

      if (total === 0) {
        const now = nowIso();

        for (const material of DEFAULT_MATERIALS) {
          await run(
            database,
            `INSERT INTO ${MATERIALS_TABLE} (id, nombre, precio_por_libra, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [material.id, material.nombre, material.precioPorLibra, now, now],
          );
        }
      }
    })();
  }

  await databaseReady;
  return database;
};

const ensureBalanceForDate = async (
  database: Database,
  businessDate: string,
): Promise<BalanceRow> => {
  const result = await run(
    database,
    `SELECT business_date, saldo_inicial, saldo_actual
     FROM ${BALANCES_TABLE}
     WHERE business_date = ?
     LIMIT 1`,
    [businessDate],
  );

  if (result.rows.length > 0) {
    return fromBalanceRow(result.rows[0]);
  }

  const now = nowIso();
  await run(
    database,
    `INSERT INTO ${BALANCES_TABLE} (business_date, saldo_inicial, saldo_actual, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [businessDate, 0, 0, now, now],
  );

  return {
    business_date: businessDate,
    saldo_inicial: 0,
    saldo_actual: 0,
  };
};

const loadTotals = async (database: Database, businessDate: string) => {
  const [purchaseTotals, saleTotals, expenseTotals] = await Promise.all([
    run(
      database,
      `SELECT COALESCE(SUM(total), 0) AS total FROM ${PURCHASES_TABLE} WHERE business_date = ?`,
      [businessDate],
    ),
    run(
      database,
      `SELECT COALESCE(SUM(monto), 0) AS total FROM ${SALES_TABLE} WHERE business_date = ?`,
      [businessDate],
    ),
    run(
      database,
      `SELECT COALESCE(SUM(monto), 0) AS total FROM ${EXPENSES_TABLE} WHERE business_date = ?`,
      [businessDate],
    ),
  ]);

  return {
    totalCompras: Number(purchaseTotals.rows[0]?.total ?? 0),
    totalVentas: Number(saleTotals.rows[0]?.total ?? 0),
    totalGastos: Number(expenseTotals.rows[0]?.total ?? 0),
  };
};

const recalculateBalance = async (database: Database, businessDate: string): Promise<BalanceRow> => {
  const balance = await ensureBalanceForDate(database, businessDate);
  const totals = await loadTotals(database, businessDate);
  const saldoActual = balance.saldo_inicial + totals.totalVentas - totals.totalCompras - totals.totalGastos;
  const now = nowIso();

  await run(
    database,
    `INSERT INTO ${BALANCES_TABLE} (business_date, saldo_inicial, saldo_actual, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(business_date) DO UPDATE SET
       saldo_inicial = excluded.saldo_inicial,
       saldo_actual = excluded.saldo_actual,
       updated_at = excluded.updated_at`,
    [businessDate, balance.saldo_inicial, saldoActual, now, now],
  );

  return {
    business_date: businessDate,
    saldo_inicial: balance.saldo_inicial,
    saldo_actual: saldoActual,
  };
};

const loadPurchasesForDate = async (database: Database, businessDate: string): Promise<Purchase[]> => {
  const result = await run(
    database,
    `SELECT id, business_date, material_id, material_nombre, precio_por_libra, libras, total, created_at
     FROM ${PURCHASES_TABLE}
     WHERE business_date = ?
     ORDER BY created_at DESC`,
    [businessDate],
  );

  return result.rows.map(row => fromPurchaseRow(row));
};

const loadSalesForDate = async (database: Database, businessDate: string): Promise<Sale[]> => {
  const result = await run(
    database,
    `SELECT id, business_date, descripcion, monto, created_at
     FROM ${SALES_TABLE}
     WHERE business_date = ?
     ORDER BY created_at DESC`,
    [businessDate],
  );

  return result.rows.map(row => fromSaleRow(row));
};

const loadExpensesForDate = async (database: Database, businessDate: string): Promise<Expense[]> => {
  const result = await run(
    database,
    `SELECT id, business_date, categoria, descripcion, monto, created_at
     FROM ${EXPENSES_TABLE}
     WHERE business_date = ?
     ORDER BY created_at DESC`,
    [businessDate],
  );

  return result.rows.map(row => fromExpenseRow(row));
};

const loadLedgerFromDatabase = async (
  database: Database,
  businessDate: string = todayBusinessDate(),
): Promise<DailyLedger> => {
  const balance = await ensureBalanceForDate(database, businessDate);
  const [purchases, sales, expenses] = await Promise.all([
    loadPurchasesForDate(database, balance.business_date),
    loadSalesForDate(database, balance.business_date),
    loadExpensesForDate(database, balance.business_date),
  ]);

  const totals = await loadTotals(database, balance.business_date);

  return {
    businessDate: balance.business_date,
    saldoInicial: balance.saldo_inicial,
    saldoActual: balance.saldo_actual,
    totalCompras: totals.totalCompras,
    totalVentas: totals.totalVentas,
    totalGastos: totals.totalGastos,
    purchases,
    sales,
    expenses,
  };
};

export const loadMaterials = async (): Promise<Material[]> => {
  const database = await ensureDatabase();
  const result = await run(
    database,
    `SELECT id, nombre, precio_por_libra
     FROM ${MATERIALS_TABLE}
     ORDER BY nombre COLLATE NOCASE ASC`,
  );

  return result.rows.map(row => fromMaterialRow(row));
};

export const saveMaterial = async (input: {
  id?: string;
  nombre: string;
  precioPorLibra: number;
}): Promise<Material> => {
  const nombre = input.nombre.trim();
  const precioPorLibra = Number(input.precioPorLibra);

  if (!nombre) {
    throw new Error('El nombre del material es obligatorio.');
  }

  if (!Number.isFinite(precioPorLibra) || precioPorLibra <= 0) {
    throw new Error('El precio por libra debe ser mayor que 0.');
  }

  const database = await ensureDatabase();
  const id = input.id ?? nombre.toLowerCase().replace(/\s+/g, '-');
  const now = nowIso();

  await run(
    database,
    `INSERT INTO ${MATERIALS_TABLE} (id, nombre, precio_por_libra, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       nombre = excluded.nombre,
       precio_por_libra = excluded.precio_por_libra,
       updated_at = excluded.updated_at`,
    [id, nombre, precioPorLibra, now, now],
  );

  return { id, nombre, precioPorLibra };
};

export const loadTodayLedger = async (): Promise<DailyLedger> => {
  const database = await ensureDatabase();
  return loadLedgerFromDatabase(database);
};

export const loadLedgerForDate = async (businessDate: string): Promise<DailyLedger> => {
  const database = await ensureDatabase();
  return loadLedgerFromDatabase(database, businessDate);
};

export const loadBusinessDates = async (): Promise<string[]> => {
  const database = await ensureDatabase();
  const result = await run(
    database,
    `SELECT business_date
     FROM ${BALANCES_TABLE}
     ORDER BY business_date DESC`,
  );

  return result.rows.map(row => String(row.business_date));
};

export const saveInitialBalance = async (
  saldoInicial: number,
  businessDate: string = todayBusinessDate(),
): Promise<DailyLedger> => {
  if (!Number.isFinite(saldoInicial) || saldoInicial < 0) {
    throw new Error('El saldo inicial debe ser mayor o igual a 0.');
  }

  const database = await ensureDatabase();
  const totals = await loadTotals(database, businessDate);
  const saldoActual = saldoInicial + totals.totalVentas - totals.totalCompras - totals.totalGastos;
  const now = nowIso();

  await run(
    database,
    `INSERT INTO ${BALANCES_TABLE} (business_date, saldo_inicial, saldo_actual, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(business_date) DO UPDATE SET
       saldo_inicial = excluded.saldo_inicial,
       saldo_actual = excluded.saldo_actual,
       updated_at = excluded.updated_at`,
    [businessDate, saldoInicial, saldoActual, now, now],
  );

  return loadLedgerFromDatabase(database, businessDate);
};

export const recordPurchase = async (
  input: {
    materialId: string;
    materialNombre: string;
    precioPorLibra: number;
    libras: number;
  },
  businessDate: string = todayBusinessDate(),
): Promise<DailyLedger> => {
  const materialId = input.materialId.trim();
  const materialNombre = input.materialNombre.trim();
  const precioPorLibra = Number(input.precioPorLibra);
  const libras = Number(input.libras);

  if (!materialId) {
    throw new Error('El material es obligatorio.');
  }

  if (!materialNombre) {
    throw new Error('El nombre del material es obligatorio.');
  }

  if (!Number.isFinite(precioPorLibra) || precioPorLibra <= 0) {
    throw new Error('El precio por libra debe ser mayor que 0.');
  }

  if (!Number.isFinite(libras) || libras <= 0) {
    throw new Error('La cantidad de libras debe ser mayor que 0.');
  }

  const database = await ensureDatabase();
  await ensureBalanceForDate(database, businessDate);
  const total = precioPorLibra * libras;
  const now = nowIso();

  await run(
    database,
    `INSERT INTO ${PURCHASES_TABLE} (id, business_date, material_id, material_nombre, precio_por_libra, libras, total, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [createId(), businessDate, materialId, materialNombre, precioPorLibra, libras, total, now],
  );

  await recalculateBalance(database, businessDate);
  return loadLedgerFromDatabase(database, businessDate);
};

export const recordSale = async (
  input: {
    descripcion: string;
    monto: number;
  },
  businessDate: string = todayBusinessDate(),
): Promise<DailyLedger> => {
  const descripcion = input.descripcion.trim();
  const monto = Number(input.monto);

  if (!descripcion) {
    throw new Error('La descripción de la venta es obligatoria.');
  }

  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error('El monto de la venta debe ser mayor que 0.');
  }

  const database = await ensureDatabase();
  await ensureBalanceForDate(database, businessDate);
  const now = nowIso();

  await run(
    database,
    `INSERT INTO ${SALES_TABLE} (id, business_date, descripcion, monto, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [createId(), businessDate, descripcion, monto, now],
  );

  await recalculateBalance(database, businessDate);
  return loadLedgerFromDatabase(database, businessDate);
};

export const recordExpense = async (
  input: {
    categoria: string;
    descripcion: string;
    monto: number;
  },
  businessDate: string = todayBusinessDate(),
): Promise<DailyLedger> => {
  const categoria = input.categoria.trim();
  const descripcion = input.descripcion.trim();
  const monto = Number(input.monto);

  if (!categoria) {
    throw new Error('La categoría del gasto es obligatoria.');
  }

  if (!descripcion) {
    throw new Error('La descripción del gasto es obligatoria.');
  }

  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error('El monto del gasto debe ser mayor que 0.');
  }

  const database = await ensureDatabase();
  await ensureBalanceForDate(database, businessDate);
  const now = nowIso();

  await run(
    database,
    `INSERT INTO ${EXPENSES_TABLE} (id, business_date, categoria, descripcion, monto, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [createId(), businessDate, categoria, descripcion, monto, now],
  );

  await recalculateBalance(database, businessDate);
  return loadLedgerFromDatabase(database, businessDate);
};

export const deletePurchase = async (purchaseId: string): Promise<DailyLedger> => {
  const database = await ensureDatabase();
  const result = await run(
    database,
    `SELECT id, business_date, material_id, material_nombre, precio_por_libra, libras, total, created_at
     FROM ${PURCHASES_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [purchaseId],
  );

  if (result.rows.length === 0) {
    throw new Error('La compra no existe.');
  }

  const purchase = fromPurchaseRow(result.rows[0]);
  await run(database, `DELETE FROM ${PURCHASES_TABLE} WHERE id = ?`, [purchaseId]);
  await recalculateBalance(database, purchase.businessDate);
  return loadLedgerFromDatabase(database, purchase.businessDate);
};

export const deleteSale = async (saleId: string): Promise<DailyLedger> => {
  const database = await ensureDatabase();
  const result = await run(
    database,
    `SELECT id, business_date, descripcion, monto, created_at
     FROM ${SALES_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [saleId],
  );

  if (result.rows.length === 0) {
    throw new Error('La venta no existe.');
  }

  const sale = fromSaleRow(result.rows[0]);
  await run(database, `DELETE FROM ${SALES_TABLE} WHERE id = ?`, [saleId]);
  await recalculateBalance(database, sale.businessDate);
  return loadLedgerFromDatabase(database, sale.businessDate);
};

export const deleteExpense = async (expenseId: string): Promise<DailyLedger> => {
  const database = await ensureDatabase();
  const result = await run(
    database,
    `SELECT id, business_date, categoria, descripcion, monto, created_at
     FROM ${EXPENSES_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [expenseId],
  );

  if (result.rows.length === 0) {
    throw new Error('El gasto no existe.');
  }

  const expense = fromExpenseRow(result.rows[0]);
  await run(database, `DELETE FROM ${EXPENSES_TABLE} WHERE id = ?`, [expenseId]);
  await recalculateBalance(database, expense.businessDate);
  return loadLedgerFromDatabase(database, expense.businessDate);
};

export const loadExportPayload = async (): Promise<ExportPayload> => {
  const database = await ensureDatabase();
  const [materials, businessDates] = await Promise.all([loadMaterials(), loadBusinessDates()]);
  const ledgers = await Promise.all(businessDates.map(date => loadLedgerFromDatabase(database, date)));

  return {
    exportedAt: nowIso(),
    materials,
    ledgers,
  };
};
