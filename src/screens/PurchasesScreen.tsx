import React, { useEffect, useMemo, useState } from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BusinessDatePicker from '../components/BusinessDatePicker';
import {
  deletePurchase,
  loadBusinessDates,
  loadClients,
  loadLedgerForDate,
  loadMaterials,
  migrateLegacyPurchasesToClientModel,
  recordClientPurchaseTransaction,
  saveClient,
  saveInitialBalance,
  saveMaterial,
  type Client,
  type Material,
  type Purchase,
} from '../database/index';

const parseNumber = (value: string): number => {
  const normalized = value.replace(',', '.').trim();
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
};

const formatMoney = (value: number): string => `L ${value.toFixed(2)}`;

type CartItem = {
  id: string;
  materialId: string;
  materialNombre: string;
  precioPorLibra: number;
  libras: number;
  total: number;
};

function PurchasesScreen(): React.JSX.Element {
  const safeAreaInsets = useSafeAreaInsets();
  const today = new Date().toISOString().slice(0, 10);

  const [selectedBusinessDate, setSelectedBusinessDate] = useState(today);
  const [availableBusinessDates, setAvailableBusinessDates] = useState<string[]>([today]);
  const [saldoInicialText, setSaldoInicialText] = useState('');
  const [saldoInicialSaved, setSaldoInicialSaved] = useState(0);
  const [saldoActualSaved, setSaldoActualSaved] = useState(0);
  const [clientes, setClientes] = useState<Client[]>([]);
  const [clientSelectedId, setClientSelectedId] = useState('');
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [clientName, setClientName] = useState('');
  const [savingClient, setSavingClient] = useState(false);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [materialSelectedId, setMaterialSelectedId] = useState('');
  const [librasText, setLibrasText] = useState('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [compras, setCompras] = useState<Purchase[]>([]);
  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  const [materialEditingId, setMaterialEditingId] = useState<string | null>(null);
  const [materialName, setMaterialName] = useState('');
  const [materialPriceText, setMaterialPriceText] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [savingBalance, setSavingBalance] = useState(false);
  const [registeringPurchase, setRegisteringPurchase] = useState(false);
  const [deletingPurchaseId, setDeletingPurchaseId] = useState<string | null>(null);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [migratingData, setMigratingData] = useState(false);

  useEffect(() => {
    const loadStaticData = async (): Promise<void> => {
      try {
        const [savedMaterials, businessDates, savedClients] = await Promise.all([
          loadMaterials(),
          loadBusinessDates(),
          loadClients(),
        ]);

        setMateriales(savedMaterials);
        setClientes(savedClients);
        setAvailableBusinessDates([selectedBusinessDate, ...businessDates].filter(Boolean));
        if (savedMaterials.length > 0) {
          setMaterialSelectedId(prev => prev || savedMaterials[0].id);
        }
        if (savedClients.length > 0) {
          setClientSelectedId(prev => prev || savedClients[0].id);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No fue posible cargar los materiales.';
        Alert.alert('Error', message);
      }
    };

    void loadStaticData();
  }, [selectedBusinessDate]);

  useEffect(() => {
    const loadLedger = async (): Promise<void> => {
      setLoadingData(true);

      try {
        const ledger = await loadLedgerForDate(selectedBusinessDate);
        setSaldoInicialText(String(ledger.saldoInicial));
        setSaldoInicialSaved(ledger.saldoInicial);
        setSaldoActualSaved(ledger.saldoActual);
        setCompras(ledger.purchases);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No fue posible cargar la fecha seleccionada.';
        Alert.alert('Error', message);
      } finally {
        setLoadingData(false);
      }
    };

    void loadLedger();
  }, [selectedBusinessDate]);

  const materialSelected =
    materiales.find(material => material.id === materialSelectedId) ?? materiales[0] ?? null;
  const clientSelected = clientes.find(client => client.id === clientSelectedId) ?? clientes[0] ?? null;

  const saldoInicial = parseNumber(saldoInicialText);
  const libras = parseNumber(librasText);
  const totalPurchaseNow = materialSelected ? libras * materialSelected.precioPorLibra : 0;
  const totalCart = useMemo(
    () => cartItems.reduce((accumulated, item) => accumulated + item.total, 0),
    [cartItems],
  );
  const totalPurchases = useMemo(
    () => compras.reduce((accumulated, purchase) => accumulated + purchase.total, 0),
    [compras],
  );
  const projectedBalance = saldoActualSaved - (totalCart + totalPurchaseNow);

  const saveInitialBalanceHandler = async (): Promise<void> => {
    if (!Number.isFinite(saldoInicial) || saldoInicial < 0) {
      Alert.alert('Dato inválido', 'Ingresa un saldo inicial mayor o igual a 0.');
      return;
    }

    setSavingBalance(true);

    try {
      const ledger = await saveInitialBalance(saldoInicial, selectedBusinessDate);
      setAvailableBusinessDates(prev => [...new Set([selectedBusinessDate, ...prev])]);
      setSaldoInicialText(String(ledger.saldoInicial));
      setSaldoInicialSaved(ledger.saldoInicial);
      setSaldoActualSaved(ledger.saldoActual);
      setCompras(ledger.purchases);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible guardar el saldo inicial.';
      Alert.alert('Error', message);
    } finally {
      setSavingBalance(false);
    }
  };

  const openNewMaterial = (): void => {
    setMaterialEditingId(null);
    setMaterialName('');
    setMaterialPriceText('');
    setMaterialModalVisible(true);
  };

  const openEditMaterial = (material: Material): void => {
    setMaterialEditingId(material.id);
    setMaterialName(material.nombre);
    setMaterialPriceText(String(material.precioPorLibra));
    setMaterialModalVisible(true);
  };

  const closeMaterialModal = (): void => {
    if (!savingMaterial) {
      setMaterialModalVisible(false);
    }
  };

  const openNewClient = (): void => {
    setClientName('');
    setClientModalVisible(true);
  };

  const closeClientModal = (): void => {
    if (!savingClient) {
      setClientModalVisible(false);
    }
  };

  const saveClientHandler = async (): Promise<void> => {
    const name = clientName.trim();

    if (!name) {
      Alert.alert('Dato inválido', 'Ingresa el nombre del cliente.');
      return;
    }

    setSavingClient(true);

    try {
      const createdClient = await saveClient({ nombre: name });
      const updatedClients = await loadClients();
      setClientes(updatedClients);
      setClientSelectedId(createdClient.id);
      setClientModalVisible(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible guardar el cliente.';
      Alert.alert('Error', message);
    } finally {
      setSavingClient(false);
    }
  };

  const saveMaterialHandler = async (): Promise<void> => {
    const name = materialName.trim();
    const price = parseNumber(materialPriceText);

    if (!name) {
      Alert.alert('Dato inválido', 'Ingresa el nombre del material.');
      return;
    }

    if (price <= 0) {
      Alert.alert('Dato inválido', 'Ingresa un precio por libra mayor a 0.');
      return;
    }

    setSavingMaterial(true);

    try {
      await saveMaterial({
        id: materialEditingId ?? undefined,
        nombre: name,
        precioPorLibra: price,
      });

      const updatedMaterials = await loadMaterials();
      setMateriales(updatedMaterials);
      setMaterialSelectedId(prev =>
        updatedMaterials.some(material => material.id === prev)
          ? prev
          : updatedMaterials[0]?.id ?? '',
      );
      setMaterialModalVisible(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible guardar el material.';
      Alert.alert('Error', message);
    } finally {
      setSavingMaterial(false);
    }
  };

  const addToCartHandler = (): void => {
    if (!materialSelected) {
      Alert.alert('Sin materiales', 'Agrega al menos un material primero.');
      return;
    }

    if (libras <= 0) {
      Alert.alert('Dato inválido', 'Ingresa una cantidad de libras mayor a 0.');
      return;
    }

    const nextItem: CartItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      materialId: materialSelected.id,
      materialNombre: materialSelected.nombre,
      precioPorLibra: materialSelected.precioPorLibra,
      libras,
      total: totalPurchaseNow,
    };

    setCartItems(prev => [...prev, nextItem]);
    setLibrasText('');
  };

  const removeCartItemHandler = (itemId: string): void => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
  };

  const registerPurchaseHandler = (): void => {
    if (!clientSelected) {
      Alert.alert('Sin cliente', 'Selecciona o crea un cliente para registrar la compra.');
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega al menos un material al carrito.');
      return;
    }

    setRegisteringPurchase(true);

    void (async () => {
      try {
        const ledger = await recordClientPurchaseTransaction(
          {
            clientId: clientSelected.id,
            clientNombre: clientSelected.nombre,
            items: cartItems.map(item => ({
              materialId: item.materialId,
              materialNombre: item.materialNombre,
              precioPorLibra: item.precioPorLibra,
              libras: item.libras,
            })),
          },
          selectedBusinessDate,
        );

        setAvailableBusinessDates(prev => [...new Set([selectedBusinessDate, ...prev])]);
        setSaldoActualSaved(ledger.saldoActual);
        setCompras(ledger.purchases);
        setCartItems([]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No fue posible registrar la compra.';
        Alert.alert('Error', message);
      } finally {
        setRegisteringPurchase(false);
      }
    })();
  };

  const deletePurchaseHandler = async (purchaseId: string): Promise<void> => {
    setDeletingPurchaseId(purchaseId);

    try {
      const ledger = await deletePurchase(purchaseId);
      setSaldoInicialText(String(ledger.saldoInicial));
      setSaldoInicialSaved(ledger.saldoInicial);
      setSaldoActualSaved(ledger.saldoActual);
      setCompras(ledger.purchases);
      setAvailableBusinessDates(prev => [...new Set([ledger.businessDate, ...prev])]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible borrar la compra.';
      Alert.alert('Error', message);
    } finally {
      setDeletingPurchaseId(null);
    }
  };

  const runMigrationHandler = async (): Promise<void> => {
    setMigratingData(true);

    try {
      const result = await migrateLegacyPurchasesToClientModel();
      Clipboard.setString(result.backupJson);

      Alert.alert(
        'Migración completada',
        result.alreadyMigrated
          ? `Ya existía una migración previa.\nBackup: ${result.backupId}\nJSON copiado al portapapeles.`
          : `Backup generado: ${result.backupId}\nCompras migradas: ${result.migratedPurchases}\nJSON copiado al portapapeles.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible ejecutar la migración.';
      Alert.alert('Error', message);
    } finally {
      setMigratingData(false);
    }
  };

  const confirmMigrationHandler = (): void => {
    Alert.alert(
      'Migrar compras por cliente',
      'Primero se creará un backup JSON automático y luego se convertirán las compras antiguas al nuevo formato por cliente. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Migrar',
          style: 'destructive',
          onPress: () => {
            void runMigrationHandler();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.safeArea, { paddingTop: safeAreaInsets.top, paddingBottom: safeAreaInsets.bottom }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Compras</Text>
        <Text style={styles.subtitle}>Registro diario de materiales comprados</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Fecha de negocio</Text>
          <BusinessDatePicker
            dates={availableBusinessDates}
            value={selectedBusinessDate}
            onChange={setSelectedBusinessDate}
          />
          {loadingData ? <Text style={styles.empty}>Cargando información...</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Saldo inicial</Text>
          <TextInput
            style={styles.input}
            value={saldoInicialText}
            onChangeText={setSaldoInicialText}
            keyboardType="decimal-pad"
            placeholder="Ej: 5000"
          />
          <Text style={styles.summary}>Saldo inicial guardado: {formatMoney(saldoInicialSaved)}</Text>
          <Text style={styles.summarySecondary}>Saldo actual guardado: {formatMoney(saldoActualSaved)}</Text>
          <Text style={styles.summarySecondary}>Saldo después de esta compra: {formatMoney(projectedBalance)}</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={saveInitialBalanceHandler} disabled={savingBalance}>
            <Text style={styles.primaryButtonText}>{savingBalance ? 'Guardando...' : 'Guardar saldo inicial'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Cliente</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={openNewClient}>
              <Text style={styles.secondaryButtonText}>+ Nuevo cliente</Text>
            </TouchableOpacity>
          </View>

          {clientes.length === 0 ? (
            <Text style={styles.empty}>Todavía no hay clientes guardados.</Text>
          ) : (
            <View style={styles.materialGrid}>
              {clientes.map(client => {
                const active = client.id === clientSelectedId;

                return (
                  <TouchableOpacity
                    key={client.id}
                    style={[styles.materialCard, active && styles.materialCardActive]}
                    onPress={() => setClientSelectedId(client.id)}>
                    <View style={styles.materialTap}>
                      <Text style={[styles.materialName, active && styles.onPrimary]}>{client.nombre}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.materialSelectedBox}>
            <Text style={styles.materialSelectedLabel}>Cliente seleccionado</Text>
            <Text style={styles.materialSelectedValue}>
              {clientSelected ? clientSelected.nombre : 'No hay cliente seleccionado'}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Materiales</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={openNewMaterial}>
              <Text style={styles.secondaryButtonText}>+ Agregar</Text>
            </TouchableOpacity>
          </View>

          {materiales.length === 0 ? (
            <Text style={styles.empty}>Todavía no hay materiales guardados.</Text>
          ) : (
            <View style={styles.materialGrid}>
              {materiales.map(material => {
                const active = material.id === materialSelectedId;

                return (
                  <View key={material.id} style={[styles.materialCard, active && styles.materialCardActive]}>
                    <TouchableOpacity style={styles.materialTap} onPress={() => setMaterialSelectedId(material.id)}>
                      <Text style={[styles.materialName, active && styles.onPrimary]}>{material.nombre}</Text>
                      <Text style={[styles.materialPrice, active && styles.onPrimary]}>
                        {formatMoney(material.precioPorLibra)}/lb
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.materialEdit} onPress={() => openEditMaterial(material)}>
                      <Text style={[styles.materialEditText, active && styles.onPrimary]}>Editar</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.materialSelectedBox}>
            <Text style={styles.materialSelectedLabel}>Material seleccionado</Text>
            <Text style={styles.materialSelectedValue}>
              {materialSelected
                ? `${materialSelected.nombre} - ${formatMoney(materialSelected.precioPorLibra)}/lb`
                : 'No hay material seleccionado'}
            </Text>
          </View>

          <Text style={styles.label}>Cantidad de libras</Text>
          <TextInput
            style={styles.input}
            value={librasText}
            onChangeText={setLibrasText}
            keyboardType="decimal-pad"
            placeholder="Ej: 120"
          />

          <Text style={styles.summary}>Total compra: {formatMoney(totalPurchaseNow)}</Text>

          <TouchableOpacity style={styles.secondaryButton} onPress={addToCartHandler}>
            <Text style={styles.secondaryButtonText}>Agregar al carrito</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Carrito</Text>
          <Text style={styles.summary}>Total carrito: {formatMoney(totalCart)}</Text>

          {cartItems.length === 0 ? (
            <Text style={styles.empty}>Aún no hay productos en el carrito.</Text>
          ) : (
            cartItems.map(item => (
              <View key={item.id} style={styles.purchaseRow}>
                <View style={styles.purchaseInfo}>
                  <Text style={styles.purchaseTitle}>
                    {item.materialNombre} - {item.libras} lb
                  </Text>
                  <Text style={styles.purchaseSubtitle}>{formatMoney(item.precioPorLibra)}/lb</Text>
                </View>
                <View style={styles.purchaseActions}>
                  <Text style={styles.purchaseTotal}>{formatMoney(item.total)}</Text>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => removeCartItemHandler(item.id)}>
                    <Text style={styles.deleteButtonText}>Quitar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={registerPurchaseHandler} disabled={registeringPurchase}>
            <Text style={styles.primaryButtonText}>
              {registeringPurchase ? 'Registrando...' : 'Registrar compra del cliente'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Compras del día {selectedBusinessDate}</Text>
          <Text style={styles.summary}>Total comprado: {formatMoney(totalPurchases)}</Text>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={confirmMigrationHandler}
            disabled={migratingData}>
            <Text style={styles.secondaryButtonText}>
              {migratingData ? 'Migrando...' : 'Migrar compras antiguas por cliente'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.summarySecondary}>Esta acción genera backup JSON automático antes de migrar.</Text>

          {compras.length === 0 ? (
            <Text style={styles.empty}>Aún no hay compras registradas.</Text>
          ) : (
            compras.map(purchase => (
              <View key={purchase.id} style={styles.purchaseRow}>
                <View style={styles.purchaseInfo}>
                  <Text style={styles.purchaseTitle}>
                    {purchase.material} - {purchase.libras} lb
                  </Text>
                  <Text style={styles.purchaseSubtitle}>
                    {purchase.fecha} - {formatMoney(purchase.precioPorLibra)}/lb
                  </Text>
                </View>
                <View style={styles.purchaseActions}>
                  <Text style={styles.purchaseTotal}>{formatMoney(purchase.total)}</Text>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => void deletePurchaseHandler(purchase.id)}
                    disabled={deletingPurchaseId === purchase.id}>
                    <Text style={styles.deleteButtonText}>
                      {deletingPurchaseId === purchase.id ? '...' : 'Borrar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={materialModalVisible}
        animationType="fade"
        onRequestClose={closeMaterialModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{materialEditingId ? 'Editar material' : 'Nuevo material'}</Text>

            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={materialName}
              onChangeText={setMaterialName}
              placeholder="Ej: Hierro"
            />

            <Text style={styles.label}>Precio por libra</Text>
            <TextInput
              style={styles.input}
              value={materialPriceText}
              onChangeText={setMaterialPriceText}
              keyboardType="decimal-pad"
              placeholder="Ej: 1.80"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeMaterialModal}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={saveMaterialHandler} disabled={savingMaterial}>
                <Text style={styles.primaryButtonText}>{savingMaterial ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={clientModalVisible}
        animationType="fade"
        onRequestClose={closeClientModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuevo cliente</Text>

            <Text style={styles.label}>Nombre del cliente</Text>
            <TextInput
              style={styles.input}
              value={clientName}
              onChangeText={setClientName}
              placeholder="Ej: Cliente de mercado"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeClientModal}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={saveClientHandler} disabled={savingClient}>
                <Text style={styles.primaryButtonText}>{savingClient ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F4F8',
  },
  container: {
    padding: 16,
    paddingBottom: 28,
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
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
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  separator: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 2,
    paddingTop: 8,
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
  label: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '700',
  },
  summary: {
    color: '#0B5FFF',
    fontWeight: '800',
  },
  summarySecondary: {
    color: '#475569',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#0B5FFF',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: '#0B5FFF',
    fontWeight: '800',
  },
  materialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  materialCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 110,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  materialCardActive: {
    backgroundColor: '#0B5FFF',
    borderColor: '#0B5FFF',
  },
  materialTap: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  materialName: {
    fontWeight: '800',
    color: '#0F172A',
  },
  materialPrice: {
    color: '#475569',
    fontSize: 12,
    marginTop: 2,
  },
  materialEdit: {
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    paddingVertical: 7,
    alignItems: 'center',
  },
  materialEditText: {
    color: '#0B5FFF',
    fontWeight: '800',
    fontSize: 12,
  },
  onPrimary: {
    color: '#FFFFFF',
  },
  materialSelectedBox: {
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    padding: 10,
    gap: 4,
  },
  materialSelectedLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
    textTransform: 'uppercase',
  },
  materialSelectedValue: {
    color: '#0F172A',
    fontWeight: '700',
  },
  purchaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  purchaseInfo: {
    flex: 1,
    minWidth: 0,
  },
  purchaseTitle: {
    color: '#0F172A',
    fontWeight: '800',
  },
  purchaseSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  purchaseActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  purchaseTotal: {
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelButtonText: {
    color: '#334155',
    fontWeight: '800',
    fontSize: 16,
  },
});

export default PurchasesScreen;