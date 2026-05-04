import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import BusinessDatePicker from '../components/BusinessDatePicker';
import { loadBusinessDates, loadExportPayload, loadLedgerForDate, type DailyLedger } from '../database/index';

const formatMoney = (value: number): string => `L ${value.toFixed(2)}`;

type MaterialGroup = {
  material: string;
  libras: number;
  total: number;
};

const groupPurchases = (ledger: DailyLedger): MaterialGroup[] => {
  const groups = new Map<string, MaterialGroup>();

  for (const purchase of ledger.purchases) {
    const current = groups.get(purchase.material) ?? {
      material: purchase.material,
      libras: 0,
      total: 0,
    };

    current.libras += purchase.libras;
    current.total += purchase.total;
    groups.set(purchase.material, current);
  }

  return [...groups.values()].sort((left, right) => right.total - left.total);
};

function DashboardScreen(): React.JSX.Element {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedBusinessDate, setSelectedBusinessDate] = useState(today);
  const [availableBusinessDates, setAvailableBusinessDates] = useState<string[]>([today]);
  const [selectedLedger, setSelectedLedger] = useState<DailyLedger | null>(null);
  const [recentLedgers, setRecentLedgers] = useState<DailyLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const dates = await loadBusinessDates();
        const availableDates = [...new Set([selectedBusinessDate, ...dates])];
        const recentDates = availableDates.slice(0, 6);
        const [ledger, ...rest] = await Promise.all([
          loadLedgerForDate(selectedBusinessDate),
          ...recentDates
            .filter(date => date !== selectedBusinessDate)
            .map(date => loadLedgerForDate(date)),
        ]);

        setAvailableBusinessDates(availableDates);
        setSelectedLedger(ledger);
        setRecentLedgers([ledger, ...rest]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No fue posible cargar el dashboard.';
        Alert.alert('Error', message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [selectedBusinessDate]);

  const materialGroups = useMemo(
    () => (selectedLedger ? groupPurchases(selectedLedger) : []),
    [selectedLedger],
  );

  const maxGroupTotal = Math.max(...materialGroups.map(group => group.total), 0);

  const exportData = async (): Promise<void> => {
    setExporting(true);

    try {
      const payload = await loadExportPayload();
      const summary = {
        exportedAt: payload.exportedAt,
        totalMaterials: payload.materials.length,
        totalDays: payload.ledgers.length,
        totalPurchases: payload.ledgers.reduce((accumulated, ledger) => accumulated + ledger.purchases.length, 0),
        totalSales: payload.ledgers.reduce((accumulated, ledger) => accumulated + ledger.sales.length, 0),
        totalExpenses: payload.ledgers.reduce((accumulated, ledger) => accumulated + ledger.expenses.length, 0),
      };

      await Share.share({
        title: 'Exportación de RControl',
        message: `${JSON.stringify(summary, null, 2)}\n\n${JSON.stringify(payload, null, 2)}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible exportar la información.';
      Alert.alert('Error', message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>Resumen diario de compras, ventas y gastos</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Fecha de negocio</Text>
        <BusinessDatePicker
          dates={availableBusinessDates}
          value={selectedBusinessDate}
          onChange={setSelectedBusinessDate}
        />
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void exportData()} disabled={exporting}>
          <Text style={styles.secondaryButtonText}>{exporting ? 'Exportando...' : 'Exportar información'}</Text>
        </TouchableOpacity>
        <Text style={styles.helperText}>Se comparte un JSON con materiales, días y movimientos.</Text>
      </View>

      <View style={styles.metricsGrid}>
        <MetricCard label="Compras" value={formatMoney(selectedLedger?.totalCompras ?? 0)} tone="blue" />
        <MetricCard label="Ventas" value={formatMoney(selectedLedger?.totalVentas ?? 0)} tone="green" />
        <MetricCard label="Gastos" value={formatMoney(selectedLedger?.totalGastos ?? 0)} tone="orange" />
        <MetricCard label="Balance" value={formatMoney(selectedLedger?.saldoActual ?? 0)} tone="slate" />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Producto comprado por material</Text>
        <Text style={styles.helperText}>Ejemplo: 10 lb de cobre, 30 lb de aluminio.</Text>

        {loading ? <Text style={styles.empty}>Cargando resumen...</Text> : null}

        {!loading && materialGroups.length === 0 ? (
          <Text style={styles.empty}>Todavía no hay compras para esta fecha.</Text>
        ) : null}

        {materialGroups.map(group => {
          const percent = maxGroupTotal > 0 ? (group.total / maxGroupTotal) * 100 : 0;

          return (
            <View key={group.material} style={styles.barRow}>
              <View style={styles.barHeader}>
                <Text style={styles.barLabel}>{group.material}</Text>
                <Text style={styles.barValue}>{group.libras.toFixed(2)} lb</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${percent}%` }]} />
              </View>
              <Text style={styles.barTotal}>{formatMoney(group.total)}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Resumen reciente</Text>
        {recentLedgers.length === 0 ? (
          <Text style={styles.empty}>Aún no hay días guardados.</Text>
        ) : null}

        {recentLedgers.map(ledger => (
          <View key={ledger.businessDate} style={styles.dayRow}>
            <View style={styles.dayInfo}>
              <Text style={styles.dayDate}>{ledger.businessDate}</Text>
              <Text style={styles.dayMeta}>
                {ledger.purchases.length} compras, {ledger.sales.length} ventas, {ledger.expenses.length} gastos
              </Text>
            </View>
            <Text style={styles.dayBalance}>{formatMoney(ledger.saldoActual)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

type MetricTone = 'blue' | 'green' | 'orange' | 'slate';

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: MetricTone;
}): React.JSX.Element {
  return (
    <View style={[styles.metricCard, styles[`metric${tone}`]]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
    backgroundColor: '#F2F4F8',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    marginTop: -6,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  helperText: {
    color: '#64748B',
    fontSize: 13,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 16,
    padding: 14,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  metricblue: {
    backgroundColor: '#DBEAFE',
  },
  metricgreen: {
    backgroundColor: '#DCFCE7',
  },
  metricorange: {
    backgroundColor: '#FFEDD5',
  },
  metricslate: {
    backgroundColor: '#E2E8F0',
  },
  metricLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 14,
  },
  empty: {
    color: '#64748B',
    fontSize: 14,
  },
  barRow: {
    gap: 6,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  barLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  barValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B5FFF',
  },
  barTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#0B5FFF',
  },
  barTotal: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  dayInfo: {
    flex: 1,
  },
  dayDate: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 14,
  },
  dayMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  dayBalance: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 14,
  },
});

export default DashboardScreen;