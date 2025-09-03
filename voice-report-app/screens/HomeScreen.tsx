// voice-report-app/screens/HomeScreen.tsx - COMPLETE FIXED VERSION
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  Image,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Recorder from '../components/Recorder';
import { transcribeAudio } from '../services/api';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

interface CriteriaItem {
  id: string;
  label: string;
  hint: string;
  required: boolean;
}

interface CriteriaCategory {
  title: string;
  color: string;
  items: CriteriaItem[];
}

export default function HomeScreen({ navigation }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [showChecklist, setShowChecklist] = useState(true);
  
  // Shared recording state - lifted up from Recorder components
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const criteriaCategories: CriteriaCategory[] = [
    {
      title: "Closeout Information",
      color: "#000000",
      items: [
        {
          id: "onsite_contact",
          label: "Who did you meet with on-site?",
          hint: "Mention the name of your on-site contact",
          required: true
        },
        {
          id: "support_contact", 
          label: "Who did you work with for support?",
          hint: "Name the support person or company",
          required: true
        },
        {
          id: "work_completed",
          label: "What work was completed?",
          hint: "Describe all tasks and technical work done",
          required: true
        },
        {
          id: "scope_completed",
          label: "Was the scope completed successfully?",
          hint: "Say yes/no and explain the outcome",
          required: true
        },
        {
          id: "released_by",
          label: "Who released you?",
          hint: "Name of person who signed off on completion",
          required: true
        }
      ]
    },
    {
      title: "Technical Details",
      color: "#FF6B35",
      items: [
        {
          id: "delays",
          label: "Were there any delays?",
          hint: "Mention any delays or say 'no delays'",
          required: true
        },
        {
          id: "troubleshooting_steps",
          label: "What troubleshooting steps did you take?",
          hint: "Describe debugging or problem-solving steps",
          required: true
        },
        {
          id: "release_code",
          label: "Is there a release code?",
          hint: "Provide any completion or release codes",
          required: false
        },
        {
          id: "return_tracking",
          label: "Return tracking number?",
          hint: "Any tracking numbers for returned items",
          required: false
        }
      ]
    },
    {
      title: "Resources & Documentation",
      color: "#6B7280",
      items: [
        {
          id: "materials_used",
          label: "What materials did you use?",
          hint: "List equipment, parts, or supplies used",
          required: true
        },
        {
          id: "expenses",
          label: "Any expenses (parking, etc.)?",
          hint: "Mention parking fees, tolls, or other costs",
          required: true
        },
        {
          id: "out_of_scope_work",
          label: "Any out of scope work?",
          hint: "Describe additional work and who approved it",
          required: false
        },
        {
          id: "photos_uploaded",
          label: "How many photos did you upload?",
          hint: "State the number of photos taken",
          required: false
        },
        {
          id: "location",
          label: "Work location",
          hint: "Where was the work performed?",
          required: true
        },
        {
          id: "technician_name",
          label: "Your name",
          hint: "State your name as the technician",
          required: true
        },
        {
          id: "datetime",
          label: "Date and time",
          hint: "When was the work completed?",
          required: true
        }
      ]
    }
  ];

  const totalItems = criteriaCategories.reduce((sum, cat) => sum + cat.items.length, 0);
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const requiredItems = criteriaCategories.flatMap(cat => cat.items.filter(item => item.required));
  const checkedRequiredCount = requiredItems.filter(item => checkedItems[item.id]).length;
  const progressPercent = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  const handleRecordingComplete = async (audioUri: string) => {
    try {
      setIsProcessing(true);
      const result = await transcribeAudio(audioUri);
      
      navigation.navigate('Transcript', {
        transcription: result.transcription,
        audioUri,
      });
    } catch (error) {
      console.error('Error processing audio:', error);
      Alert.alert('Error', 'Failed to process audio recording');
    } finally {
      setIsProcessing(false);
      // Reset shared recording state
      setIsRecording(false);
      setRecording(null);
      setRecordingDuration(0);
    }
  };

  const toggleItem = (id: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <Image 
          source={require('../assets/bears&t.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Progress Summary */}
      <View style={styles.progressSummary}>
        <View style={styles.progressInfo}>
          <Text style={styles.progressTitle}>Report Progress</Text>
          <Text style={styles.progressDetails}>
            {checkedRequiredCount}/{requiredItems.length} required • {checkedCount}/{totalItems} total
          </Text>
        </View>
        <View style={styles.progressCircle}>
          <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>
      </View>

      {/* Content Area */}
      <View style={styles.contentContainer}>
        <View style={styles.contentHeader}>
          <TouchableOpacity 
            style={styles.toggleButton}
            onPress={() => setShowChecklist(!showChecklist)}
          >
            <Text style={styles.toggleText}>
              {showChecklist ? 'Hide Checklist' : 'Show Checklist'}
            </Text>
          </TouchableOpacity>
        </View>

        {showChecklist ? (
          /* Checklist View */
          <ScrollView 
            style={styles.checklistContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.checklistContent}
          >
            {criteriaCategories.map((category) => {
              const categoryChecked = category.items.filter(item => checkedItems[item.id]).length;
              
              return (
                <View key={category.title} style={styles.categorySection}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryTitle}>{category.title}</Text>
                    <Text style={styles.categoryProgress}>
                      {categoryChecked}/{category.items.length}
                    </Text>
                  </View>
                  
                  {category.items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.checklistItem,
                        checkedItems[item.id] && styles.checklistItemChecked
                      ]}
                      onPress={() => toggleItem(item.id)}
                    >
                      <View style={styles.itemCheckbox}>
                        {checkedItems[item.id] && <View style={styles.checkmark} />}
                      </View>
                      
                      <View style={styles.itemContent}>
                        <View style={styles.itemLabelRow}>
                          <Text style={[
                            styles.itemLabel,
                            checkedItems[item.id] && styles.itemLabelChecked
                          ]}>
                            {item.label}
                          </Text>
                          {item.required && (
                            <View style={styles.requiredDot} />
                          )}
                        </View>
                        <Text style={styles.itemHint}>{item.hint}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}

            <View style={styles.bottomPadding} />
          </ScrollView>
        ) : (
          /* Large Centered Record Button - With shared state */
          <View style={styles.centeredRecorderView}>
            <Recorder
              onRecordingComplete={handleRecordingComplete}
              isProcessing={isProcessing}
              size="large"
              isRecording={isRecording}
              setIsRecording={setIsRecording}
              recording={recording}
              setRecording={setRecording}
              recordingDuration={recordingDuration}
              setRecordingDuration={setRecordingDuration}
            />
          </View>
        )}
      </View>

      {/* Fixed Bottom Recorder - With shared state */}
      {showChecklist && (
        <View style={styles.recorderContainer}>
          <Recorder
            onRecordingComplete={handleRecordingComplete}
            isProcessing={isProcessing}
            size="small"
            isRecording={isRecording}
            setIsRecording={setIsRecording}
            recording={recording}
            setRecording={setRecording}
            recordingDuration={recordingDuration}
            setRecordingDuration={setRecordingDuration}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // Fixed Header
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 180,
    height: 50,
    alignSelf: 'center',
  },
  
  // Progress Summary
  progressSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressInfo: {
    flex: 1,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  progressDetails: {
    fontSize: 13,
    color: '#6B7280',
  },
  progressCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  
  // Content Container
  contentContainer: {
    flex: 1,
  },
  contentHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  toggleButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  
  // Checklist
  checklistContainer: {
    flex: 1,
  },
  checklistContent: {
    padding: 20,
  },
  
  // Centered Recorder View - Enhanced for large button
  centeredRecorderView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  
  // Category Sections
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  categoryProgress: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  
  // Checklist Items
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  checklistItemChecked: {
    opacity: 0.7,
  },
  itemCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#10B981',
  },
  itemContent: {
    flex: 1,
  },
  itemLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
    flex: 1,
  },
  itemLabelChecked: {
    textDecorationLine: 'line-through',
    color: '#6B7280',
  },
  requiredDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginLeft: 8,
  },
  itemHint: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  
  bottomPadding: {
    height: 20,
  },
  
  // Fixed Bottom Recorder
  recorderContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
});