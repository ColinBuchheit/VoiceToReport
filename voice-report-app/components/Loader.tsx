// Updated Loader component with BearS&T theming and font scaling
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFontScale } from '../context/FontScaleContext';
import { useTheme } from '../context/ThemeContext';

interface LoaderProps {
  message?: string;
}

export default function Loader({ message = 'Loading...' }: LoaderProps) {
  const { scaled } = useFontScale();
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.loaderCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.message, { color: colors.textPrimary, fontSize: scaled(16) }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // themed dynamically
  },
  loaderCard: {
    backgroundColor: '#F8F9FA', // themed dynamically
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB', // themed dynamically
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  message: {
    marginTop: 16,
    fontSize: 16, // scaled dynamically
    color: '#000000', // themed dynamically
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 320,
    flexShrink: 1,
  },
});