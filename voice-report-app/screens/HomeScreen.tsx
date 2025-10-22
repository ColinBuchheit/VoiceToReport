// voice-report-app/screens/HomeScreen.tsx - COMPLETE VERSION WITH ALL FIXES
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, Alert, Image, ScrollView, TouchableOpacity, Platform, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Animated, useWindowDimensions } from 'react-native';
import { useFontScale } from '../context/FontScaleContext';
import { Ionicons } from '@expo/vector-icons';
// Optional blur support (no-op if expo-blur isn't installed)
let RNBlurView: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RNBlurView = require('expo-blur').BlurView;
} catch (e) {
  RNBlurView = null;
}
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import Recorder from '../components/Recorder';
import EmailHistorySidebar from '../components/EmailHistorySidebar';
import { transcribeAudio } from '../services/api';
import { useSummary } from '../context/SummaryContext';
import SettingsModal from '../components/SettingsModal'; // explicit import; TS should resolve .tsx
import audioLockService from '../services/audioLockService';
import emailHistoryService, { EmailHistoryItem } from '../services/emailHistoryService';
import { useTheme } from '../context/ThemeContext';
import Checklist from '../components/Checklist';
import DraftSaveButton from '../components/DraftSaveButton';
import { useChecklist } from '../context/ChecklistContext';
import { criteriaCategories } from '../components/checklistData';
import { useTranscription } from '../context/TranscriptionContext';
import { useSettings } from '../context/SettingsContext';
import draftService, { DraftItem } from '../services/draftService';
import { useReportSession } from '../context/ReportSessionContext';
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
  showChecklist: boolean;
  shouldReset: boolean;
  showManualInput: boolean;
} = {
  showChecklist: true,
  shouldReset: false, // Flag to trigger complete reset
  showManualInput: false,
};

function HomeScreenInner({ navigation }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const [isProcessing, setIsProcessing] = useState(false);
  // Initialize from persisted state
  const [showChecklist, setShowChecklist] = useState(persistedState.showChecklist);
  const [showManualInput, setShowManualInput] = useState(persistedState.showManualInput);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [emailCount, setEmailCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false); // Settings modal visibility
  const { checkedItems, toggleItem, reset, setAll } = useChecklist();
  const { transcription, setTranscription } = useTranscription();
  const { setSummary, clearSummary } = useSummary();
  const { currentDraftId, setCurrentDraftId, justExitedDraft, setJustExitedDraft } = useReportSession();
  const draftId = currentDraftId; // derive for local convenience
  const [continueDraft, setContinueDraft] = useState<DraftItem | null>(null);
  const [showContinueBanner, setShowContinueBanner] = useState(false);
  const { showReportProgressBar, showBottomBarBackground } = useSettings();
  const manualInputRef = useRef<TextInput | null>(null);
  // Hold-to-clear state for manual input
  const [isHoldingClear, setIsHoldingClear] = useState(false);
  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdTimeout = useRef<NodeJS.Timeout | null>(null);
  const HOLD_DURATION = 2000;
  
  // Shared recording state - always reset to clean state
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Timer management
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Function to completely reset all state
  const resetAllState = () => {
    // Do NOT reset checklist here; only Exit Draft should clear it
    setShowChecklist(true);
    setShowManualInput(false);
    
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
    persistedState.showChecklist = true;
    persistedState.shouldReset = false;
    // (Removed) manual job detail persistence
  };

  // Save state to persistence when values change
  useEffect(() => {
    // checklist state is global via context; no local persistence needed here
  }, [checkedItems]);

  useEffect(() => {
    if (!persistedState.shouldReset) {
      persistedState.showChecklist = showChecklist;
    }
  }, [showChecklist]);

  useEffect(() => {
    if (!persistedState.shouldReset) {
      persistedState.showManualInput = showManualInput;
    }
  }, [showManualInput]);

  // (Removed) manual job details persistence effect

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
        // Capture the current recording to avoid stale closures and dependency reruns
        const currentRecording = recording;

        // Queue cleanup as a microtask so it runs after the screen fully blurs
        Promise.resolve().then(async () => {
          try {
            if (currentRecording) {
              await currentRecording.stopAndUnloadAsync();
            }
          } catch (e) {
            console.warn('Failed to stop recording on blur:', e);
          }

          // Reset state synchronously
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

          // Ensure any held audio lock is released when leaving the screen
          try {
            await audioLockService.forceRelease();
          } catch {}
        });
      };
    }, [])
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

  // On app/home focus, surface a prompt to resume the most recent draft if it's recent
  useEffect(() => {
    (async () => {
      try {
        if (justExitedDraft) {
          // Suppress resume banner immediately after exiting a draft
          setContinueDraft(null);
          setShowContinueBanner(false);
          setJustExitedDraft(false);
          return;
        }
        const latest = await draftService.getLatestDraft();
        if (!latest) {
          setContinueDraft(null);
          setShowContinueBanner(false);
          return;
        }
        // Consider drafts updated within the last 48 hours as "recent"
        const ageMs = Date.now() - new Date(latest.timestamp).getTime();
        const THRESHOLD = 48 * 60 * 60 * 1000;
        if (ageMs <= THRESHOLD) {
          setContinueDraft(latest);
          setShowContinueBanner(true);
        } else {
          setContinueDraft(null);
          setShowContinueBanner(false);
        }
      } catch (e) {
        setContinueDraft(null);
        setShowContinueBanner(false);
      }
    })();
  }, [navigation]);

  // If we just exited a draft, ensure Home resets all state on focus
  useFocusEffect(
    React.useCallback(() => {
      if (justExitedDraft) {
        resetAllState();
        setJustExitedDraft(false);
      }
      return () => {};
    }, [justExitedDraft])
  );

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

  const totalItems = criteriaCategories.reduce((sum, cat) => sum + cat.items.length, 0);
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const requiredItems = criteriaCategories.flatMap(cat => cat.items.filter(item => item.required));
  const checkedRequiredCount = requiredItems.filter(item => checkedItems[item.id]).length;
  const progressPercent = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  const handleRecordingComplete = async (audioUri: string) => {
    try {
      setIsProcessing(true);
      const result = await transcribeAudio(audioUri);
      // Append new transcription to existing text
      const combined = (transcription && transcription.trim().length > 0)
        ? `${transcription.trim()}\n${(result.transcription || '').trim()}`
        : (result.transcription || '');
      setTranscription(combined);
      
      // Set flag to reset state when returning from the workflow
      persistedState.shouldReset = true;
      
      navigation.navigate('Transcript', {
        transcription: combined,
        audioUri,
        ...(draftId ? { draftId } : {}),
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

  // Helper to compare checklists
  const equalChecklist = (a?: Record<string, boolean>, b?: Record<string, boolean>) => {
    const ak = Object.keys(a || {});
    const bk = Object.keys(b || {});
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!!(a as any)[k] !== !!(b as any)[k]) return false;
    }
    return true;
  };
  // Track whether there are unsaved changes on Home to enable/disable Save
  const [isDirty, setIsDirty] = useState(false);
  const [saveSignal, setSaveSignal] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const text = (transcription || '').trim();
        let dirty = false;
        if (!draftId) {
          dirty = text.length > 0 || Object.values(checkedItems || {}).some(Boolean);
        } else {
          const saved = await draftService.getDraftById(draftId);
          if (!saved) {
            dirty = text.length > 0 || Object.values(checkedItems || {}).some(Boolean);
          } else {
            const sameText = (saved.transcription || '').trim() === text;
            const sameChecklist = equalChecklist(saved.checklist, checkedItems);
            dirty = !(sameText && sameChecklist);
          }
        }
        if (!cancelled) setIsDirty(dirty);
      } catch {
        if (!cancelled) setIsDirty(true);
      }
    })();
    return () => { cancelled = true; };
  }, [draftId, transcription, checkedItems, saveSignal]);

  const handleEmailSelect = (email: EmailHistoryItem) => {
    console.log('📧 Selected email transcription length:', email.transcription?.length || 0);
    console.log('📧 Transcription preview:', email.transcription ? email.transcription.slice(0, 100) : 'EMPTY');
    const draftId = (email as any)?._draftId as string | undefined;
    const isDraft = (email as any)?._isDraft === true;
    const lastSavedRoute = (email as any)?._lastSavedRoute as ('Home'|'Transcript'|'Summary'|undefined);
    const checklistFromDraft = (email as any)?.checklist as Record<string, boolean> | undefined;
    // Seed summary context so forward/back preserves it
    try { if (email.summary) setSummary(email.summary, email.transcription || ''); } catch {}
    if (isDraft && lastSavedRoute) {
      if (lastSavedRoute === 'Transcript') {
        if (checklistFromDraft) setAll(checklistFromDraft);
        if (draftId) setCurrentDraftId(draftId);
        navigation.navigate('Transcript', { transcription: email.transcription || '', ...(draftId ? { draftId } : {}) });
      } else if (lastSavedRoute === 'Home') {
        // Stay on Home; optionally populate transcription
        try { setTranscription(email.transcription || ''); } catch {}
        if (draftId) setCurrentDraftId(draftId);
        if (checklistFromDraft) setAll(checklistFromDraft);
      } else {
        if (checklistFromDraft) setAll(checklistFromDraft);
        navigation.navigate('Summary', {
          transcription: email.transcription || '',
          summary: email.summary,
          ...(draftId ? { draftId } : {}),
        });
      }
    } else {
      navigation.navigate('Summary', {
        transcription: email.transcription || '',
        summary: email.summary,
        ...(draftId ? { draftId } : {}),
      });
    }
    // Close sidebar after initiating navigation so Summary shows without being covered
    setShowHistorySidebar(false);
  };

  const handleResumeDraft = (d: DraftItem) => {
    const route = d.lastSavedRoute || 'Summary';
    if (route === 'Transcript') {
      if (d.checklist) setAll(d.checklist);
        setCurrentDraftId(d.id);
        navigation.navigate('Transcript', { transcription: d.transcription || '', draftId: d.id });
    } else if (route === 'Home') {
      try { setTranscription(d.transcription || ''); } catch {}
        setCurrentDraftId(d.id);
      if (d.checklist) setAll(d.checklist);
      // remain on Home
    } else {
      try { if (d.summary) setSummary(d.summary, d.transcription || ''); } catch {}
      if (d.checklist) setAll(d.checklist);
      navigation.navigate('Summary', {
        transcription: d.transcription || '',
        summary: d.summary as any,
        draftId: d.id,
      });
    }
    setShowContinueBanner(false);
  };

  // checklist toggling handled via context

  const insets = useSafeAreaInsets();
  const { scaled } = useFontScale();
  const { colors, isDark } = useTheme();
  // Space to ensure last checklist items (e.g., Photos) are not hidden behind bottom nav
  const bottomNavOverlaySpace = 160 + (Platform.OS === 'ios' ? insets.bottom : 0);

  // SettingsModal extracted to separate component to prevent remounts on each render (which caused flicker during recording updates)

  // Add forward button in header to proceed to Transcript without losing input
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            navigation.navigate('Transcript', { transcription: transcription || '', ...(draftId ? { draftId } : {}) });
          }}
          accessibilityRole="button"
          accessibilityLabel="Next"
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.accent} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, transcription, colors.accent, draftId]);

  return (
  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: colors.background }]}> 
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 8) }}>    
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

      {/* Progress Summary (show only when checklist is hidden to avoid duplicates) */}
      {showReportProgressBar && !showChecklist && (
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
      )}

      {/* Content Area */}
      <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>

        <View style={[styles.contentHeader, { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }]}>
          <TouchableOpacity 
            style={[styles.toggleButton, { backgroundColor: isDark ? colors.surfaceAlt : '#F3F4F6' }]}
            onPress={() => setShowChecklist(!showChecklist)}
          >
            <Text style={[styles.toggleText, { fontSize: scaled(14), color: colors.textPrimary }]}>
              {showChecklist ? 'Hide Checklist' : 'Show Checklist'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, { backgroundColor: isDark ? colors.surfaceAlt : '#F3F4F6' }]}
            onPress={() => {
              const next = !showManualInput;
              setShowManualInput(next);
              if (!next) {
                manualInputRef.current?.blur();
                Keyboard.dismiss();
              }
            }}
          >
            <Text style={[styles.toggleText, { fontSize: scaled(14), color: colors.textPrimary }]}>
              {showManualInput ? 'Hide Text Entry' : 'Show Text Entry'}
            </Text>
          </TouchableOpacity>
          {/* Compact Save Draft button for quick transcription saves */}
          <DraftSaveButton
            compact
            data={{} as any}
            draftId={draftId}
            transcription={transcription}
            checklist={checkedItems}
            onSaved={(id) => { setCurrentDraftId(id); setSaveSignal(x => x + 1); }}
            style={{ marginLeft: 4 }}
            disabled={!isDirty}
            currentRoute="Home"
          />
        </View>

        {/* Continue recent draft banner */}
        {(!draftId && showContinueBanner && continueDraft) && (
          <View style={[styles.continueBanner, { backgroundColor: colors.surfaceAlt, borderColor: colors.accent }]}> 
            <View style={styles.continueBannerTextWrap}>
              <Text style={[styles.continueBannerTitle, { color: colors.textPrimary }]}>Resume your recent draft?</Text>
              <Text style={[styles.continueBannerSubtitle, { color: colors.textSecondary }]}>
                We'll take you back to {continueDraft.lastSavedRoute === 'Transcript' ? 'Transcription' : (continueDraft.lastSavedRoute === 'Home' ? 'Home' : 'Summary')} for WO {continueDraft.workOrder || 'N/A'} at {continueDraft.location || 'Unknown'}
              </Text>
            </View>
            <View style={styles.continueBannerActions}>
              <TouchableOpacity onPress={() => setShowContinueBanner(false)} style={[styles.continueBannerButton, { borderColor: colors.border }]}>
                <Text style={[styles.continueBannerButtonText, { color: colors.textSecondary }]}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleResumeDraft(continueDraft)} style={[styles.continueBannerButtonPrimary, { backgroundColor: colors.accent }]}>
                <Text style={[styles.continueBannerButtonPrimaryText, { color: colors.accentContrast }]}>Resume</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {/* Editing Draft banner on Home when in an active draft */}
        {!!draftId && (
          <View style={[styles.draftBanner, { borderColor: colors.accent, backgroundColor: colors.surface }]}> 
            <Text style={[styles.draftBannerText, { color: colors.textPrimary }]}>Editing Draft</Text>
            <TouchableOpacity
              onPress={async () => {
                // If there are unsaved changes on Home (transcription/checklist), offer to save
                const maybeDraftId = draftId;
                const text = (transcription || '').trim();
                let hasUnsaved = false;
                try {
                  if (maybeDraftId) {
                    const saved = await draftService.getDraftById(maybeDraftId);
                    if (saved) {
                      const savedText = (saved.transcription || '').trim();
                      const equalChecklist = (a?: Record<string, boolean>, b?: Record<string, boolean>) => {
                        const ak = Object.keys(a || {});
                        const bk = Object.keys(b || {});
                        if (ak.length !== bk.length) return false;
                        for (const k of ak) { if (!!(a as any)[k] !== !!(b as any)[k]) return false; }
                        return true;
                      };
                      hasUnsaved = savedText !== text || !equalChecklist(saved.checklist, checkedItems);
                    } else {
                      hasUnsaved = text.length > 0 || Object.values(checkedItems || {}).some(Boolean);
                    }
                  } else {
                    hasUnsaved = text.length > 0 || Object.values(checkedItems || {}).some(Boolean);
                  }
                } catch { hasUnsaved = true; }

                const exitNow = () => {
                  setCurrentDraftId(undefined);
                  setJustExitedDraft(true);
                  setShowContinueBanner(false);
                  try { setTranscription(''); } catch {}
                  try { clearSummary(); } catch {}
                  try { reset(); } catch {}
                  resetAllState();
                };

                if (hasUnsaved) {
                  Alert.alert(
                    'Unsaved changes',
                    'Do you want to save your changes before exiting?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Discard', style: 'destructive', onPress: () => exitNow() },
                      { text: 'Save', onPress: async () => {
                          try {
                            await draftService.addDraft({
                              id: maybeDraftId,
                              transcription: text,
                              summary: {} as any,
                              lastSavedRoute: 'Home',
                              checklist: checkedItems,
                            });
                          } catch {}
                          exitNow();
                        }
                      },
                    ]
                  );
                } else {
                  exitNow();
                }
              }}
              style={[styles.draftExitBtn, { borderColor: colors.accent }]}
            >
              <Text style={[styles.draftExitBtnText, { color: colors.accent }]}>Exit Draft</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Manual transcription input (collapsible compact when checklist is visible) */}
        {showManualInput && showChecklist && (
          <View style={[styles.manualInputCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}> 
            <Text style={[styles.manualInputLabel, { color: colors.textPrimary }]}>Enter Transcription</Text>
            <TextInput
              ref={manualInputRef}
              style={[
                styles.manualTextInput,
                { color: colors.textPrimary, maxHeight: Math.max(140, Math.min(260, windowHeight * 0.35)) }
              ]}
              value={transcription}
              onChangeText={setTranscription}
              placeholder="Type or paste your transcription here..."
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
              scrollEnabled
              returnKeyType={Platform.OS === 'ios' ? 'default' : 'done'}
              blurOnSubmit={false}
            />
            <View style={[styles.manualActionsRow, { gap: 8 }]}>
              <TouchableOpacity
                style={[styles.useTextButton, { backgroundColor: colors.accent }]}
                onPress={() => {
                  if (!transcription || transcription.trim().length === 0) return;
                  // include draftId if continuing an existing draft
                  navigation.navigate('Transcript', { transcription: transcription.trim(), ...(draftId ? { draftId } : {}) });
                }}
                disabled={!transcription || transcription.trim().length === 0}
              >
                <Text style={[styles.useTextButtonText, { color: colors.accentContrast }]}>Continue with Text</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.clearButton, { backgroundColor: colors.accent }]}
                onPressIn={() => {
                  setIsHoldingClear(true);
                  Animated.timing(holdProgress, { toValue: 1, duration: HOLD_DURATION, useNativeDriver: false }).start();
                  holdTimeout.current = setTimeout(() => {
                    setTranscription('');
                    setIsHoldingClear(false);
                    holdProgress.setValue(0);
                  }, HOLD_DURATION);
                }}
                onPressOut={() => {
                  if (holdTimeout.current) {
                    clearTimeout(holdTimeout.current);
                    holdTimeout.current = null;
                  }
                  setIsHoldingClear(false);
                  Animated.timing(holdProgress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
                }}
                activeOpacity={0.8}
              >
                <View style={styles.progressBarBackground}>
                  <Animated.View
                    style={[styles.progressBar, { width: holdProgress.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] }) }]}
                  />
                </View>
                <Text style={[styles.useTextButtonText, { color: colors.accentContrast }]}>{isHoldingClear ? 'Hold to Clear...' : 'Clear'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showChecklist ? (
          <Checklist contentPaddingBottom={bottomNavOverlaySpace} />
        ) : (
          showManualInput ? (
            /* Expanded Manual Text Entry taking main area */
            <View style={styles.centeredManualView}>
              <View style={[styles.manualInputCardLarge, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}> 
                <Text style={[styles.manualInputLabel, { color: colors.textPrimary }]}>Enter Transcription</Text>
                <TextInput
                  ref={manualInputRef}
                  style={[
                    styles.manualTextInputLarge,
                    { color: colors.textPrimary, maxHeight: Math.max(220, Math.min(480, windowHeight * 0.55)) }
                  ]}
                  value={transcription}
                  onChangeText={setTranscription}
                  placeholder="Type or paste your transcription here..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  textAlignVertical="top"
                  scrollEnabled
                  returnKeyType={Platform.OS === 'ios' ? 'default' : 'done'}
                  blurOnSubmit={false}
                />
                <View style={[styles.manualActionsRow, { gap: 8 }]}>
                  <TouchableOpacity
                    style={[styles.useTextButton, { backgroundColor: colors.accent }]}
                    onPress={() => {
                      if (!transcription || transcription.trim().length === 0) return;
                      navigation.navigate('Transcript', { transcription: transcription.trim(), ...(draftId ? { draftId } : {}) });
                    }}
                    disabled={!transcription || transcription.trim().length === 0}
                  >
                    <Text style={[styles.useTextButtonText, { color: colors.accentContrast }]}>Continue with Text</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.clearButton, { backgroundColor: colors.accent }]}
                    onPressIn={() => {
                      setIsHoldingClear(true);
                      Animated.timing(holdProgress, { toValue: 1, duration: HOLD_DURATION, useNativeDriver: false }).start();
                      holdTimeout.current = setTimeout(() => {
                        setTranscription('');
                        setIsHoldingClear(false);
                        holdProgress.setValue(0);
                      }, HOLD_DURATION);
                    }}
                    onPressOut={() => {
                      if (holdTimeout.current) {
                        clearTimeout(holdTimeout.current);
                        holdTimeout.current = null;
                      }
                      setIsHoldingClear(false);
                      Animated.timing(holdProgress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.progressBarBackground}>
                      <Animated.View
                        style={[styles.progressBar, { width: holdProgress.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] }) }]}
                      />
                    </View>
                    <Text style={[styles.useTextButtonText, { color: colors.accentContrast }]}>{isHoldingClear ? 'Hold to Clear...' : 'Clear'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
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
          )
        )}
      </View>

      {/* Bottom Navigation: variant changes depending on checklist visibility */}
      {showChecklist ? (
        <View style={[
          styles.bottomNavContainer,
          showBottomBarBackground && {
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 10,
          }
        ]}>
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
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                {RNBlurView && (
                  <RNBlurView
                    intensity={28}
                    tint={isDark ? 'dark' : 'light'}
                    style={styles.navBlurCircleSmall}
                  />
                )}
                <View style={[
                  styles.navIconContainer,
                  isDark && styles.navIconContainerHaloDark,
                  {
                    backgroundColor: showHistorySidebar ? colors.accent : '#000000',
                    borderColor: showHistorySidebar ? '#000000' : colors.accent,
                    borderWidth: 4,
                  },
                ]}>
                <Ionicons
                  name="mail-outline"
                  size={24}
                  color={showHistorySidebar ? '#000000' : colors.accentContrast}
                />
                {emailCount > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: colors.accent, borderColor: colors.surface }] }>
                    <Text style={[styles.countBadgeText, { color: colors.accentContrast }]}>{emailCount}</Text>
                  </View>
                )}
                </View>
              </View>
              <Text style={[
                styles.navLabel,
                {
                  fontSize: scaled(12),
                  color: isDark ? colors.accent : (showHistorySidebar ? colors.accent : colors.textSecondary),
                },
              ]}>History</Text>
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
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                {RNBlurView && (
                  <RNBlurView
                    intensity={28}
                    tint={isDark ? 'dark' : 'light'}
                    style={styles.navBlurCircleSmall}
                  />
                )}
                <View style={[
                  styles.navIconContainer,
                  isDark && styles.navIconContainerHaloDark,
                  {
                    backgroundColor: showSettings ? colors.accent : '#000000',
                    borderColor: showSettings ? '#000000' : colors.accent,
                    borderWidth: 4,
                  },
                ]}>
                <Ionicons
                  name="settings-outline"
                  size={24}
                  color={showSettings ? '#000000' : colors.accentContrast}
                />
                </View>
              </View>
              <Text style={[
                styles.navLabel,
                {
                  fontSize: scaled(12),
                  color: isDark ? colors.accent : (showSettings ? colors.accent : colors.textSecondary),
                },
              ]}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[
          styles.bottomNavContainer,
          styles.bottomNavContainerSimple,
          showBottomBarBackground && {
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 10,
          }
        ]}>
          <View style={styles.simpleButtonsRow}>
            <TouchableOpacity
              style={styles.simpleNavButton}
              onPress={() => setShowHistorySidebar(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open email history"
            >
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                {RNBlurView && (
                  <RNBlurView
                    intensity={30}
                    tint={isDark ? 'dark' : 'light'}
                    style={styles.navBlurCircle}
                  />
                )}
                <View style={[
                  styles.navIconContainerLarge,
                  isDark && styles.navIconContainerLargeHaloDark,
                  {
                    backgroundColor: showHistorySidebar ? colors.accent : '#000000',
                    borderColor: showHistorySidebar ? '#000000' : colors.accent,
                    borderWidth: 4,
                  },
                ]}>
                <Ionicons
                  name="mail-outline"
                  size={30}
                  color={showHistorySidebar ? '#000000' : colors.accentContrast}
                />
                {emailCount > 0 && (
                  <View style={[styles.countBadgeLarge, { backgroundColor: colors.accent, borderColor: colors.surface }] }>
                    <Text style={[styles.countBadgeTextLarge, { color: colors.accentContrast }]}>{emailCount}</Text>
                  </View>
                )}
                </View>
              </View>
              <Text style={[
                styles.navLabelLarge,
                { fontSize: scaled(14), color: isDark ? colors.accent : (showHistorySidebar ? colors.accent : colors.textSecondary) }
              ]}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.simpleNavButton}
              onPress={() => { console.log('⚙️ Settings button pressed'); setShowSettings(true); }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                {RNBlurView && (
                  <RNBlurView
                    intensity={30}
                    tint={isDark ? 'dark' : 'light'}
                    style={styles.navBlurCircle}
                  />
                )}
                <View style={[
                  styles.navIconContainerLarge,
                  isDark && styles.navIconContainerLargeHaloDark,
                  {
                    backgroundColor: showSettings ? colors.accent : '#000000',
                    borderColor: showSettings ? '#000000' : colors.accent,
                    borderWidth: 4,
                  },
                ]}>
                <Ionicons
                  name="settings-outline"
                  size={30}
                  color={showSettings ? '#000000' : colors.accentContrast}
                />
                </View>
              </View>
              <Text style={[
                styles.navLabelLarge,
                { fontSize: scaled(14), color: isDark ? colors.accent : (showSettings ? colors.accent : colors.textSecondary) }
              ]}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Email History Sidebar */}
      <EmailHistorySidebar
        visible={showHistorySidebar}
        onClose={() => setShowHistorySidebar(false)}
        onEmailSelect={handleEmailSelect}
        currentDraftId={draftId}
      />

      {/* Settings Modal */}
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
    </View>
    </TouchableWithoutFeedback>
  </KeyboardAvoidingView>
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
  manualInputCard: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    padding: 14,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  manualInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  manualTextInput: {
    minHeight: 120, // ~5 rows
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  manualActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  clearButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    position: 'relative',
    overflow: 'hidden',
  },
  progressBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
  },
  centeredManualView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 120,
    paddingTop: 10,
  },
  manualInputCardLarge: {
    width: '100%',
    maxWidth: 900,
    padding: 14,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  manualTextInputLarge: {
    minHeight: 300,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  useTextButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  useTextButtonText: {
    fontSize: 14,
    fontWeight: '700',
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
  // (Removed) Job Details styles
  
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
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
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
    borderRadius: 26,
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
  navIconContainerHaloDark: {
    shadowColor: '#FF6B35',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
    elevation: 8,
  },
  navIconContainerLarge: {
    width: 70,
    height: 70,
    borderRadius: 35,
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
  navIconContainerLargeHaloDark: {
    shadowColor: '#FF6B35',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    elevation: 10,
  },
  // Blur overlays behind nav buttons (if expo-blur present)
  navBlurCircleSmall: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    top: -8,
    alignSelf: 'center',
    opacity: 0.9,
    overflow: 'hidden',
    pointerEvents: 'none' as any,
  },
  navBlurCircle: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    top: -11,
    alignSelf: 'center',
    opacity: 0.9,
    overflow: 'hidden',
    pointerEvents: 'none' as any,
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

  // Continue Draft Banner
  continueBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  continueBannerTextWrap: { flex: 1 },
  continueBannerTitle: { fontSize: 15, fontWeight: '700' },
  continueBannerSubtitle: { fontSize: 13 },
  continueBannerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  continueBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  continueBannerButtonText: { fontSize: 13, fontWeight: '600' },
  continueBannerButtonPrimary: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  continueBannerButtonPrimaryText: { fontSize: 13, fontWeight: '800' },

  // Editing Draft banner (mirrors Transcript/Summary)
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  draftBannerText: { fontWeight: '700' },
  draftExitBtn: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderRadius: 8 },
  draftExitBtnText: { fontWeight: '700' },

});