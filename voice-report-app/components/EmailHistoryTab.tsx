// voice-report-app/components/EmailHistoryTab.tsx
import React, { JSX } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useFontScale } from '../context/FontScaleContext';

interface Props {
  onPress: () => void;
  emailCount?: number;
}

export default function EmailHistoryTab({ onPress, emailCount = 0 }: Props): JSX.Element {
  const { scaled } = useFontScale();
  return (
    <TouchableOpacity
      style={styles.tabContainer}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.tabContent}>
        <View style={styles.iconContainer}>
          <Text style={[styles.icon, { fontSize: scaled(20) }]}>📧</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.tabText, { fontSize: scaled(15) }]}>History</Text>
          {emailCount > 0 && (
            <View style={styles.badge}>
              <Text style={[styles.badgeText, { fontSize: scaled(11) }]}>{emailCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.arrow}>
          <Text style={[styles.arrowText, { fontSize: scaled(24) }]}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -50,
    zIndex: 1000,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    minWidth: 120,
  },
  iconContainer: {
    marginRight: 8,
  },
  icon: {
    fontSize: 20,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  badge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF6B35',
  },
  arrow: {
    marginLeft: 4,
  },
  arrowText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: -2,
  },
});