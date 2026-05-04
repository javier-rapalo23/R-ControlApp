require('react-native-gesture-handler/jestSetup');

jest.mock('@react-navigation/native', () => {
  const React = require('react');

  return {
    NavigationContainer: ({ children }) => React.createElement(React.Fragment, null, children),
  };
});

jest.mock('@react-navigation/bottom-tabs', () => {
  const React = require('react');

  return {
    createBottomTabNavigator: () => ({
      Navigator: ({ children }) => React.createElement(React.Fragment, null, children),
      Screen: () => null,
    }),
  };
});

jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
  enableFreeze: jest.fn(),
  Screen: 'Screen',
  ScreenContainer: 'ScreenContainer',
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

const defaultMaterials = [
  { id: 'hierro', nombre: 'Hierro', precio_por_libra: 1.8 },
  { id: 'aluminio', nombre: 'Aluminio', precio_por_libra: 6.5 },
  { id: 'cobre', nombre: 'Cobre', precio_por_libra: 22 },
];

let materials = defaultMaterials.map(material => ({ ...material }));
let balances = [];
let purchases = [];
let sales = [];
let expenses = [];

const todayBusinessDate = () => '2026-04-27';

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const computeTotals = businessDate => ({
  totalCompras: purchases
    .filter(item => item.business_date === businessDate)
    .reduce((accumulated, item) => accumulated + item.total, 0),
  totalVentas: sales
    .filter(item => item.business_date === businessDate)
    .reduce((accumulated, item) => accumulated + item.monto, 0),
  totalGastos: expenses
    .filter(item => item.business_date === businessDate)
    .reduce((accumulated, item) => accumulated + item.monto, 0),
});

const recalculateBalance = businessDate => {
  const balance = balances.find(item => item.business_date === businessDate) ?? {
    business_date: businessDate,
    saldo_inicial: 0,
    saldo_actual: 0,
  };
  const totals = computeTotals(businessDate);
  const saldoActual = balance.saldo_inicial + totals.totalVentas - totals.totalCompras - totals.totalGastos;

  const nextBalance = {
    business_date: businessDate,
    saldo_inicial: balance.saldo_inicial,
    saldo_actual: saldoActual,
  };

  const existingIndex = balances.findIndex(item => item.business_date === businessDate);
  if (existingIndex >= 0) {
    balances[existingIndex] = nextBalance;
  } else {
    balances = [...balances, nextBalance];
  }

  return nextBalance;
};

const mockOpen = jest.fn(() => ({
  execute: jest.fn(async (query, params = []) => {
    const normalizedQuery = String(query).trim().toUpperCase();

    if (normalizedQuery.startsWith('CREATE TABLE')) {
      return { rows: [] };
    }

    if (normalizedQuery.startsWith('SELECT COUNT(*) AS TOTAL')) {
      if (normalizedQuery.includes('FROM MATERIALS')) {
        return { rows: [{ total: materials.length }] };
      }

      return { rows: [{ total: 0 }] };
    }

    if (normalizedQuery.startsWith('INSERT INTO MATERIALS')) {
      const [id, nombre, precioPorLibra] = params;
      const nextMaterial = {
        id: String(id),
        nombre: String(nombre),
        precio_por_libra: Number(precioPorLibra),
      };
      const existingIndex = materials.findIndex(material => material.id === id);

      if (existingIndex >= 0) {
        materials[existingIndex] = nextMaterial;
      } else {
        materials = [...materials, nextMaterial];
      }

      return { rows: [] };
    }

    if (normalizedQuery.startsWith('SELECT ID, NOMBRE, PRECIO_POR_LIBRA')) {
      return {
        rows: [...materials]
          .sort((left, right) => left.nombre.localeCompare(right.nombre))
          .map(material => ({
            id: material.id,
            nombre: material.nombre,
            precio_por_libra: material.precio_por_libra,
          })),
      };
    }

    if (normalizedQuery.startsWith('SELECT BUSINESS_DATE, SALDO_INICIAL, SALDO_ACTUAL FROM DAILY_BALANCES WHERE BUSINESS_DATE = ? LIMIT 1')) {
      const [businessDate] = params;
      const balance = balances.find(item => item.business_date === businessDate);

      if (balance) {
        return { rows: [{ ...balance }] };
      }

      const nextBalance = {
        business_date: String(businessDate ?? todayBusinessDate()),
        saldo_inicial: 0,
        saldo_actual: 0,
      };
      balances = [...balances, nextBalance];
      return { rows: [{ ...nextBalance }] };
    }

    if (normalizedQuery.startsWith('INSERT INTO DAILY_BALANCES')) {
      const [businessDate, saldoInicial, saldoActual] = params;
      const nextBalance = {
        business_date: String(businessDate),
        saldo_inicial: Number(saldoInicial),
        saldo_actual: Number(saldoActual),
      };
      const existingIndex = balances.findIndex(item => item.business_date === businessDate);

      if (existingIndex >= 0) {
        balances[existingIndex] = nextBalance;
      } else {
        balances = [...balances, nextBalance];
      }

      return { rows: [] };
    }

    if (normalizedQuery.startsWith('SELECT BUSINESS_DATE FROM DAILY_BALANCES ORDER BY BUSINESS_DATE DESC')) {
      return {
        rows: [...balances]
          .sort((left, right) => right.business_date.localeCompare(left.business_date))
          .map(item => ({ business_date: item.business_date })),
      };
    }

    if (normalizedQuery.startsWith('SELECT COALESCE(SUM(TOTAL), 0) AS TOTAL FROM PURCHASES')) {
      const [businessDate] = params;
      const totals = computeTotals(String(businessDate));
      return { rows: [{ total: totals.totalCompras }] };
    }

    if (normalizedQuery.startsWith('SELECT COALESCE(SUM(MONTO), 0) AS TOTAL FROM SALES')) {
      const [businessDate] = params;
      const totals = computeTotals(String(businessDate));
      return { rows: [{ total: totals.totalVentas }] };
    }

    if (normalizedQuery.startsWith('SELECT COALESCE(SUM(MONTO), 0) AS TOTAL FROM EXPENSES')) {
      const [businessDate] = params;
      const totals = computeTotals(String(businessDate));
      return { rows: [{ total: totals.totalGastos }] };
    }

    if (normalizedQuery.startsWith('INSERT INTO PURCHASES')) {
      const [id, businessDate, materialId, materialNombre, precioPorLibra, libras, total, createdAt] = params;
      const nextPurchase = {
        id: String(id),
        business_date: String(businessDate),
        material_id: String(materialId),
        material_nombre: String(materialNombre),
        precio_por_libra: Number(precioPorLibra),
        libras: Number(libras),
        total: Number(total),
        created_at: String(createdAt),
      };

      purchases = [nextPurchase, ...purchases];
      recalculateBalance(String(businessDate));
      return { rows: [] };
    }

    if (normalizedQuery.startsWith('INSERT INTO SALES')) {
      const [id, businessDate, descripcion, monto, createdAt] = params;
      const nextSale = {
        id: String(id),
        business_date: String(businessDate),
        descripcion: String(descripcion),
        monto: Number(monto),
        created_at: String(createdAt),
      };

      sales = [nextSale, ...sales];
      recalculateBalance(String(businessDate));
      return { rows: [] };
    }

    if (normalizedQuery.startsWith('INSERT INTO EXPENSES')) {
      const [id, businessDate, categoria, descripcion, monto, createdAt] = params;
      const nextExpense = {
        id: String(id),
        business_date: String(businessDate),
        categoria: String(categoria),
        descripcion: String(descripcion),
        monto: Number(monto),
        created_at: String(createdAt),
      };

      expenses = [nextExpense, ...expenses];
      recalculateBalance(String(businessDate));
      return { rows: [] };
    }

    if (normalizedQuery.startsWith('SELECT ID, BUSINESS_DATE, MATERIAL_ID')) {
      const [businessDate] = params;
      return {
        rows: purchases
          .filter(item => item.business_date === businessDate)
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
          .map(item => ({ ...item })),
      };
    }

    if (normalizedQuery.startsWith('SELECT ID, BUSINESS_DATE, DESCRIPCION, MONTO, CREATED_AT FROM SALES')) {
      const [businessDate] = params;
      return {
        rows: sales
          .filter(item => item.business_date === businessDate)
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
          .map(item => ({ ...item })),
      };
    }

    if (normalizedQuery.startsWith('SELECT ID, BUSINESS_DATE, CATEGORIA, DESCRIPCION, MONTO, CREATED_AT FROM EXPENSES')) {
      const [businessDate] = params;
      return {
        rows: expenses
          .filter(item => item.business_date === businessDate)
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
          .map(item => ({ ...item })),
      };
    }

    if (normalizedQuery.startsWith('SELECT ID, BUSINESS_DATE, MATERIAL_ID, MATERIAL_NOMBRE, PRECIO_POR_LIBRA, LIBRAS, TOTAL, CREATED_AT FROM PURCHASES WHERE ID = ? LIMIT 1')) {
      const [id] = params;
      const purchase = purchases.find(item => item.id === id);
      return { rows: purchase ? [{ ...purchase }] : [] };
    }

    if (normalizedQuery.startsWith('SELECT ID, BUSINESS_DATE, DESCRIPCION, MONTO, CREATED_AT FROM SALES WHERE ID = ? LIMIT 1')) {
      const [id] = params;
      const sale = sales.find(item => item.id === id);
      return { rows: sale ? [{ ...sale }] : [] };
    }

    if (normalizedQuery.startsWith('SELECT ID, BUSINESS_DATE, CATEGORIA, DESCRIPCION, MONTO, CREATED_AT FROM EXPENSES WHERE ID = ? LIMIT 1')) {
      const [id] = params;
      const expense = expenses.find(item => item.id === id);
      return { rows: expense ? [{ ...expense }] : [] };
    }

    if (normalizedQuery.startsWith('DELETE FROM PURCHASES WHERE ID = ?')) {
      const [id] = params;
      const removed = purchases.find(item => item.id === id);
      purchases = purchases.filter(item => item.id !== id);
      if (removed) {
        recalculateBalance(removed.business_date);
      }
      return { rows: [] };
    }

    if (normalizedQuery.startsWith('DELETE FROM SALES WHERE ID = ?')) {
      const [id] = params;
      const removed = sales.find(item => item.id === id);
      sales = sales.filter(item => item.id !== id);
      if (removed) {
        recalculateBalance(removed.business_date);
      }
      return { rows: [] };
    }

    if (normalizedQuery.startsWith('DELETE FROM EXPENSES WHERE ID = ?')) {
      const [id] = params;
      const removed = expenses.find(item => item.id === id);
      expenses = expenses.filter(item => item.id !== id);
      if (removed) {
        recalculateBalance(removed.business_date);
      }
      return { rows: [] };
    }

    if (normalizedQuery.startsWith('DELETE FROM MATERIALS WHERE ID = ?')) {
      const [id] = params;
      materials = materials.filter(material => material.id !== id);
      return { rows: [] };
    }

    if (normalizedQuery.startsWith('SELECT ID FROM MATERIALS WHERE ID = ? LIMIT 1')) {
      const [id] = params;
      const existing = materials.find(material => material.id === id);
      return {
        rows: existing ? [{ id: existing.id }] : [],
      };
    }

    if (normalizedQuery.startsWith('UPDATE MATERIALS')) {
      const [nombre, precioPorLibra, , id] = params;
      const existingIndex = materials.findIndex(material => material.id === id);

      if (existingIndex >= 0) {
        materials[existingIndex] = {
          id: String(id),
          nombre: String(nombre),
          precio_por_libra: Number(precioPorLibra),
        };
      }

      return { rows: [] };
    }

    return { rows: [] };
  }),
  close: jest.fn(),
}));

jest.mock('@op-engineering/op-sqlite', () => ({
  open: mockOpen,
}));

beforeEach(() => {
  materials = defaultMaterials.map(material => ({ ...material }));
  balances = [];
  purchases = [];
  sales = [];
  expenses = [];
  mockOpen.mockClear();
});
