// Updated PDFPreviewScreen with BearS&T theming
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

type PDFPreviewScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'PDFPreview'
>;
type PDFPreviewScreenRouteProp = RouteProp<RootStackParamList, 'PDFPreview'>;

interface Props {
  navigation: PDFPreviewScreenNavigationProp;
  route: PDFPreviewScreenRouteProp;
}

export default function PDFPreviewScreen({ navigation, route }: Props) {
  const { pdfUrl } = route.params;

  const handleShare = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUrl);
      } else {
        Alert.alert('Sharing not available', 'Unable to share on this device');
      }
    } catch (error) {
      console.error('Error sharing PDF:', error);
      Alert.alert('Error', 'Failed to share PDF');
    }
  };

  const handleNewReport = () => {
    navigation.navigate('Home');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.successCard}>
          <View style={styles.iconContainer}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Report Generated!</Text>
          <Text style={styles.successMessage}>
            Your PDF report has been created successfully
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Report Details</Text>
          <Text style={styles.infoText}>
            Location: {pdfUrl.split('/').pop()}
          </Text>
          <Text style={styles.infoText}>
            Format: PDF Document
          </Text>
          <Text style={styles.infoText}>
            Created: {new Date().toLocaleString()}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleShare}
          >
            <Text style={styles.primaryButtonText}>Download / Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleNewReport}
          >
            <Text style={styles.secondaryButtonText}>Create New Report</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // White background
  },
  content: {
    flex: 1,
    padding: 20,
  },
  successCard: {
    backgroundColor: '#F8F9FA', // Very light gray background
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF6B35', // Orange background
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkIcon: {
    fontSize: 40,
    color: '#FFFFFF', // White checkmark
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000', // Black text
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: '#666666', // Dark gray text
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#F8F9FA', // Very light gray background
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000', // Black text
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666666', // Dark gray text
    marginBottom: 8,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#FF6B35', // Orange background
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF', // White text
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F8F9FA', // Light gray background
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B35', // Orange border
  },
  secondaryButtonText: {
    color: '#FF6B35', // Orange text
    fontSize: 18,
    fontWeight: '600',
  },
});