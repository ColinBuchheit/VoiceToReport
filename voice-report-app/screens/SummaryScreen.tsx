// Enhanced SummaryScreen with integrated PDF preview and Bears&T logo
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
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

interface EditableSummary {
  taskDescription: string;
  location: string;
  datetime: string;
  outcome: string;
  notes: string;
}

export default function SummaryScreen({ navigation, route }: Props) {
  const { summary, transcription } = route.params;
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  
  // Editable summary state
  const [editableSummary, setEditableSummary] = useState<EditableSummary>({
    taskDescription: summary.taskDescription || '',
    location: summary.location || '',
    datetime: summary.datetime || '',
    outcome: summary.outcome || '',
    notes: summary.notes || '',
  });
  
  const [editableTranscription, setEditableTranscription] = useState(transcription);

  const handleGeneratePDF = async () => {
    try {
      setIsGeneratingPDF(true);
      const finalSummary = {
        ...summary,
        ...editableSummary,
      };
      
      const pdfUrl = await generatePDF({ 
        summary: finalSummary, 
        transcription: editableTranscription 
      });
      
      navigation.navigate('PDFPreview', {
        pdfUrl,
        summary: finalSummary,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const updateSummaryField = (field: keyof EditableSummary, value: string) => {
    setEditableSummary(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (isGeneratingPDF) {
    return <Loader message="Creating PDF report..." />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>AI Summary & PDF Preview</Text>
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setIsPreviewMode(!isPreviewMode)}
        >
          <Text style={styles.toggleButtonText}>
            {isPreviewMode ? 'Edit Mode' : 'Preview Mode'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* PDF Preview Section */}
      <View style={styles.pdfPreviewContainer}>
        <View style={styles.pdfPreviewHeader}>
          <Text style={styles.previewTitle}>📄 PDF Preview</Text>
          <Text style={styles.previewSubtitle}>
            {isPreviewMode ? 'Tap "Edit Mode" to modify fields' : 'Editing enabled - changes appear in real-time'}
          </Text>
        </View>

        {/* PDF Document Mock */}
        <View style={styles.pdfDocument}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <Image 
              source={require('../assets/bears&t.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Document Title */}
          <Text style={styles.documentTitle}>WORK REPORT</Text>

          {/* Metadata */}
          <View style={styles.metadataSection}>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Report Generated:</Text>
              <Text style={styles.metadataValue}>{new Date().toLocaleDateString()}</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Report Type:</Text>
              <Text style={styles.metadataValue}>Voice-to-Text Work Summary</Text>
            </View>
          </View>

          {/* Summary Section */}
          <View style={styles.summarySection}>
            <Text style={styles.sectionHeading}>SUMMARY</Text>
            <View style={styles.sectionDivider} />

            <EditableField
              label="Task Description"
              value={editableSummary.taskDescription}
              onChangeText={(text) => updateSummaryField('taskDescription', text)}
              isEditing={!isPreviewMode}
              multiline
            />

            <EditableField
              label="Location"
              value={editableSummary.location}
              onChangeText={(text) => updateSummaryField('location', text)}
              isEditing={!isPreviewMode}
              placeholder="Not specified"
            />

            <EditableField
              label="Date/Time"
              value={editableSummary.datetime}
              onChangeText={(text) => updateSummaryField('datetime', text)}
              isEditing={!isPreviewMode}
              placeholder="Not specified"
            />

            <EditableField
              label="Outcome"
              value={editableSummary.outcome}
              onChangeText={(text) => updateSummaryField('outcome', text)}
              isEditing={!isPreviewMode}
              multiline
              placeholder="Not specified"
            />

            <EditableField
              label="Additional Notes"
              value={editableSummary.notes}
              onChangeText={(text) => updateSummaryField('notes', text)}
              isEditing={!isPreviewMode}
              multiline
              placeholder="None"
            />
          </View>

          {/* Transcription Section */}
          <View style={styles.transcriptionSection}>
            <Text style={styles.sectionHeading}>FULL TRANSCRIPTION</Text>
            <View style={styles.sectionDivider} />

            <View style={styles.transcriptionContainer}>
              {isPreviewMode ? (
                <Text style={styles.transcriptionText}>
                  {editableTranscription}
                </Text>
              ) : (
                <TextInput
                  style={styles.transcriptionInput}
                  value={editableTranscription}
                  onChangeText={setEditableTranscription}
                  multiline
                  textAlignVertical="top"
                  placeholder="Transcription text..."
                />
              )}
            </View>
          </View>

          {/* Clean footer without AI text */}
        </View>
      </View>

      {/* Generate PDF Button */}
      <TouchableOpacity
        style={styles.generateButton}
        onPress={handleGeneratePDF}
      >
        <Text style={styles.generateButtonText}>Generate PDF Report</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// Editable Field Component
interface EditableFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  isEditing: boolean;
  multiline?: boolean;
  placeholder?: string;
}

const EditableField: React.FC<EditableFieldProps> = ({
  label,
  value,
  onChangeText,
  isEditing,
  multiline = false,
  placeholder = '',
}) => {
  const displayValue = value || placeholder;
  const isEmpty = !value;

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}:</Text>
      {isEditing ? (
        <TextInput
          style={[
            styles.fieldInput,
            multiline && styles.fieldInputMultiline,
          ]}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          placeholder={placeholder}
        />
      ) : (
        <Text style={[
          styles.fieldValue,
          isEmpty && styles.fieldValueEmpty,
        ]}>
          {displayValue}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  toggleButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pdfPreviewContainer: {
    marginBottom: 24,
  },
  pdfPreviewHeader: {
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  pdfDocument: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 150,
    height: 60,
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000000',
    marginBottom: 20,
  },
  metadataSection: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  metadataRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  metadataLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    width: 120,
  },
  metadataValue: {
    fontSize: 12,
    color: '#000000',
    flex: 1,
  },
  summarySection: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 5,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 15,
  },
  fieldContainer: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B35',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 18,
    paddingVertical: 4,
  },
  fieldValueEmpty: {
    color: '#999999',
    fontStyle: 'italic',
  },
  fieldInput: {
    fontSize: 14,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
  },
  fieldInputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  transcriptionSection: {
    marginBottom: 20,
  },
  transcriptionContainer: {
    paddingLeft: 10,
    minHeight: 100,
  },
  transcriptionText: {
    fontSize: 12,
    color: '#1A1A1A',
    lineHeight: 16,
  },
  transcriptionInput: {
    fontSize: 12,
    color: '#1A1A1A',
    lineHeight: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    padding: 8,
    backgroundColor: '#F9FAFB',
  },
  generateButton: {
    backgroundColor: '#FF6B35',
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});