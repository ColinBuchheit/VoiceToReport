// voice-report-app/screens/HomeScreen.tsx - COMPLETE VERSION WITH ALL FIXES
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Image, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useFontScale } from '../context/FontScaleContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import Recorder from '../components/Recorder';
import EmailHistorySidebar from '../components/EmailHistorySidebar';
import { transcribeAudio } from '../services/api';
import SettingsModal from '../components/SettingsModal'; // explicit import; TS should resolve .tsx
import emailHistoryService, { EmailHistoryItem } from '../services/emailHistoryService';
import { useTheme } from '../context/ThemeContext';
// Pre-require both logos so Metro bundles them and switching is instant
const LIGHT_LOGO = require('../assets/bears&t.png');
const DARK_LOGO = require('../assets/DarkModeLogo.png');

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
  const [emailCount, setEmailCount] = useState(0);
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

  // Handle navigation events - detect return from summary and clean up audio on blur
  useFocusEffect(
    React.useCallback(() => {
      // Ensure audio mode is sane on focus (particularly after Android back)
      (async () => {
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: false,
            staysActiveInBackground: false,
          });
        } catch (e) {
          console.warn('Audio mode set on focus failed (non-fatal):', e);
        }
      })();

      // Refresh email count when screen is focused
      (async () => {
        try {
          const emails = await emailHistoryService.getEmailHistory();
          setEmailCount(Array.isArray(emails) ? emails.length : 0);
        } catch (e) {
          setEmailCount(0);
        }
      })();

      // Check if we should reset (coming back from summary screen)
      if (persistedState.shouldReset) {
        resetAllState();
      } else {
        // Otherwise, just clean up recording state (normal return from transcript)
        setIsRecording(false);
        setRecording(null);
        setRecordingDuration(0);
        setIsProcessing(false);
      }
      
      // Clear any running timers
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Cleanup on blur: ensure mic is released and audio mode reset
      return () => {
        (async () => {
          try {
            if (recording) {
              await recording.stopAndUnloadAsync();
            }
          } catch {}
          setRecording(null);
          setIsRecording(false);
          setRecordingDuration(0);
          try {
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
              shouldDuckAndroid: false,
              playThroughEarpieceAndroid: false,
              staysActiveInBackground: false,
            });
          } catch (e2) {
            console.warn('Audio mode reset on blur failed (non-fatal):', e2);
          }
        })();
      };
    }, [recording])
  );

  // Listen for navigation state changes to detect summary completion
  useEffect(() => {
    // When the sidebar closes, refresh the email count (in case of deletes/restores)
    if (!showHistorySidebar) {
      (async () => {
        try {
          const emails = await emailHistoryService.getEmailHistory();
          setEmailCount(Array.isArray(emails) ? emails.length : 0);
        } catch (e) {
          setEmailCount(0);
        }
      })();
    }
  }, [showHistorySidebar]);

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
    const draftId = (email as any)?._draftId as string | undefined;
    navigation.navigate('Summary', {
      transcription: email.transcription || '',
      summary: email.summary,
      ...(draftId ? { draftId } : {}),
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
  const { scaled } = useFontScale();
  const { colors, isDark } = useTheme();
  // Space to ensure last checklist items (e.g., Photos) are not hidden behind bottom nav
  const bottomNavOverlaySpace = 160 + (Platform.OS === 'ios' ? insets.bottom : 0);

  // SettingsModal extracted to separate component to prevent remounts on each render (which caused flicker during recording updates)

  return (
  <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 8), backgroundColor: colors.background }]}>    
      {/* Fixed Header - centered logo */}
      <View style={[styles.header, { paddingTop: (Platform.OS === 'ios' ? 10 : 20) + insets.top * 0.2, backgroundColor: colors.surface, borderBottomColor: colors.border }]}> 
        <View style={styles.logoWrapper}> 
          <Image
            key={isDark ? 'dark-logo' : 'light-logo'}
            source={isDark ? DARK_LOGO : LIGHT_LOGO}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Progress Summary */}
      <View style={[styles.progressSummary, { backgroundColor: colors.surfaceAlt, borderBottomColor: colors.border }]}>
        <View style={styles.progressInfo}>
          <Text style={[styles.progressTitle, { fontSize: scaled(16), color: colors.textPrimary }]}>Report Progress</Text>
          <Text style={[styles.progressDetails, { fontSize: scaled(13), color: colors.textSecondary }]}>
            {checkedRequiredCount}/{requiredItems.length} required • {checkedCount}/{totalItems} total
          </Text>
        </View>
        <View style={[styles.progressCircle, { backgroundColor: colors.accent }]}>
          <Text style={[styles.progressPercent, { color: colors.accentContrast }]}>{progressPercent}%</Text>
        </View>
      </View>

      {/* Content Area */}
      <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
        <View style={styles.contentHeader}>
          <TouchableOpacity 
            style={[styles.toggleButton, { backgroundColor: isDark ? colors.surfaceAlt : '#F3F4F6' }]}
            onPress={() => setShowChecklist(!showChecklist)}
          >
            <Text style={[styles.toggleText, { fontSize: scaled(14), color: colors.textPrimary }]}>
              {showChecklist ? 'Hide Checklist' : 'Show Checklist'}
            </Text>
          </TouchableOpacity>
        </View>

        {showChecklist ? (
          /* Checklist View */
          <ScrollView 
            style={[styles.checklistContainer, { backgroundColor: colors.background }]}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.checklistContent, { paddingBottom: bottomNavOverlaySpace }]}
          >
            {criteriaCategories.map((category) => {
              const categoryChecked = category.items.filter(item => checkedItems[item.id]).length;
              
              return (
                <View key={category.title} style={styles.categorySection}>
                  <View style={[styles.categoryHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.categoryTitle, { fontSize: scaled(16), color: colors.textPrimary }]}>{category.title}</Text>
                    <Text style={[styles.categoryProgress, { backgroundColor: colors.surfaceAlt, color: colors.textSecondary }] }>
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
                      <View style={[styles.itemCheckbox, { borderColor: colors.border }] }>
                        {checkedItems[item.id] && <View style={[styles.checkmark, { backgroundColor: '#10B981' }]} />}
                      </View>
                      
                      <View style={styles.itemContent}>
                        <View style={styles.itemLabelRow}>
                          <Text style={[
                            styles.itemLabel,
                            { fontSize: scaled(15), color: colors.textPrimary },
                            checkedItems[item.id] && { textDecorationLine: 'line-through', color: colors.textSecondary }
                          ]}>
                            {item.label}
                          </Text>
                          {item.required && (
                            <View style={[styles.requiredDot, { backgroundColor: '#EF4444' }]} />
                          )}
                        </View>
                        <Text style={[styles.itemHint, { fontSize: scaled(13), lineHeight: scaled(16), color: colors.textSecondary }]}>{item.hint}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
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

      {/* Bottom Navigation: variant changes depending on checklist visibility */}
      {showChecklist ? (
        <View style={[styles.bottomNavContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }] }>
          {/* History */}
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
                { backgroundColor: isDark ? colors.surfaceAlt : '#FFE4D7', borderColor: isDark ? colors.border : '#FFC8B0' },
                showHistorySidebar && { backgroundColor: colors.accent, borderColor: colors.accent }
              ]}>
                <Ionicons
                  name="mail-outline"
                  size={24}
                  color={showHistorySidebar ? colors.accentContrast : colors.accent}
                />
                {emailCount > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: colors.accent, borderColor: colors.surface }] }>
                    <Text style={[styles.countBadgeText, { color: colors.accentContrast }]}>{emailCount}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.navLabel, { fontSize: scaled(12), color: showHistorySidebar ? colors.accent : colors.textSecondary } ]}>History</Text>
            </TouchableOpacity>
          </View>

          {/* Small inline recorder */}
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

          {/* Settings */}
          <View style={styles.navSide}>
            <TouchableOpacity
              style={styles.bottomNavButton}
              onPress={() => { console.log('⚙️ Settings button pressed'); setShowSettings(true); }}
              activeOpacity={0.75}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              <View style={[
                styles.navIconContainer,
                { backgroundColor: isDark ? colors.surfaceAlt : '#FFE4D7', borderColor: isDark ? colors.border : '#FFC8B0' },
                showSettings && { backgroundColor: colors.accent, borderColor: colors.accent }
              ]}>
                <Ionicons
                  name="settings-outline"
                  size={24}
                  color={showSettings ? colors.accentContrast : colors.accent}
                />
              </View>
              <Text style={[styles.navLabel, { fontSize: scaled(12), color: showSettings ? colors.accent : colors.textSecondary }]}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[styles.bottomNavContainer, styles.bottomNavContainerSimple, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={styles.simpleButtonsRow}>
            <TouchableOpacity
              style={styles.simpleNavButton}
              onPress={() => setShowHistorySidebar(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open email history"
            >
              <View style={[
                styles.navIconContainerLarge,
                { backgroundColor: isDark ? colors.surfaceAlt : '#FFE4D7', borderColor: isDark ? colors.border : '#FFC8B0' },
                showHistorySidebar && { backgroundColor: colors.accent, borderColor: colors.accent }
              ]}>
                <Ionicons
                  name="mail-outline"
                  size={30}
                  color={showHistorySidebar ? colors.accentContrast : colors.accent}
                />
                {emailCount > 0 && (
                  <View style={[styles.countBadgeLarge, { backgroundColor: colors.accent, borderColor: colors.surface }] }>
                    <Text style={[styles.countBadgeTextLarge, { color: colors.accentContrast }]}>{emailCount}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.navLabelLarge, { fontSize: scaled(14), color: showHistorySidebar ? colors.accent : colors.textSecondary }]}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.simpleNavButton}
              onPress={() => { console.log('⚙️ Settings button pressed'); setShowSettings(true); }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              <View style={[
                styles.navIconContainerLarge,
                { backgroundColor: isDark ? colors.surfaceAlt : '#FFE4D7', borderColor: isDark ? colors.border : '#FFC8B0' },
                showSettings && { backgroundColor: colors.accent, borderColor: colors.accent }
              ]}>
                <Ionicons
                  name="settings-outline"
                  size={30}
                  color={showSettings ? colors.accentContrast : colors.accent}
                />
              </View>
              <Text style={[styles.navLabelLarge, { fontSize: scaled(14), color: showSettings ? colors.accent : colors.textSecondary }]}>Settings</Text>
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
    width: 220,
    height: 65,
    alignSelf: 'center',
  },
  logoWrapper: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    // Background removed per request; wrapper kept for spacing consistency
    backgroundColor: 'transparent',
  },
  // Removed dark-mode size/padding differences; unified sizing
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
    paddingHorizontal: 40,
    // Reserve space so large recorder doesn't look low due to bottom nav overlay
    paddingBottom: 120,
    // Slight top padding to visually balance status bubble offset
    paddingTop: 10,
  },
  
  // Category Sections
  categorySection: {
    // Reduced to tighten vertical density
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
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
    // Reduced vertical padding for denser list
    paddingVertical: 8,
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
    marginBottom: 2,
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
    // Slightly tighter line height to conserve space while staying readable
    lineHeight: 16,
  },
  
  
  // Bottom Navigation Container
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
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
    zIndex: 20,
  },
  // Simplified variant when checklist hidden (no recorder in bar)
  bottomNavContainerSimple: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  simpleButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 24,
  },
  simpleNavButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  navSide: { width: 90, alignItems: 'center', justifyContent: 'center' },
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
    position: 'relative',
  },
  navIconContainerLarge: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: '#FFE4D7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFC8B0',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  countBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  countBadgeLarge: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countBadgeTextLarge: {
    fontSize: 11,
    fontWeight: '800',
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
  navLabelLarge: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  navLabelActive: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  recorderWrapper: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

});