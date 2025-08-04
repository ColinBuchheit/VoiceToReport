// voice-report-app/screens/HomeScreen.tsx - Updated with Always-Visible Recorder & All Required Fields
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
} from 'react-native';
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

  const toggleItem = (id: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const criteriaCategories: CriteriaCategory[] = [
    {
      title: "Closeout Notes",
      color: "#3B82F6",
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
        },
        {
          id: "release_code",
          label: "Is there a release code?",
          hint: "Provide any completion or release codes",
          required: true
        },
        {
          id: "return_tracking",
          label: "Return tracking number?",
          hint: "Any tracking numbers for returned items",
          required: true
        }
      ]
    },
    {
      title: "Expenses & Materials",
      color: "#10B981",
      items: [
        {
          id: "expenses",
          label: "Any expenses (parking, etc.)?",
          hint: "Mention parking fees, tolls, or other costs",
          required: true
        },
        {
          id: "materials_used",
          label: "What materials did you use?",
          hint: "List equipment, parts, or supplies used",
          required: true
        }
      ]
    },
    {
      title: "Out of Scope Work",
      color: "#F59E0B",
      items: [
        {
          id: "out_of_scope_work",
          label: "Any out of scope work?",
          hint: "Describe additional work and who approved it",
          required: true
        }
      ]
    },
    {
      title: "Photos & Documentation",
      color: "#8B5CF6",
      items: [
        {
          id: "photos_uploaded",
          label: "How many photos did you upload?",
          hint: "State the number of photos taken",
          required: true
        }
      ]
    },
    {
      title: "Basic Information",
      color: "#6B7280",
      items: [
        {
          id: "location",
          label: "Location",
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
    }
  };

  const CheckIcon = () => (
    <View style={styles.checkIcon}>
      <Text style={styles.checkText}>✓</Text>
    </View>
  );

  const CircleIcon = () => (
    <View style={styles.circleIcon} />
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContainer}>
        {/* Fixed Header with Logo and Recorder */}
        <View style={styles.fixedHeader}>
          <Image 
            source={require('../assets/bears&t.png')} 
            style={styles.headerLogo}
            resizeMode="contain"
          />
          
          {/* Always Visible Recorder */}
          <View style={styles.recorderContainer}>
            <Recorder
              onRecordingComplete={handleRecordingComplete}
              isProcessing={isProcessing}
            />
          </View>
        </View>

        {/* Checklist Toggle */}
        <View style={styles.checklistToggle}>
          <TouchableOpacity 
            style={[
              styles.toggleButton,
              showChecklist ? styles.toggleButtonActive : styles.toggleButtonInactive
            ]}
            onPress={() => setShowChecklist(!showChecklist)}
          >
            <Text style={[
              styles.toggleText,
              showChecklist ? styles.toggleTextActive : styles.toggleTextInactive
            ]}>
              {showChecklist ? 'Hide Checklist' : 'Show Checklist'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable Checklist Content */}
        {showChecklist && (
          <ScrollView 
            style={styles.checklistContainer} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.checklistContent}
          >
            {/* Checklist Header */}
            <View style={styles.checklistHeader}>
              <Text style={styles.checklistTitle}>Report Criteria Checklist</Text>
              <Text style={styles.checklistSubtitle}>
                Cover these points when speaking your report
              </Text>
            </View>

            {/* Progress Section */}
            <View style={styles.progressSection}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { width: `${(checkedCount / totalItems) * 100}%` }
                  ]} 
                />
              </View>
              
              <View style={styles.progressStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Progress:</Text>
                  <Text style={styles.statValue}>{checkedCount}/{totalItems}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statRequiredLabel}>Required:</Text>
                  <Text style={styles.statRequiredValue}>{checkedRequiredCount}/{requiredItems.length}</Text>
                </View>
              </View>
            </View>

            {/* Speaking Tips */}
            <View style={styles.tipsSection}>
              <Text style={styles.tipsTitle}>Speaking Tips</Text>
              <Text style={styles.tipText}>• Speak clearly and at a normal pace</Text>
              <Text style={styles.tipText}>• Use natural language - say "I met with John Smith"</Text>
              <Text style={styles.tipText}>• You can cover items in any order</Text>
              <Text style={styles.tipText}>• If something doesn't apply, just say "no delays"</Text>
              <Text style={styles.tipText}>• Check off items as you mention them</Text>
            </View>

            {/* Checklist Categories */}
            {criteriaCategories.map((category) => (
              <View key={category.title} style={styles.categoryContainer}>
                {/* Category Header */}
                <View style={[styles.categoryHeader, { backgroundColor: category.color }]}>
                  <Text style={styles.categoryTitle}>{category.title}</Text>
                  <Text style={styles.categoryProgress}>
                    {category.items.filter(item => checkedItems[item.id]).length}/{category.items.length}
                  </Text>
                </View>
                
                {/* Category Items */}
                <View style={styles.categoryContent}>
                  {category.items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.criteriaItem,
                        checkedItems[item.id] && styles.criteriaItemChecked
                      ]}
                      onPress={() => toggleItem(item.id)}
                    >
                      <View style={styles.criteriaLeft}>
                        {checkedItems[item.id] ? <CheckIcon /> : <CircleIcon />}
                      </View>
                      
                      <View style={styles.criteriaContent}>
                        <View style={styles.criteriaHeader}>
                          <Text style={[
                            styles.criteriaLabel,
                            checkedItems[item.id] && styles.criteriaLabelChecked
                          ]}>
                            {item.label}
                          </Text>
                          {item.required && (
                            <View style={styles.requiredBadge}>
                              <Text style={styles.requiredText}>REQUIRED</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[
                          styles.criteriaHint,
                          checkedItems[item.id] && styles.criteriaHintChecked
                        ]}>
                          {item.hint}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            {/* Bottom spacing for scroll */}
            <View style={styles.bottomSpacing} />
          </ScrollView>
        )}

        {/* Simple recording view when checklist is hidden */}
        {!showChecklist && (
          <View style={styles.simpleRecordingView}>
            <Text style={styles.simpleRecordingText}>
              Ready to record your report
            </Text>
            <Text style={styles.simpleRecordingSubtext}>
              Tap the microphone above to start recording
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mainContainer: {
    flex: 1,
  },
  
  // Fixed Header with Logo and Recorder
  fixedHeader: {
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 1000,
  },
  headerLogo: {
    width: 200,
    height: 60,
    alignSelf: 'center',
    marginBottom: 15,
  },
  recorderContainer: {
    alignItems: 'center',
  },
  
  // Checklist Toggle
  checklistToggle: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  toggleButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#FF6B35',
  },
  toggleButtonInactive: {
    backgroundColor: '#6B7280',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: 'white',
  },
  toggleTextInactive: {
    color: 'white',
  },
  
  // Checklist Container
  checklistContainer: {
    flex: 1,
  },
  checklistContent: {
    paddingBottom: 20,
  },
  checklistHeader: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  checklistTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  checklistSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  
  // Progress Section
  progressSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 12,
  },
  progressFill: {
    height: 8,
    backgroundColor: '#FF6B35',
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 25,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  statRequiredLabel: {
    fontSize: 14,
    color: '#DC2626',
  },
  statRequiredValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  
  // Tips Section
  tipsSection: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 8,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#1E40AF',
    marginBottom: 3,
  },
  
  // Category Styles
  categoryContainer: {
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  categoryProgress: {
    fontSize: 13,
    color: 'white',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  categoryContent: {
    padding: 12,
  },
  
  // Criteria Item Styles
  criteriaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  criteriaItemChecked: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  criteriaLeft: {
    marginRight: 10,
    marginTop: 2,
  },
  checkIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  circleIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
  },
  criteriaContent: {
    flex: 1,
  },
  criteriaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  criteriaLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
    flex: 1,
  },
  criteriaLabelChecked: {
    color: '#065F46',
  },
  requiredBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginLeft: 6,
  },
  requiredText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#DC2626',
  },
  criteriaHint: {
    fontSize: 13,
    color: '#6B7280',
  },
  criteriaHintChecked: {
    color: '#047857',
  },
  
  // Simple Recording View
  simpleRecordingView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  simpleRecordingText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  simpleRecordingSubtext: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  
  bottomSpacing: {
    height: 30,
  },
});