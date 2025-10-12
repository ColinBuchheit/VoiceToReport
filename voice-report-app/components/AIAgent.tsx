import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { AIAgentService } from '../services/aiAgentService';
import { runAIAgentMicDiagnostic, showMicDiagnostic } from '../services/aiAgentDiagnostics';
import audioLockService from '../services/audioLockService';
import { 
  AIAgentProps, 
  AIAgentState, 
  VoiceCommandResponse 
} from '../types/aiAgent';
import { useFontScale } from '../context/FontScaleContext';

// Company Colors
const COLORS = {
  BLACK: '#000000',
  ORANGE: '#FF6B35',
  WHITE: '#FFFFFF',
  GRAY: '#333333',
};

// Animated Dots Component for processing state
const AnimatedDots = ({ color = COLORS.WHITE }) => {
  const { fontScale } = useFontScale();
  const dot1Anim = useRef(new Animated.Value(0.3)).current;
  const dot2Anim = useRef(new Animated.Value(0.3)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animateDots = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot1Anim, { toValue: 1, duration: 266, useNativeDriver: true }),
          Animated.timing(dot2Anim, { toValue: 1, duration: 266, useNativeDriver: true }),
          Animated.timing(dot3Anim, { toValue: 1, duration: 266, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(dot1Anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
            Animated.timing(dot2Anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
            Animated.timing(dot3Anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          ]),
          Animated.delay(200),
        ])
      ).start();
    };

    animateDots();
    return () => {
      dot1Anim.stopAnimation();
      dot2Anim.stopAnimation();
      dot3Anim.stopAnimation();
    };
  }, []);

  const size = Math.max(3, Math.round(4 * fontScale));
  const dotStyle = (anim: Animated.Value) => ({
    width: size,
    height: size,
    borderRadius: Math.round(size / 2),
    backgroundColor: color,
    opacity: anim,
    transform: [{ scale: anim }],
  });

  return (
    <View style={styles.dotLoader}>
      <Animated.View style={dotStyle(dot1Anim)} />
      <Animated.View style={dotStyle(dot2Anim)} />
      <Animated.View style={dotStyle(dot3Anim)} />
    </View>
  );
};

export default function AIAgent({
  screenContext,
  onFieldUpdate,
  onModeToggle,
  onNavigate,
  onAction,
  position = 'bottom-right',
  disabled = false,
  customStyle,
}: AIAgentProps) {
  const { fontScale } = useFontScale();

  // State Management
  const [agentState, setAgentState] = useState<AIAgentState>({
    isListening: false,
    isProcessing: false,
    isPlayingResponse: false,
  });
  // Refs to avoid stale closures and manage timers
  const agentStateRef = useRef(agentState);
  useEffect(() => { agentStateRef.current = agentState; }, [agentState]);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoStopSessionRef = useRef<number | null>(null);

  // Local recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  // Service and Animation Refs
  const aiService = AIAgentService.getInstance();
  // Abort controller for cancelling in-flight processing (transcription/summarization/voice-command)
  const processingController = useRef<AbortController | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const buttonSize = customStyle?.size || Math.round(80 * fontScale);
  const buttonColor = customStyle?.buttonColor;

  // Stop all animations utility
  const stopAllAnimations = () => {
    scaleAnim.stopAnimation();
    glowAnim.stopAnimation();
    scaleAnim.setValue(1);
    glowAnim.setValue(0);
  };

  // Cleanup on unmount - cancel any in-flight processing and cleanup audio
  useEffect(() => {
    return () => {
      // Synchronous cleanup for abort controller
      if (processingController.current) {
        try {
          processingController.current.abort();
        } catch {}
        processingController.current = null;
      }

      // Async cleanup for audio: queue as a microtask after unmount to avoid Android mic race
      Promise.resolve().then(async () => {
        try {
          if (recording) {
            await recording.stopAndUnloadAsync();
            setRecording(null);
          }
          await aiService.cleanup();
        } catch (error) {
          console.warn('AIAgent cleanup error:', error);
        }
      });
    };
  }, []);

  // Start animations for listening state
  const startListeningAnimations = () => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Start listening to voice input
  const startListening = async () => {
    try {
      console.log('🎤 AI Agent starting to listen...');
      setAgentState({ isListening: true, isProcessing: false, isPlayingResponse: false });
      startListeningAnimations();

      // Check permissions early; in some release builds Android denies without a prompt
      const perm = await Audio.getPermissionsAsync();
      console.log('🔐 Permission status:', perm.status);
      if (perm.status !== 'granted') {
        const req = await Audio.requestPermissionsAsync();
        if (req.status !== 'granted') {
          throw new Error('Microphone permission is required. Please enable it in Settings.');
        }
      }

      // Acquire audio lock
      const lockAcquired = await audioLockService.acquireLock('ai-agent');
      if (!lockAcquired) {
        console.warn('Microphone Busy: Another recording is in progress.');
        return;
      }

      // Preflight: ensure no lingering recording and set audio mode for recording
      try {
        if (recording) {
          await recording.stopAndUnloadAsync();
          setRecording(null);
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.warn('Audio preflight for startListening failed (non-fatal):', e);
      }

      // Recording options tuned for Android speech capture
      const outputFormat = (Audio as any).RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4 ?? 2;
      const audioEncoder = (Audio as any).RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC ?? 3;
      const audioSource = (Audio as any).RECORDING_OPTION_ANDROID_AUDIO_SOURCE_VOICE_RECOGNITION
        ?? (Audio as any).RECORDING_OPTION_ANDROID_AUDIO_SOURCE_MIC
        ?? 6;
      const ANDROID_RECORDING_OPTIONS: Audio.RecordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat,
          audioEncoder,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          audioSource,
        },
        ios: Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
        web: Audio.RecordingOptionsPresets.HIGH_QUALITY.web,
        isMeteringEnabled: false,
      } as Audio.RecordingOptions;

      const options = Platform.OS === 'android' ? ANDROID_RECORDING_OPTIONS : Audio.RecordingOptionsPresets.HIGH_QUALITY;

      const { recording: newRecording } = await Audio.Recording.createAsync(options);
      setRecording(newRecording);

      // Ensure recording is actually started
      try {
        const st = await newRecording.getStatusAsync();
        if (!st.isRecording && st.canRecord) {
          await newRecording.startAsync();
        }
      } catch {}

  console.log('✅ Recording started successfully. Speak now! Tap again to stop.');

      // Auto-stop after 30 seconds (guarded against stale closures)
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      const sessionId = Date.now();
      autoStopSessionRef.current = sessionId;
      autoStopTimerRef.current = setTimeout(() => {
        if (autoStopSessionRef.current === sessionId && agentStateRef.current.isListening) {
          stopListening();
        }
      }, 30000);

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      setAgentState({ isListening: false, isProcessing: false, isPlayingResponse: false });
      stopAllAnimations();
      await audioLockService.releaseLock('ai-agent');
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      console.warn('Recording Error:', errorMessage);
    }
  };

  // Stop listening and process voice input
  const stopListening = async () => {
    try {
      console.log('⏹️ Stopping: Processing audio...');
      console.log('⏹️ Stopping recording...');
      stopAllAnimations();
      setAgentState({ isListening: false, isProcessing: true, isPlayingResponse: false });

      // Clear any pending auto-stop timer for this session
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      autoStopSessionRef.current = null;

      // Stop recording and get URI
      let audioUri: string | null = null;
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
          audioUri = recording.getURI();
          setRecording(null);
          console.log('🎵 Audio URI:', audioUri);
        } catch (e) {
          console.error('❌ Failed to stop recording:', e);
          await audioLockService.releaseLock('ai-agent');
          setAgentState({ isListening: false, isProcessing: false, isPlayingResponse: false });
          return;
        }
      }

      // Release audio lock
      await audioLockService.releaseLock('ai-agent');

      // Better error handling - check if we actually got audio
      if (!audioUri) {
        console.warn('⚠️ No audio URI returned from recording');
        setAgentState({ isListening: false, isProcessing: false, isPlayingResponse: false });
        return; // Don't throw, just return early
      }

      console.log('📤 Sending voice command to backend...');
      // Cancel any previous processing
      if (processingController.current) {
        processingController.current.abort();
      }
      processingController.current = new AbortController();

      const response = await aiService.processVoiceCommand(
        audioUri,
        screenContext,
        processingController.current.signal
      );
  console.log('📥 Received response:', response);

      await executeCommand(response);
  console.log('✅ Complete: Command executed successfully');

      // Return to idle after successful processing
      setAgentState({ isListening: false, isProcessing: false, isPlayingResponse: false });

    } catch (error) {
      console.error('❌ Voice processing failed:', error);
      setAgentState({ isListening: false, isProcessing: false, isPlayingResponse: false });
      console.warn('Processing Error:', error instanceof Error ? error.message : 'Failed to process voice command');
    } finally {
      stopAllAnimations();
      // Defensive: ensure we always return to idle a tick later
      setTimeout(() => {
        setAgentState({ isListening: false, isProcessing: false, isPlayingResponse: false });
      }, 0);
    }
  };

  // Execute the voice command based on response
  const executeCommand = async (response: VoiceCommandResponse) => {
    try {
      console.log('🎯 Executing command:', response.action);

      // Normalize backend synonyms using a local mutable variable to avoid TS union issues
      let action: string = (response as any).action;
      if (action === 'field_update') {
        action = 'update_field';
        (response as any).action = action;
      }

      switch (action) {
        case 'update_field':
        case 'edit_field':
          if (response.target && onFieldUpdate) {
            // Handle text replacement vs full field update
            if (response.target === 'transcription' && response.value) {
              // For text replacements, the backend should send the complete modified text
              await onFieldUpdate(response.target, response.value);
            } else {
              // For other fields, just update with the new value
              await onFieldUpdate(response.target, response.value || '');
            }
            console.log(`✏️ Field updated: ${response.target}`);
          }
          break;

        case 'update_fields':
          // Bulk field updates: response.fieldUpdates should be an object { fieldName: value }
          if (response.fieldUpdates && onFieldUpdate) {
            const updates = response.fieldUpdates as Record<string, any>;
            for (const [fieldName, val] of Object.entries(updates)) {
              try {
                await onFieldUpdate(fieldName, String(val ?? ''));
                console.log(`✏️ Field updated: ${fieldName}`);
              } catch (e) {
                console.error(`Failed to update field ${fieldName}:`, e);
              }
            }
          }
          break;

        case 'toggle_mode':
        case 'toggle_edit_mode':
          if (onModeToggle) {
            onModeToggle();
            console.log('🔄 Mode toggled');
          }
          break;

        case 'navigate':
          if (response.target && onNavigate) {
            onNavigate(response.target);
            console.log(`🧭 Navigating to: ${response.target}`);
          }
          break;

        case 'execute_action':
          console.log('🔍 DEBUG: execute_action case triggered');
          console.log('🔍 DEBUG: response.target =', response.target);
          console.log('🔍 DEBUG: response.value =', response.value);
          console.log('🔍 DEBUG: onAction exists?', !!onAction);
          console.log('🔍 DEBUG: onAction type:', typeof onAction);

          if (response.target && onAction) {
            console.log(`⚡ Executing action: ${response.target}`);

            try {
              console.log('🔍 DEBUG: About to call onAction...');
              await onAction(response.target, response.value);
              console.log('🔍 DEBUG: onAction call completed');
              console.log(`✅ Action '${response.target}' executed successfully`);
            } catch (error) {
              console.error(`❌ Action '${response.target}' failed:`, error);
              console.error('🔍 DEBUG: Error stack:', error instanceof Error ? error.stack : 'N/A');
            }
          } else {
            console.warn('⚠️ execute_action received but missing:', {
              hasTarget: !!response.target,
              target: response.target,
              hasOnAction: !!onAction,
              onActionType: typeof onAction
            });
          }
          break;
        case 'generate_summary':
          if (response.target && onAction) {
            console.log(`⚡ Executing action: ${response.target}`);
            try {
              await onAction(response.target, response.value);
            } catch (e) {
              console.warn('⚠️ generate_summary handler threw an error:', e);
            }
          } else {
            console.warn('⚠️ generate_summary received but no onAction handler or target');
          }
          break;

        case 'clear_field':
          if (response.target && onFieldUpdate) {
            await onFieldUpdate(response.target, '');
            console.log(`🗑️ Field cleared: ${response.target}`);
          }
          break;

        default:
          // Play TTS for acknowledgments/responses
          if (response.ttsText) {
            await aiService.playTTSResponse(response.ttsText);
          }
          console.log(`💬 Response: ${response.confirmation}`);
      }

    } catch (error) {
      console.error('❌ Command execution failed:', error);
      console.warn('Error: Failed to execute command');
    }
  };

  // Main button press handler
  const handlePress = async () => {
    console.log('🔘 AIAgent button pressed', {
      disabled,
      isListening: agentState.isListening,
      isProcessing: agentState.isProcessing,
      isPlayingResponse: agentState.isPlayingResponse
    });
    
    if (disabled) {
      console.warn('AI Agent button is currently disabled');
      return;
    }

    if (agentState.isListening) {
      console.log('⏹️ Stopping listening...');
      await stopListening();
    } else if (!agentState.isProcessing && !agentState.isPlayingResponse) {
      console.log('🎤 Starting listening...');
      await startListening();
    } else {
      console.warn(`Busy: Cannot start (processing=${agentState.isProcessing}, playing=${agentState.isPlayingResponse})`);
    }
  };

  // Long-press to run diagnostics when debug flag is set
  const handleLongPress = async () => {
    // Debug long-press disabled (no popups)
    console.log('Long press detected on AI Agent (debug disabled).');
  };

  // Get button style based on state
  const getButtonStyle = () => {
    const baseStyle = {
      width: buttonSize,
      height: buttonSize,
      borderRadius: buttonSize / 2,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      borderWidth: 4,
      ...Platform.select({
        ios: {
          shadowColor: COLORS.BLACK,
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
        },
        android: {
          elevation: 8,
        },
      }),
    };

    if (agentState.isListening) {
      return {
        ...baseStyle,
        backgroundColor: buttonColor || COLORS.ORANGE,
        borderColor: COLORS.BLACK,
      };
    } else if (agentState.isProcessing) {
      return {
        ...baseStyle,
        backgroundColor: COLORS.WHITE,
        borderColor: buttonColor || COLORS.ORANGE,
      };
    } else {
      return {
        ...baseStyle,
        backgroundColor: disabled ? COLORS.GRAY : (buttonColor || COLORS.BLACK),
        borderColor: COLORS.ORANGE,
        opacity: disabled ? 0.6 : 1,
      };
    }
  };

  // Get icon based on state
  const getIcon = () => {
    if (agentState.isProcessing) {
      return <AnimatedDots color={COLORS.ORANGE} />;
    }

    const iconProps = agentState.isListening
      ? { name: 'stop' as const, color: COLORS.BLACK }
      : { name: 'mic' as const, color: COLORS.WHITE };

    return <Ionicons name={iconProps.name} size={32} color={iconProps.color} />;
  };

  // Position styles
  const positionStyles = {
    'bottom-right': { bottom: 30, right: 20 },
    'bottom-left': { bottom: 30, left: 20 },
    'bottom-center': { bottom: 30, alignSelf: 'center' as const },
  };

  return (
    <View style={[styles.container, positionStyles[position]]}>
      {/* Mount/Unmount debug removed to avoid popups */}
      {/* Glow effect when listening */}
      {agentState.isListening && (
        <Animated.View
          style={[
            styles.glowRing,
            {
              opacity: glowAnim,
              transform: [{ scale: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.5],
              })}],
            },
          ]}
        />
      )}

      {/* Main button */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={getButtonStyle()}
          onPress={handlePress}
          onLongPress={handleLongPress}
          disabled={disabled || agentState.isProcessing}
          activeOpacity={0.8}
        >
          {getIcon()}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
  },
  dotLoader: {
    flexDirection: 'row',
    gap: 4,
  },
  glowRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.ORANGE,
    alignSelf: 'center',
  },
});