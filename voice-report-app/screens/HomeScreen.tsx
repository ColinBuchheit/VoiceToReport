// voice-report-app/screens/HomeScreen.tsx - COMPLETE VERSION WITH ALL FIXES
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import Recorder from '../components/Recorder';
import EmailHistorySidebar from '../components/EmailHistorySidebar';
import { transcribeAudio } from '../services/api';
import { EmailHistoryItem } from '../services/emailHistoryService';

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

// Global state to persist across navigation
let persistedState: {
  checkedItems: Record<string, boolean>;
  showChecklist: boolean;
  shouldReset: boolean;
} = {
  checkedItems: {},
  showChecklist: true,
  shouldReset: false, // Flag to trigger complete reset
};

function HomeScreenInner({ navigation }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  // Initialize from persisted state
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(persistedState.checkedItems);
  const [showChecklist, setShowChecklist] = useState(persistedState.showChecklist);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false); // Settings modal visibility
  
  // Shared recording state - always reset to clean state
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Timer management
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Function to completely reset all state
  const resetAllState = () => {
    // Reset checklist state
    setCheckedItems({});
    setShowChecklist(true);
    
    // Reset recording state
    setIsRecording(false);
    setRecording(null);
    setRecordingDuration(0);
    setIsProcessing(false);
    
    // Clear any running timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Reset persisted state
    persistedState.checkedItems = {};
    persistedState.showChecklist = true;
    persistedState.shouldReset = false;
  };

  // Save state to persistence when values change
  useEffect(() => {
    if (!persistedState.shouldReset) {
      persistedState.checkedItems = checkedItems;
    }
  }, [checkedItems]);

  useEffect(() => {
    if (!persistedState.shouldReset) {
      persistedState.showChecklist = showChecklist;
    }
  }, [showChecklist]);

  // Handle navigation events - detect return from summary
  useFocusEffect(
    React.useCallback(() => {
      // Check if we should reset (coming back from summary screen)
      if (persistedState.shouldReset) {
        resetAllState();
        return;
      }
      
      // Otherwise, just clean up recording state (normal return from transcript)
      setIsRecording(false);
      setRecording(null);
      setRecordingDuration(0);
      setIsProcessing(false);
      
      // Clear any running timers
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, [])
  );

  // Listen for navigation state changes to detect summary completion
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Get the navigation state to check if we're coming from summary
      const routes = navigation.getState()?.routes || [];
      const currentIndex = navigation.getState()?.index || 0;
      
      // If we're coming back from a deeper screen (summary), reset everything
      if (routes.length > 1 && currentIndex === 0) {
        // Check if the previous route was summary by looking at navigation history
        const wasOnSummary = routes.some(route => route.name === 'Summary');
        if (wasOnSummary) {
          persistedState.shouldReset = true;
        }
      }
    });

    return unsubscribe;
  }, [navigation]);

  // Timer management - handles timer across view switches
  useEffect(() => {
    if (isRecording) {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setRecordingDuration((prev: number) => prev + 1);
        }, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  const criteriaCategories: CriteriaCategory[] = [
    {
      title: "Closeout Notes",
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
          label: "Is there a release code? If so, what is it?",
          hint: "Mention release code or say 'no release code'",
          required: true
        },
        {
          id: "return_tracking",
          label: "Is there a return tracking number? If so, what is it?",
          hint: "Mention tracking number or say 'no return tracking'",
          required: true
        }
      ]
    },
    {
      title: "Expenses",
      color: "#10B981",
      items: [
        {
          id: "expenses",
          label: "Did you have any expenses (parking fees, etc)?",
          hint: "List any expenses or say 'no expenses'",
          required: true
        },
        {
          id: "materials_used",
          label: "What materials did you use?",
          hint: "List materials used or say 'no materials used'",
          required: true
        }
      ]
    },
    {
      title: "Out of Scope",
      color: "#F59E0B",
      items: [
        {
          id: "out_of_scope_work",
          label: "Was there any out of scope work? If so, what is it and who approved the work?",
          hint: "Describe out of scope work and approval or say 'no out of scope work'",
          required: true
        }
      ]
    },
    {
      title: "Photos",
      color: "#8B5CF6",
      items: [
        {
          id: "photos_uploaded",
          label: "How many photos did you upload?",
          hint: "State number of photos uploaded or say 'no photos uploaded'",
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
      
      // Set flag to reset state when returning from the workflow
      persistedState.shouldReset = true;
      
      navigation.navigate('Transcript', {
        transcription: result.transcription,
        audioUri,
      });
    } catch (error) {
      console.error('Error processing audio:', error);
      Alert.alert('Error', 'Failed to process audio recording');
    } finally {
      setIsProcessing(false);
      setIsRecording(false);
      setRecording(null);
      setRecordingDuration(0);
    }
  };

  const handleEmailSelect = (email: EmailHistoryItem) => {
    console.log('📧 Selected email transcription length:', email.transcription?.length || 0);
    console.log('📧 Transcription preview:', email.transcription ? email.transcription.slice(0, 100) : 'EMPTY');
    navigation.navigate('Summary', {
      transcription: email.transcription || '',
      summary: email.summary,
    });
    // Close sidebar after initiating navigation so Summary shows without being covered
    setShowHistorySidebar(false);
  };

  const toggleItem = (id: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const insets = useSafeAreaInsets();

  // Settings Modal component
  const SettingsModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.settingsOverlay}>
        <TouchableOpacity
          style={styles.settingsBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.settingsPanel}>
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsTitle}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.settingsCloseButton}>
              <Text style={styles.settingsCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.settingsContent} showsVerticalScrollIndicator={false}>
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>App Settings</Text>
              <TouchableOpacity style={styles.settingsItem}>
                <Text style={styles.settingsItemLabel}>Account</Text>
                <Text style={styles.settingsItemArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsItem}>
                <Text style={styles.settingsItemLabel}>Notifications</Text>
                <Text style={styles.settingsItemArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsItem}>
                <Text style={styles.settingsItemLabel}>Email Preferences</Text>
                <Text style={styles.settingsItemArrow}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>About</Text>
              <View style={styles.settingsItem}>
                <Text style={styles.settingsItemLabel}>Version</Text>
                <Text style={styles.settingsItemValue}>1.0.0</Text>
              </View>
              <TouchableOpacity style={styles.settingsItem}>
                <Text style={styles.settingsItemLabel}>Help & Support</Text>
                <Text style={styles.settingsItemArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 8) }]}>    
      {/* Fixed Header - centered logo */}
      <View style={[styles.header, { paddingTop: (Platform.OS === 'ios' ? 10 : 20) + insets.top * 0.2 }]}> 
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
          /* Large Centered Record Button */
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

      {/* Bottom Navigation with Recorder */}
      {showChecklist && (
        <View style={styles.bottomNavContainer}>
          {/* Left (History) */}
          <View style={styles.navSide}>
            <TouchableOpacity
              style={styles.bottomNavButton}
              onPress={() => setShowHistorySidebar(true)}
              activeOpacity={0.75}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Open email history"
            >
              <View style={[
                styles.navIconContainer,
                showHistorySidebar && styles.navIconContainerActive
              ]}>
                <Ionicons
                  name="mail-outline"
                  size={24}
                  color={showHistorySidebar ? '#FFFFFF' : '#FF6B35'}
                />
              </View>
              <Text style={[styles.navLabel, showHistorySidebar && styles.navLabelActive]}>History</Text>
            </TouchableOpacity>
          </View>

          {/* Center Recorder (kept visually centered) */}
          <View style={styles.recorderWrapper} pointerEvents="box-none">
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

          {/* Right (Settings) */}
          <View style={styles.navSide}>
            <TouchableOpacity
              style={styles.bottomNavButton}
              onPress={() => setShowSettings(true)}
              activeOpacity={0.75}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              <View style={[
                styles.navIconContainer,
                showSettings && styles.navIconContainerActive
              ]}>
                <Ionicons
                  name="settings-outline"
                  size={24}
                  color={showSettings ? '#FFFFFF' : '#FF6B35'}
                />
              </View>
              <Text style={[styles.navLabel, showSettings && styles.navLabelActive]}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Email History Sidebar */}
      <EmailHistorySidebar
        visible={showHistorySidebar}
        onClose={() => setShowHistorySidebar(false)}
        onEmailSelect={handleEmailSelect}
      />

      {/* Settings Modal */}
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
    </View>
  );
}

export default function HomeScreen(props: Props) {
  return (
    <SafeAreaProvider>
      <HomeScreenInner {...props} />
    </SafeAreaProvider>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 180,
    height: 50,
    alignSelf: 'center',
  },
  // Removed old emailHistoryButton & emailIcon in favor of bottom navigation
  
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
  progressInfo: { flex: 1 },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  progressDetails: { fontSize: 13, color: '#6B7280' },
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
  
  // Bottom Navigation Container
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  navSide: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bottomNavButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  navIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#FFE4D7', // light brand tint
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#FFC8B0',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  navIconContainerActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
    transform: [{ scale: 1.05 }],
  },
  navIcon: { fontSize: 24 },
  navLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  recorderWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    paddingHorizontal: 8,
  },

  // Settings modal styles
  settingsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  settingsBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  settingsPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  settingsCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsCloseText: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: '600',
  },
  settingsContent: {
    flex: 1,
  },
  settingsSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  settingsSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingsItemLabel: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  settingsItemValue: {
    fontSize: 16,
    color: '#6B7280',
  },
  settingsItemArrow: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '400',
  },
});