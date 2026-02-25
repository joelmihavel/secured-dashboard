/**
 * GatewayToggle — Dev-only gateway switcher
 * Shows a segmented control for switching between PayU and Cashfree.
 * Only renders when __DEV__ is true.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { usePaymentStore } from '@/src/stores/payment';
import { colors } from '@/src/theme';

export function GatewayToggle() {
  if (!__DEV__) return null;

  const activeGateway = usePaymentStore(state => state.activeGateway);
  const setActiveGateway = usePaymentStore(state => state.setActiveGateway);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Payment Gateway</Text>
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segment, activeGateway === 'payu' && styles.segmentActive]}
          onPress={() => setActiveGateway('payu')}
        >
          <View style={[styles.indicator, activeGateway === 'payu' ? styles.indicatorPayU : styles.indicatorInactive]} />
          <Text style={[styles.segmentText, activeGateway === 'payu' && styles.segmentTextActive]}>
            PayU
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeGateway === 'cashfree' && styles.segmentActive]}
          onPress={() => setActiveGateway('cashfree')}
        >
          <View style={[styles.indicator, activeGateway === 'cashfree' ? styles.indicatorCashfree : styles.indicatorInactive]} />
          <Text style={[styles.segmentText, activeGateway === 'cashfree' && styles.segmentTextActive]}>
            Cashfree
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.black[500],
  },
  label: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: colors.black[300],
    marginBottom: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.black[500],
    borderRadius: 8,
    padding: 2,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  segmentActive: {
    backgroundColor: colors.black[600],
  },
  segmentText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: colors.black[300],
  },
  segmentTextActive: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: colors.white,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  indicatorPayU: {
    backgroundColor: '#6366F1', // Indigo for PayU
  },
  indicatorCashfree: {
    backgroundColor: '#22C55E', // Green for Cashfree
  },
  indicatorInactive: {
    backgroundColor: colors.black[400],
  },
});
