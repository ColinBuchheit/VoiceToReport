// Updated Loader component with BearS&T theming
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface LoaderProps {
  message?: string;
}

export default function Loader({ message = 'Loading...' }: LoaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.loaderCard}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // White background
  },
  loaderCard: {
    backgroundColor: '#F8F9FA', // Very light gray background
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: '#000000', // Black text
    fontWeight: '500',
  },
});