// voice-report-app/components/AIAgent.tsx - VISUAL UPDATE ONLY (NO FUNCTIONALITY CHANGES)
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  Alert,
  StyleSheet,
  ViewStyle,
  DimensionValue,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { AIAgentService } from '../services/aiAgentService';
import { 
  AIAgentProps, 
  AIAgentState, 
  ScreenContext, 
  VoiceCommandResponse 
} from '../types/aiAgent';

// Company Colors (matching Recorder)
const COLORS = {
  BLACK: '#000000',
  ORANGE: '#FF6B35',
  WHITE: '#FFFFFF',
  DARK_ORANGE: '#E55A2B',
  LIGHT_ORANGE: '#FF8A5C',
  GRAY: '#333333',
};

// Animated Dots Component (matching Recorder)
const AnimatedDots = ({ 
  color = COLORS.WHITE, 
  dotSize = 4, 
  spacing = 4,
}: {
  color?: string;
  dotSize?: number;
  spacing?: number;
}) => {
  const dot1Anim = useRef(new Animated.Value(0.3)).current;
  const dot2Anim = useRef(new Animated.Value(0.3)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const duration = 800;
    const animateDots = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot1Anim, {
            toValue: 1,
            duration: duration / 3,
            useNativeDriver: true,
          }),
          Animated.timing(dot2Anim, {
            toValue: 1,
            duration: duration / 3,
            useNativeDriver: true,
          }),
          Animated.timing(dot3Anim, {
            toValue: 1,
            duration: duration / 3,
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.timing(dot1Anim, {
              toValue: 0.3,
              duration: duration / 2,
              useNativeDriver: true,
            }),
            Animated.timing(dot2Anim, {
              toValue: 0.3,
              duration: duration / 2,
              useNativeDriver: true,
            }),
            Animated.timing(dot3Anim, {
              toValue: 0.3,
              duration: duration / 2,
              useNativeDriver: true,
            }),
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

  return (
    <View style={[styles.dotLoader, { gap: spacing }]}>
      <Animated.View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            opacity: dot1Anim,
            transform: [{ scale: dot1Anim }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            opacity: dot2Anim,
            transform: [{ scale: dot2Anim }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            opacity: dot3Anim,
            transform: [{ scale: dot3Anim }],
          },
        ]}
      />
    </View>
  );
};

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
  
  // State Management (NO CHANGES)
  const [agentState, setAgentState] = useState<AIAgentState>({
    isListening: false,
    isProcessing: false,
    isPlayingResponse: false,
  });

  // Service and Refs (NO CHANGES)
  const aiService = AIAgentService.getInstance();
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);

  // Animation Values (matching Recorder style)
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shadowAnim = useRef(new Animated.Value(0)).current;
  const outerRingAnim = useRef(new Animated.Value(1)).current;
  const innerGlowAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Calculate sizes (matching Recorder responsive approach)
  const { width: screenWidth } = Dimensions.get('window');
  const baseSize = Math.min(screenWidth * 0.15, 70); // Smaller than main recorder
  const buttonSize = Math.max(baseSize, 60);
  const iconScale = buttonSize / 140;
  const iconSize = Math.round(buttonSize * 0.4);

  // Cleanup on unmount (NO CHANGES)
  useEffect(() => {
    return () => {
      if (recordingTimer.current) {
        clearTimeout(recordingTimer.current);
      }
    };
  }, []);

  // Animation Functions (matching Recorder style)
  const startListeningAnimation = () => {
    // Scale animation
    Animated.timing(scaleAnim, {
      toValue: 1.1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Outer ring animation
    Animated.loop(
      Animated.timing(outerRingAnim, {
        toValue: 1.1,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  };

  const startProcessingAnimation = () => {
    // Shadow animation for processing
    Animated.timing(shadowAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();

    // Scale down slightly
    Animated.timing(scaleAnim, {
      toValue: 0.95,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const stopAllAnimations = () => {
    scaleAnim.setValue(1);
    glowAnim.stopAnimation(() => glowAnim.setValue(0));
    shadowAnim.stopAnimation(() => shadowAnim.setValue(0));
    outerRingAnim.stopAnimation(() => outerRingAnim.setValue(1));
    innerGlowAnim.stopAnimation(() => innerGlowAnim.setValue(0));
    rippleAnim.stopAnimation(() => rippleAnim.setValue(0));
    pulseAnim.stopAnimation(() => pulseAnim.setValue(1));
  };

  // ALL FUNCTIONALITY METHODS UNCHANGED (just keeping the existing ones)
  const startListening = async () => {
    if (agentState.isListening || agentState.isProcessing) return;
    
    try {
      console.log('🎤 AI Agent starting to listen...');
      setAgentState(prev => ({ ...prev, isListening: true }));
      startListeningAnimation();
      
      await aiService.startListening();
      console.log('✅ AI Agent listening started successfully');
      
      recordingTimer.current = setTimeout(async () => {
        await stopListening();
      }, 10000);
      
    } catch (error) {
      console.error('❌ AI Agent listening failed:', error);
      setAgentState(prev => ({ ...prev, isListening: false }));
      stopAllAnimations();
      Alert.alert('Error', 'Failed to start voice recording. Please check microphone permissions.');
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
      
      setAgentState(prev => ({ ...prev, isListening: false, isProcessing: true }));
      startProcessingAnimation();
      
      const audioUri = await aiService.stopListening();
      console.log('📁 Audio URI:', audioUri);
      
      if (audioUri) {
        await processVoiceCommand(audioUri);
      }
      
    } catch (error) {
      console.error('❌ AI Agent stop listening failed:', error);
      setAgentState({ isListening: false, isProcessing: false, isPlayingResponse: false });
      stopAllAnimations();
      Alert.alert('Error', 'Failed to process voice recording. Please try again.');
    }
  };

  // Keep all the existing processing methods unchanged...
  const processVoiceCommand = async (audioUri: string) => {
    try {
      console.log('🤖 AI Agent processing voice command from:', audioUri);
      
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      console.log('📁 Audio file info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }
      
      const response = await aiService.processVoiceCommand(audioUri, screenContext);
      console.log('📋 AI Agent response:', response);
      
      await executeCommand(response);
      
    } catch (error) {
      console.error('❌ AI Agent processing failed:', error);
      
      let errorMessage = 'Voice command processing failed. ';
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('connection')) {
          errorMessage = 'Network connection failed. Please check your internet connection and try again.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Microphone permission denied. Please enable microphone access and try again.';
        } else if (error.message.includes('understand') || error.message.includes('transcription')) {
          errorMessage = 'Could not understand the audio. Please speak clearly and try again.';
        }
      }
      
      Alert.alert('AI Agent Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      stopAllAnimations();
    }
  };

  // Keep ALL existing functionality methods unchanged...
  const executeCommand = async (response: VoiceCommandResponse) => {
    console.log('🎯 executeCommand called with:', response);
    
    try {
      switch (response.action) {
        case 'update_field':
        case 'edit_field':
          await handleFieldUpdate(response);
          break;
          
        case 'toggle_mode':
        case 'toggle_edit_mode':
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
        case 'respond':
          console.log('✅ Command acknowledged:', response.confirmation);
          break;
          
        default:
          console.warn('⚠️ Unknown command action:', response.action);
          break;
      }
      
      console.log('✅ AI Agent command executed successfully');
      
    } catch (error) {
      console.error('❌ Command execution failed:', error);
      Alert.alert('Error', 'Command execution failed. Please try again.');
    } finally {
      setAgentState({ isListening: false, isProcessing: false, isPlayingResponse: false });
      stopAllAnimations();
    }
  };

  // Keep all existing handler methods unchanged...
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

    const isInPreviewMode = screenContext.mode === 'preview';
    const isEditingMode = screenContext.currentValues?.isEditing === false;

    if (isInPreviewMode || isEditingMode) {
      console.log('🔄 Switching to edit mode before field update');
      try {
        await onFieldUpdate('isEditing', 'true');
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
      
      let newEditingState: boolean;
      if (currentMode === 'preview') {
        newEditingState = true;
      } else {
        newEditingState = !currentEditingState;
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

  const handlePress = async () => {
    if (disabled) return;

    if (agentState.isListening) {
      await stopListening();
    } else if (!agentState.isProcessing && !agentState.isPlayingResponse) {
      await startListening();
    }
  };

  // VISUAL UPDATES START HERE

  // Get icon and color based on state (matching Recorder logic)
  const getIconProps = () => {
    if (agentState.isListening) {
      return {
        name: 'stop' as const,
        color: COLORS.BLACK,
      };
    } else if (agentState.isProcessing) {
      return null; // Show dots instead
    } else {
      return {
        name: 'mic' as const,
        color: COLORS.WHITE,
      };
    }
  };

  // Main button style (removed shadow animation to avoid native driver conflicts)
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
        backgroundColor: COLORS.ORANGE,
        borderColor: COLORS.BLACK,
      };
    } else if (agentState.isProcessing) {
      return {
        ...baseStyle,
        backgroundColor: COLORS.WHITE,
        borderColor: COLORS.ORANGE,
      };
    } else {
      return {
        ...baseStyle,
        backgroundColor: COLORS.BLACK,
        borderColor: COLORS.ORANGE,
      };
    }
  };

  // Outer glow style (matching Recorder)
  const getOuterGlowStyle = () => {
    const glowOpacity = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.6],
    });

    return {
      position: 'absolute' as const,
      width: buttonSize + 40,
      height: buttonSize + 40,
      borderRadius: (buttonSize + 40) / 2,
      backgroundColor: 'transparent',
      borderWidth: 3,
      borderColor: COLORS.ORANGE,
      opacity: glowOpacity,
      top: -20,
      left: -20,
    };
  };

  // Outer ring style (matching Recorder)
  const getOuterRingStyle = () => {
    return {
      position: 'absolute' as const,
      width: buttonSize + 15,
      height: buttonSize + 15,
      borderRadius: (buttonSize + 15) / 2,
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: agentState.isListening ? COLORS.ORANGE : 'transparent',
      top: -7.5,
      left: -7.5,
      transform: [{ scale: outerRingAnim }],
    };
  };

  // Ripple effect style (matching Recorder)
  const getRippleStyle = () => {
    const rippleScale = rippleAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 2.5],
    });
    
    const rippleOpacity = rippleAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.6, 0.3, 0],
    });

    return {
      position: 'absolute' as const,
      width: buttonSize,
      height: buttonSize,
      borderRadius: buttonSize / 2,
      backgroundColor: COLORS.ORANGE,
      opacity: rippleOpacity,
      transform: [{ scale: rippleScale }],
    };
  };

  // Position calculation (unchanged)
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

  const iconProps = getIconProps();

  return (
    <View style={[styles.container, getPositionStyle()]}>
      {/* Outer Glow Ring */}
      <Animated.View style={getOuterGlowStyle()} />
      
      {/* Outer Ring */}
      <Animated.View style={getOuterRingStyle()} />
      
      {/* Ripple Effect */}
      {agentState.isListening && <Animated.View style={getRippleStyle()} />}
      
      {/* Main Button */}
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
        }}
      >
        <TouchableOpacity
          style={getButtonStyle()}
          onPress={handlePress}
          disabled={disabled}
          activeOpacity={0.8}
        >
          {agentState.isProcessing ? (
            <AnimatedDots 
              color={COLORS.ORANGE} 
              dotSize={Math.max(buttonSize * 0.05, 4)}
              spacing={Math.max(buttonSize * 0.03, 3)}
            />
          ) : iconProps ? (
            <Ionicons
              name={iconProps.name}
              size={iconSize}
              color={iconProps.color}
            />
          ) : null}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// UPDATED STYLES (matching Recorder styling)
const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
    elevation: 1000,
  },
  dotLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    // Dot styles handled inline
  },
});