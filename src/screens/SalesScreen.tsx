import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import BusinessDatePicker from '../components/BusinessDatePicker';
import { deleteSale, loadBusinessDates, loadLedgerForDate, recordSale, type Sale } from '../database/index';

const formatMoney = (value: number): string => `L ${value.toFixed(2)}`;

function SalesScreen(): React.JSX.Element {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedBusinessDate, setSelectedBusinessDate] = useState(today);
  const [availableBusinessDates, setAvailableBusinessDates] = useState<string[]>([today]);
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [ledgerInfo, setLedgerInfo] = useState({ saldoInicial: 0, saldoActual: 0, totalVentas: 0, totalCompras: 0, totalGastos: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      setLoading(true);

      try {
        const [dates, ledger] = await Promise.all([
          loadBusinessDates(),
          loadLedgerForDate(selectedBusinessDate),
        ]);

        setAvailableBusinessDates([selectedBusinessDate, ...dates]);
        setSales(ledger.sales);
        setLedgerInfo({
          saldoInicial: ledger.saldoInicial,
          saldoActual: ledger.saldoActual,
          totalVentas: ledger.totalVentas,
          totalCompras: ledger.totalCompras,
          totalGastos: ledger.totalGastos,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No fue posible cargar las ventas.';
        Alert.alert('Error', message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [selectedBusinessDate]);

  const amount = Number(amountText.replace(',', '.').trim());

  const saveSale = (): void => {
    if (!description.trim()) {
      Alert.alert('Dato inválido', 'Escribe una descripción para la venta.');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Dato inválido', 'Ingresa un monto mayor a 0.');
      return;
    }

    setSaving(true);

    void (async () => {
      try {
        const ledger = await recordSale(
          {
            descripcion: description,
            monto: amount,
          },
          selectedBusinessDate,
        );

        setAvailableBusinessDates(prev => [...new Set([selectedBusinessDate, ...prev])]);
        setSales(ledger.sales);
        setLedgerInfo({
          saldoInicial: ledger.saldoInicial,
          saldoActual: ledger.saldoActual,
          totalVentas: ledger.totalVentas,
          totalCompras: ledger.totalCompras,
          totalGastos: ledger.totalGastos,
        });
        setDescription('');
        setAmountText('');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No fue posible guardar la venta.';
        Alert.alert('Error', message);
      } finally {
        setSaving(false);
      }
    })();
  };

  const deleteSaleHandler = async (saleId: string): Promise<void> => {
    setDeletingId(saleId);

    try {
      const ledger = await deleteSale(saleId);
      setSales(ledger.sales);
      setLedgerInfo({
        saldoInicial: ledger.saldoInicial,
        saldoActual: ledger.saldoActual,
        totalVentas: ledger.totalVentas,
        totalCompras: ledger.totalCompras,
        totalGastos: ledger.totalGastos,
      });
      setAvailableBusinessDates(prev => [...new Set([ledger.businessDate, ...prev])]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible borrar la venta.';
      Alert.alert('Error', message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Ventas</Text>
      <Text style={styles.subtitle}>Registra una descripción libre y el monto recibido en lempiras</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Fecha de negocio</Text>
        <BusinessDatePicker dates={availableBusinessDates} value={selectedBusinessDate} onChange={setSelectedBusinessDate} />
        {loading ? <Text style={styles.empty}>Cargando información...</Text> : null}
      </View>

      <View style={styles.metricsGrid}>
        <MetricCard label="Ventas" value={formatMoney(ledgerInfo.totalVentas)} tone="green" />
        <MetricCard label="Compras" value={formatMoney(ledgerInfo.totalCompras)} tone="blue" />
        <MetricCard label="Gastos" value={formatMoney(ledgerInfo.totalGastos)} tone="orange" />
        <MetricCard label="Balance" value={formatMoney(ledgerInfo.saldoActual)} tone="slate" />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Nueva venta</Text>
        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="Ej: Venta de chatarra mixta"
        />

        <Text style={styles.label}>Monto en lempiras</Text>
        <TextInput
          style={styles.input}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="Ej: 1250"
        />

        <TouchableOpacity style={styles.primaryButton} onPress={saveSale} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? 'Guardando...' : 'Registrar venta'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Ventas del día {selectedBusinessDate}</Text>
        {sales.length === 0 ? (
          <Text style={styles.empty}>Aún no hay ventas registradas.</Text>
        ) : (
          sales.map(sale => (
            <View key={sale.id} style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.itemTitle}>{sale.descripcion}</Text>
                <Text style={styles.itemSubtitle}>{sale.fecha}</Text>
              </View>
              <View style={styles.actions}>
                <Text style={styles.amount}>{formatMoney(sale.monto)}</Text>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => void deleteSaleHandler(sale.id)}
                  disabled={deletingId === sale.id}>
                  <Text style={styles.deleteButtonText}>{deletingId === sale.id ? '...' : 'Borrar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'green' | 'orange' | 'slate';
}): React.JSX.Element {
  return (
    <View style={[styles.metricCard, styles[`metric${tone}` as keyof typeof styles] as never]}>
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
  label: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  info: {
    flex: 1,
  },
  itemTitle: {
    color: '#0F172A',
    fontWeight: '800',
  },
  itemSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  amount: {
    color: '#0F172A',
    fontWeight: '800',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteButtonText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '800',
  },
  empty: {
    color: '#64748B',
  },
});

export default SalesScreen;