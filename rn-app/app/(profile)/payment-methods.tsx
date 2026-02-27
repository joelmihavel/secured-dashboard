/**
 * Payment Methods Management Screen
 *
 * Lists saved payment methods with ability to delete, set as default, and add new.
 * Uses FlatList for the methods list with swipe-to-delete via long-press confirmation.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, BackButton } from '@/src/components';
import { DottedGridPattern } from '@/src/components/patterns';
import {
  useSavedPaymentMethods,
  useDeletePaymentMethod,
  useSetDefaultPaymentMethod,
} from '@/src/hooks';
import type { SavedPaymentMethod } from '@/src/services/api/payments';
import { colors } from '@/src/theme';

// ==============================================
// DESIGN TOKENS
// ==============================================

const COLORS = {
  background: colors.black[700],
  card: colors.black[500],
  accent: colors.brand[500],
  label: '#878787',
  value: '#CBCBCB',
  white: colors.white,
  divider: colors.black[400],
  defaultBadgeBg: 'rgba(255, 154, 109, 0.15)',
  emptyText: '#A9A9A9',
};

// ==============================================
// ICONS
// ==============================================

const UpiIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2L2 7V17L12 22L22 17V7L12 2Z"
      stroke={COLORS.accent}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    <Path
      d="M12 8V16M8 10L12 8L16 10"
      stroke={COLORS.accent}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const CardIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 6C3 4.89543 3.89543 4 5 4H19C20.1046 4 21 4.89543 21 6V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V6Z"
      stroke={COLORS.accent}
      strokeWidth={1.5}
    />
    <Path d="M3 10H21" stroke={COLORS.accent} strokeWidth={1.5} />
    <Path d="M7 15H11" stroke={COLORS.accent} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

const BankIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 21H21M3 10H21M5 10V17M9 10V17M15 10V17M19 10V17M12 3L21 10H3L12 3Z"
      stroke={COLORS.accent}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

function MethodTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'upi':
      return <UpiIcon />;
    case 'card':
      return <CardIcon />;
    case 'netbanking':
      return <BankIcon />;
    default:
      return <UpiIcon />;
  }
}

// ==============================================
// METHOD CARD COMPONENT
// ==============================================

interface MethodCardProps {
  method: SavedPaymentMethod;
  onEdit: (method: SavedPaymentMethod) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  isDeleting: boolean;
  isSettingDefault: boolean;
}

function MethodCard({ method, onEdit, onDelete, onSetDefault, isDeleting, isSettingDefault }: MethodCardProps) {
  const displayInfo = useMemo(() => {
    switch (method.type) {
      case 'upi':
        return method.vpa ?? method.display_name;
      case 'card':
        return method.last_four ? `**** ${method.last_four}` : method.display_name;
      case 'netbanking':
        return method.bank_name ?? method.display_name;
      default:
        return method.display_name;
    }
  }, [method]);

  const typeName = useMemo(() => {
    switch (method.type) {
      case 'upi':
        return 'UPI';
      case 'card': {
        const cardTypeLabel = method.card_type === 'debit' ? 'Debit' : 'Credit';
        const network = method.card_network
          ? method.card_network.charAt(0).toUpperCase() + method.card_network.slice(1)
          : '';
        return network ? `${cardTypeLabel} · ${network}` : `${cardTypeLabel} Card`;
      }
      case 'netbanking':
        return 'Net Banking';
      default:
        return method.type;
    }
  }, [method]);

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Payment Method',
      `Are you sure you want to delete ${displayInfo}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(method.id),
        },
      ]
    );
  }, [method.id, displayInfo, onDelete]);

  const handleSetDefault = useCallback(() => {
    if (method.is_default) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSetDefault(method.id);
  }, [method.id, method.is_default, onSetDefault]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEdit(method);
  }, [method, onEdit]);

  return (
    <TouchableOpacity
      style={styles.methodCard}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      disabled={isDeleting}
      accessibilityRole="button"
      accessibilityLabel={`${typeName} ${displayInfo}${method.is_default ? ', default' : ''}`}
      accessibilityHint="Tap to edit, long press to delete"
    >
      <View style={styles.methodCardContent}>
        <View style={styles.methodIconContainer}>
          <MethodTypeIcon type={method.type} />
        </View>

        <View style={styles.methodInfo}>
          <View style={styles.methodNameRow}>
            <Text style={styles.methodTypeName}>{typeName}</Text>
            {method.is_default && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            )}
          </View>
          <Text style={styles.methodDetails} numberOfLines={1}>
            {displayInfo}
          </Text>
        </View>

        {!method.is_default && (
          <TouchableOpacity
            style={styles.setDefaultButton}
            onPress={handleSetDefault}
            disabled={isSettingDefault}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isSettingDefault ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <Text style={styles.setDefaultText}>Set default</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ==============================================
// EMPTY STATE
// ==============================================

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No saved payment methods</Text>
      <Text style={styles.emptySubtitle}>
        Add a payment method when you make your first payment.
      </Text>
    </View>
  );
}

// ==============================================
// MAIN COMPONENT
// ==============================================

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { data: methods, isLoading } = useSavedPaymentMethods();
  const deleteMethod = useDeletePaymentMethod();
  const setDefault = useSetDefaultPaymentMethod();

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteMethod.mutate(id);
    },
    [deleteMethod]
  );

  const handleSetDefault = useCallback(
    (id: string) => {
      setDefault.mutate(id);
    },
    [setDefault]
  );

  const handleEdit = useCallback(
    (method: SavedPaymentMethod) => {
      router.push({
        pathname: '/(profile)/edit-payment-method',
        params: {
          type: method.type,
          id: method.id,
          ...(method.type === 'card' && method.card_type ? { card_type: method.card_type } : {}),
        },
      } as never);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: SavedPaymentMethod }) => (
      <MethodCard
        method={item}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSetDefault={handleSetDefault}
        isDeleting={deleteMethod.isPending}
        isSettingDefault={setDefault.isPending}
      />
    ),
    [handleEdit, handleDelete, handleSetDefault, deleteMethod.isPending, setDefault.isPending]
  );

  const keyExtractor = useCallback((item: SavedPaymentMethod) => item.id, []);

  return (
    <Screen testID="payment-methods-screen" padded={false}>
      <DottedGridPattern animated={false} />
      {/* Header */}
      <View style={styles.header}>
        <BackButton
          onPress={handleBack}
          style={styles.backButton}
          color={COLORS.white}
        />
        <Text style={styles.headerTitle}>Payment Methods</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={methods ?? []}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={EmptyState}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </Screen>
  );
}

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 20,
    lineHeight: 28,
    color: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    flexGrow: 1,
  },
  separator: {
    height: 12,
  },
  methodCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
  },
  methodCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  methodIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 154, 109, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodInfo: {
    flex: 1,
    gap: 2,
  },
  methodNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodTypeName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.value,
  },
  defaultBadge: {
    backgroundColor: COLORS.defaultBadgeBg,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
    lineHeight: 14,
    color: COLORS.accent,
  },
  methodDetails: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.label,
  },
  setDefaultButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  setDefaultText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.accent,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.value,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.emptyText,
    textAlign: 'center',
  },
});
