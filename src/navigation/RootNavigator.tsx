import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { enableScreens } from 'react-native-screens';

import DashboardScreen from '../screens/DashboardScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import PurchasesScreen from '../screens/PurchasesScreen';
import SalesScreen from '../screens/SalesScreen';

enableScreens(true);

type TabParamList = {
  Dashboard: undefined;
  Compras: undefined;
  Ventas: undefined;
  Gastos: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#0B5FFF',
          tabBarInactiveTintColor: '#64748B',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E2E8F0',
          },
          tabBarIcon: ({ color, size }) => {
            const iconName =
              route.name === 'Dashboard'
                ? 'ios-stats-chart'
                : route.name === 'Compras'
                ? 'cart'
                : route.name === 'Ventas'
                ? 'cash'
                : 'wallet';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}>
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Compras" component={PurchasesScreen} />
        <Tab.Screen name="Ventas" component={SalesScreen} />
        <Tab.Screen name="Gastos" component={ExpensesScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default RootNavigator;