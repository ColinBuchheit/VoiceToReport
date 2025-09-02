// voice-report-app/components/AIAgent.tsx - COMPLETE FIXED VERSION
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  Alert,
  StyleSheet,
  Image,
  ViewStyle,
  DimensionValue,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { AIAgentService } from '../services/aiAgentService';
import { 
  AIAgentProps, 
  AIAgentState, 
  ScreenContext, 
  VoiceCommandResponse 
} from '../types/aiAgent';

// Animated Speaker Wave Component
const SpeakerWave = ({ color = '#007AFF', isActive = false }) => (
  <View style={styles.speakerContainer}>
    <View style={[styles.speakerWave1, { borderColor: color, opacity: isActive ? 1 : 0.3 }]} />
    <View style={[styles.speakerWave2, { borderColor: color, opacity: isActive ? 0.8 : 0.2 }]} />
  </View>
);

// Bear Logo Component
const BearLogoIcon = ({ size = 55, opacity = 1 }) => (
  <Image 
    source={require('../assets/bears&t2.png')} 
    style={[
      styles.bearLogo, 
      { 
        width: size, 
        height: size,
        opacity: opacity 
      }
    ]}
    resizeMode="contain"
  />
);

export default function AIAgent({
  screenContext,
  onFieldUpdate,
  onModeToggle,
  onNavigate,
  onAction,
  onCapabilityExplain,
  onSuggestionProvided,
  position = 'bottom-right',
  disabled = false,
  showDebugInfo = false,
  customStyle,
}: AIAgentProps) {
  
  // State Management
  const [agentState, setAgentState] = useState<AIAgentState>({
    isListening: false,
    isProcessing: false,
    isPlayingResponse: false,
  });

  // Service and Refs
  const aiService = AIAgentService.getInstance();
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);

  // Animation Values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const haloAnim = useRef(new Animated.Value(0)).current;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimer.current) {
        clearTimeout(recordingTimer.current);
      }
    };
  }, []);

  // Animation Functions
  const startListeningAnimation = () => {
    // Scale animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
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

    // Rotation animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

    // Halo animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(haloAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(haloAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startProcessingAnimation = () => {
    // Continuous rotation during processing
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();

    // Pulsing opacity
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.6,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopAllAnimations = () => {
    scaleAnim.stopAnimation(() => scaleAnim.setValue(1));
    rotateAnim.stopAnimation(() => rotateAnim.setValue(0));
    opacityAnim.stopAnimation(() => opacityAnim.setValue(1));
    haloAnim.stopAnimation(() => haloAnim.setValue(0));
  };

  // Core AI Agent Functions - FIXED METHOD NAMES
  const startListening = async () => {
    if (disabled || agentState.isListening || agentState.isProcessing) return;

    try {
      console.log('🎤 AI Agent starting to listen...');
      setAgentState(prev => ({ ...prev, isListening: true, error: undefined }));
      startListeningAnimation();

      // FIXED: Use startListening() instead of startRecording()
      await aiService.startListening();
      console.log('✅ AI Agent listening started successfully');

      // Auto-stop after 10 seconds
      recordingTimer.current = setTimeout(() => {
        console.log('⏰ Auto-stopping AI Agent recording after timeout');
        stopListening();
      }, 10000);

    } catch (error) {
      console.error('❌ Failed to start AI Agent listening:', error);
      setAgentState(prev => ({ 
        ...prev, 
        isListening: false, 
        error: 'Failed to start listening'
      }));
      stopAllAnimations();
      
      Alert.alert(
        'Microphone Error', 
        'Failed to access microphone. Please check permissions and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const stopListening = async () => {
    if (!agentState.isListening) return;

    try {
      console.log('🛑 AI Agent stopping listening...');
      
      if (recordingTimer.current) {
        clearTimeout(recordingTimer.current);
        recordingTimer.current = null;
      }

      setAgentState(prev => ({ 
        ...prev, 
        isListening: false, 
        isProcessing: true 
      }));
      
      stopAllAnimations();
      startProcessingAnimation();

      // FIXED: Use stopListening() instead of stopRecording()
      const audioUri = await aiService.stopListening();
      
      if (!audioUri) {
        throw new Error('Failed to get recording URI');
      }

      console.log('✅ AI Agent recording stopped successfully');
      console.log('📁 Audio URI:', audioUri);

      await processCommand(audioUri);

    } catch (error) {
      console.error('❌ Failed to stop AI Agent listening:', error);
      setAgentState(prev => ({ 
        ...prev, 
        isListening: false, 
        isProcessing: false,
        error: 'Failed to process recording'
      }));
      stopAllAnimations();
      
      Alert.alert(
        'Recording Error', 
        'Failed to process voice recording. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const processCommand = async (audioUri: string) => {
    try {
      console.log('🤖 AI Agent processing voice command from:', audioUri);
      
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      console.log('📁 Audio file info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }

      if (fileInfo.size && fileInfo.size < 500) {
        throw new Error('Audio recording too short - please speak longer');
      }
      
      const response = await aiService.processVoiceCommand(audioUri, screenContext);
      console.log('📋 AI Agent response:', response);
      
      await executeCommand(response);
      console.log('✅ AI Agent command executed successfully');
      
      setAgentState(prev => ({ ...prev, isProcessing: false, isPlayingResponse: true }));
      
      // Only play TTS for specific actions or when explicitly requested
      const shouldPlayTTS = shouldProvideTTSResponse(response);
      
      if (shouldPlayTTS && response.ttsText) {
        try {
          await aiService.playTTSResponse(response.ttsText);
          console.log('🔊 AI Agent voice response completed');
        } catch (ttsError) {
          console.warn('🔇 AI Agent TTS failed (continuing silently):', ttsError);
        }
      }
      
      setAgentState(prev => ({ 
        ...prev, 
        isPlayingResponse: false,
        lastResponse: response.confirmation,
        error: undefined
      }));

    } catch (error) {
      console.error('❌ AI Agent command processing failed:', error);
      setAgentState(prev => ({ 
        ...prev, 
        isProcessing: false,
        isPlayingResponse: false,
        error: 'Failed to understand command'
      }));
      
      let errorMessage = 'Failed to process voice command. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('too short')) {
          errorMessage = 'Please speak for a longer duration and try again.';
        } else if (error.message.includes('Audio file does not exist')) {
          errorMessage = 'Recording failed. Please try again.';
        } else if (error.message.includes('connect') || error.message.includes('server')) {
          errorMessage = 'Cannot connect to server. Please check your internet connection and try again.';
        } else if (error.message.includes('understand') || error.message.includes('transcription')) {
          errorMessage = 'Could not understand the audio. Please speak clearly and try again.';
        }
      }
      
      Alert.alert('AI Agent Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      stopAllAnimations();
    }
  };

  // Determine when to provide TTS response
  const shouldProvideTTSResponse = (response: VoiceCommandResponse): boolean => {
    // Only provide TTS for:
    // 1. Clarification requests (always need audio feedback)
    // 2. Read commands (user explicitly asked to hear something)
    // 3. Help/explanation requests
    if (response.action === 'clarify' || response.needs_clarification) {
      return true;
    }
    
    if (response.action === 'explain_capabilities' || response.action === 'acknowledge') {
      return true;
    }
    
    // Skip TTS for field updates and other actions (low confidence gets TTS)
    if (response.action === 'update_field' && response.confidence > 0.8) {
      return false;
    }
    
    return response.confidence < 0.7; // Low confidence = provide audio feedback
  };

  // Enhanced command execution with better error handling and logging
  const executeCommand = async (response: VoiceCommandResponse) => {
    console.log('🎯 executeCommand called with:', response);
    
    try {
      switch (response.action) {
        case 'update_field':
        case 'edit_field': // Handle alias
          await handleFieldUpdate(response);
          break;
          
        case 'toggle_mode':
        case 'toggle_edit_mode': // Handle alias
          await handleModeToggle(response);
          break;
          
        case 'execute_action':
          await handleActionExecution(response);
          break;
          
        case 'navigate':
          await handleNavigation(response);
          break;
          
        case 'clear_field':
          await handleFieldClear(response);
          break;
          
        case 'explain_capabilities':
          handleCapabilityExplanation(response);
          break;
          
        case 'provide_suggestion':
          handleSuggestion(response);
          break;
          
        case 'acknowledge':
        case 'respond': // Handle backend response type
          console.log('✅ Command acknowledged:', response.confirmation);
          // No action needed for acknowledgments
          break;
          
        default:
          console.warn('⚠️ Unknown command action:', response.action);
          break;
      }
      
      console.log('✅ AI Agent command executed successfully');
      
    } catch (error) {
      console.error('❌ Command execution failed:', error);
      Alert.alert('Error', 'Command execution failed. Please try again.');
    }
  };

  // Enhanced field update with better error handling and logging
  const handleFieldUpdate = async (response: VoiceCommandResponse) => {
    console.log('🔄 handleFieldUpdate called with:', response);
    
    if (!response.target || response.value === undefined) {
      console.warn('⚠️ Field update missing target or value:', response);
      return;
    }

    if (!onFieldUpdate) {
      console.warn('⚠️ onFieldUpdate callback not provided');
      return;
    }

    // Check if we need to switch to edit mode first
    const isInPreviewMode = screenContext.mode === 'preview';
    const isEditingMode = screenContext.currentValues?.isEditing === false;

    if (isInPreviewMode || isEditingMode) {
      console.log('🔄 Switching to edit mode before field update');
      try {
        await onFieldUpdate('isEditing', 'true');
        // Small delay to let the UI update
        await new Promise(resolve => setTimeout(resolve, 150));
        await onFieldUpdate(response.target, response.value);
      } catch (error) {
        console.error('❌ Error updating field with mode switch:', error);
        throw error;
      }
    } else {
      console.log('🔄 Updating field directly (already in edit mode)');
      await onFieldUpdate(response.target, response.value);
    }

    console.log(`📝 Field updated: ${response.target} = "${response.value}"`);
  };

  const handleModeToggle = async (response: VoiceCommandResponse) => {
    console.log('🔄 handleModeToggle called');
    
    if (onFieldUpdate) {
      const currentEditingState = screenContext.currentValues?.isEditing || false;
      const currentMode = screenContext.mode;
      
      // Determine new state based on current context
      let newEditingState: boolean;
      if (currentMode === 'preview') {
        newEditingState = true; // Switch to edit
      } else {
        newEditingState = !currentEditingState; // Toggle current state
      }
      
      await onFieldUpdate('isEditing', String(newEditingState));
      console.log(`🔄 Mode toggled: editing = ${newEditingState}`);
    } else if (onModeToggle) {
      onModeToggle();
      console.log('🔄 Mode toggled via onModeToggle callback');
    }
  };

  const handleActionExecution = async (response: VoiceCommandResponse) => {
    if (onAction) {
      const actionName = response.target || response.action;
      await onAction(actionName, screenContext.currentValues);
      console.log(`⚡ Action executed: ${actionName}`);
    }
  };

  const handleNavigation = async (response: VoiceCommandResponse) => {
    if (response.target && onNavigate) {
      await onNavigate(response.target, response.metadata);
      console.log(`🧭 Navigation: ${response.target}`);
    }
  };

  const handleFieldClear = async (response: VoiceCommandResponse) => {
    if (response.target && onFieldUpdate) {
      await onFieldUpdate(response.target, '');
      console.log(`🗑️ Field cleared: ${response.target}`);
    }
  };

  const handleCapabilityExplanation = (response: VoiceCommandResponse) => {
    if (response.target && onCapabilityExplain) {
      onCapabilityExplain(response.target);
    }
  };

  const handleSuggestion = (response: VoiceCommandResponse) => {
    if (response.value && onSuggestionProvided) {
      onSuggestionProvided(response.value, response.target);
    }
  };

  // Handle button press - FIXED METHOD CALLS
  const handlePress = async () => {
    if (disabled) return;

    if (agentState.isListening) {
      // FIXED: Use stopListening() instead of stopRecording()
      await stopListening();
    } else if (!agentState.isProcessing && !agentState.isPlayingResponse) {
      // FIXED: Use startListening() instead of startRecording()
      await startListening();
    }
  };

  // Calculate positioning
  const buttonSize = (customStyle as any)?.size || 70;
  const haloSize = buttonSize + 20;
  const haloOffset = -10;

  // FIXED: Remove invalid position values
  const getPositionStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      position: 'absolute',
      bottom: 100,
    };

    switch (position) {
      case 'bottom-left':
        return { ...baseStyle, left: 20 };
      case 'bottom-center':
        return { 
          ...baseStyle, 
          left: '50%' as DimensionValue, 
          marginLeft: -buttonSize / 2 
        };
      case 'bottom-right':
      default:
        return { ...baseStyle, right: 20 };
    }
  };

  // Animation interpolations
  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const haloOpacity = haloAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.8],
  });

  const containerStyle: ViewStyle[] = [
    styles.container, 
    getPositionStyle()
  ];

  return (
    <View style={containerStyle}>
      {/* Animated Halo */}
      <Animated.View
        style={[
          styles.halo,
          {
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            top: haloOffset,
            left: haloOffset,
            opacity: haloOpacity,
          },
        ]}
      />
      
      {/* Main Button */}
      <Animated.View
        style={{
          transform: [
            { scale: scaleAnim },
            { rotate: rotateInterpolate },
          ],
          opacity: opacityAnim,
        }}
      >
        <TouchableOpacity
          style={[
            styles.button,
            {
              width: buttonSize,
              height: buttonSize,
              borderRadius: buttonSize / 2,
              backgroundColor: (customStyle as any)?.buttonColor || (
                agentState.isListening ? '#FF4444' :
                agentState.isProcessing ? '#FFA500' :
                agentState.isPlayingResponse ? '#00AA00' : '#007AFF'
              ),
            },
          ]}
          onPress={handlePress}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <View style={styles.buttonContent}>
            <BearLogoIcon 
              size={buttonSize * 0.6} 
              opacity={disabled ? 0.5 : 1} 
            />
            
            {(agentState.isListening || agentState.isPlayingResponse) && (
              <SpeakerWave 
                color={(customStyle as any)?.iconColor || '#FFFFFF'} 
                isActive={agentState.isListening || agentState.isPlayingResponse}
              />
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
    elevation: 1000,
  },
  halo: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonContent: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  bearLogo: {
    position: 'absolute',
  },
  speakerContainer: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 20,
    height: 20,
  },
  speakerWave1: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    top: 4,
    left: 4,
  },
  speakerWave2: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    opacity: 0.6,
  },
});