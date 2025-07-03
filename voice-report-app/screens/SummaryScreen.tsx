// Updated SummaryScreen with BearS&T theming
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import Loader from '../components/Loader';
import { generatePDF } from '../services/api';

type SummaryScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Summary'
>;
type SummaryScreenRouteProp = RouteProp<RootStackParamList, 'Summary'>;

interface Props {
  navigation: SummaryScreenNavigationProp;
  route: SummaryScreenRouteProp;
}

export default function SummaryScreen({ navigation, route }: Props) {
  const { summary, transcription } = route.params;
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleGeneratePDF = async () => {
    try {
      setIsGeneratingPDF(true);
      const pdfUrl = await generatePDF({ summary, transcription });
      
      navigation.navigate('PDFPreview', {
        pdfUrl,
        summary,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (isGeneratingPDF) {
    return <Loader message="Creating PDF report..." />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>AI Summary</Text>

      <View style={styles.summaryCard}>
        <SummaryItem label="Task" value={summary.taskDescription} />
        
        {summary.location && (
          <SummaryItem label="Location" value={summary.location} />
        )}
        
        {summary.datetime && (
          <SummaryItem label="Date/Time" value={summary.datetime} />
        )}
        
        {summary.outcome && (
          <SummaryItem label="Outcome" value={summary.outcome} />
        )}
        
        {summary.notes && (
          <SummaryItem label="Additional Notes" value={summary.notes} />
        )}
      </View>

      <View style={styles.transcriptionSection}>
        <Text style={styles.sectionTitle}>Original Transcription</Text>
        <View style={styles.transcriptionCard}>
          <Text style={styles.transcriptionText}>{transcription}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.generateButton}
        onPress={handleGeneratePDF}
      >
        <Text style={styles.generateButtonText}>Generate PDF Report</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const SummaryItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.summaryItem}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // White background
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000', // Black text
    marginBottom: 20,
  },
  summaryCard: {
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
  summaryItem: {
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35', // Orange labels
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    color: '#000000', // Black text
    lineHeight: 22,
  },
  transcriptionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000', // Black text
    marginBottom: 12,
  },
  transcriptionCard: {
    backgroundColor: '#F8F9FA', // Very light gray background
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  transcriptionText: {
    fontSize: 14,
    color: '#666666', // Dark gray text
    lineHeight: 20,
  },
  generateButton: {
    backgroundColor: '#FF6B35', // Orange background
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  generateButtonText: {
    color: '#FFFFFF', // White text
    fontSize: 18,
    fontWeight: '600',
  },
});