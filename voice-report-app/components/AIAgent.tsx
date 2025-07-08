// components/AIAgent.tsx - PROFESSIONAL VERSION WITH BEAR LOGO
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Alert,
  Image,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { AIAgentService } from '../services/aiAgentService';
import { VoiceCommandResponse, ScreenContext } from '../types/aiAgent';

// Professional SVG-style icons as text components
const MicrophoneIcon = ({ size = 24, color = '#FFFFFF' }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.micBody, { backgroundColor: color }]} />
    <View style={[styles.micTop, { backgroundColor: color }]} />
    <View style={[styles.micStand, { backgroundColor: color }]} />
    <View style={[styles.micBase, { backgroundColor: color }]} />
  </View>
);

const ProcessingIcon = ({ size = 24, color = '#FFFFFF' }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.processingDot1, { backgroundColor: color }]} />
    <View style={[styles.processingDot2, { backgroundColor: color }]} />
    <View style={[styles.processingDot3, { backgroundColor: color }]} />
  </View>
);

const SpeakerIcon = ({ size = 24, color = '#FFFFFF' }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.speakerBox, { borderColor: color }]} />
    <View style={[styles.speakerWave1, { borderColor: color }]} />
    <View style={[styles.speakerWave2, { borderColor: color }]} />
  </View>
);

// Bear Logo Icon Component
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

interface AIAgentState {
  isListening: boolean;
  isProcessing: boolean;
  isPlayingResponse: boolean;
  lastResponse?: string;
  error?: string;
}

interface AIAgentProps {
  screenContext: ScreenContext;
  onFieldUpdate?: (fieldName: string, value: string) => void;
  onModeToggle?: () => void;
  onNavigate?: (destination: string) => void;
  onAction?: (actionName: string, params?: any) => void;
  position?: 'bottom-left' | 'bottom-center' | 'bottom-right';
  disabled?: boolean;
}

export default function AIAgent({
  screenContext,
  onFieldUpdate,
  onModeToggle,
  onNavigate,
  onAction,
  position = 'bottom-right',
  disabled = false,
}: AIAgentProps) {
  const [agentState, setAgentState] = useState<AIAgentState>({
    isListening: false,
    isProcessing: false,
    isPlayingResponse: false,
  });

  const aiService = AIAgentService.getInstance();
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);

  // FIXED: Separate animation values for different properties
  const scaleAnim = useRef(new Animated.Value(1)).current;        // For transform scale (native)
  const rotateAnim = useRef(new Animated.Value(0)).current;       // For transform rotate (native)
  const opacityAnim = useRef(new Animated.Value(1)).current;      // For opacity (native)
  const haloAnim = useRef(new Animated.Value(0)).current;         // For orange halo effect (native)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimer.current) {
        clearTimeout(recordingTimer.current);
      }
      aiService.cleanup();
    };
  }, []);

  // Handle animations based on state
  useEffect(() => {
    if (agentState.isListening) {
      startListeningAnimation();
    } else if (agentState.isProcessing) {
      startProcessingAnimation();
    } else if (agentState.isPlayingResponse) {
      startResponseAnimation();
    } else {
      stopAllAnimations();
      // Start subtle halo animation for default state to draw attention
      startHaloAnimation();
    }
  }, [agentState.isListening, agentState.isProcessing, agentState.isPlayingResponse]);

  const startListeningAnimation = () => {
    // Simple scale pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startProcessingAnimation = () => {
    // Smooth rotation for processing
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  };

  const startResponseAnimation = () => {
    // Gentle pulse for speaking
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.08,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startHaloAnimation = () => {
    // Prominent orange pulsing halo effect for default state
    Animated.loop(
      Animated.sequence([
        Animated.timing(haloAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(haloAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopAllAnimations = () => {
    scaleAnim.stopAnimation();
    rotateAnim.stopAnimation();
    opacityAnim.stopAnimation();
    
    scaleAnim.setValue(1);
    rotateAnim.setValue(0);
    opacityAnim.setValue(1);
  };

  const startListening = async () => {
    try {
      console.log('🎙️ AI Agent starting to listen...');
      setAgentState(prev => ({ ...prev, isListening: true, error: undefined }));
      
      await aiService.startListening();
      console.log('✅ AI Agent listening started successfully');
      
      // Auto-stop after 15 seconds
      recordingTimer.current = setTimeout(() => {
        console.log('⏰ AI Agent auto-stopping after 15 seconds');
        stopListening();
      }, 15000);

    } catch (error) {
      console.error('❌ Failed to start AI Agent listening:', error);
      setAgentState(prev => ({ 
        ...prev, 
        isListening: false, 
        error: 'Failed to start listening' 
      }));
      
      let errorMessage = 'Failed to start voice recognition. Please try again.';
      if (error instanceof Error && error.message.includes('permission')) {
        errorMessage = 'Microphone permission denied. Please enable microphone access in settings.';
      }
      
      Alert.alert('AI Agent Error', errorMessage, [{ text: 'OK' }]);
    }
  };

  const stopListening = async () => {
    try {
      console.log('🛑 AI Agent stopping listening...');
      
      if (recordingTimer.current) {
        clearTimeout(recordingTimer.current);
        recordingTimer.current = null;
      }

      setAgentState(prev => ({ ...prev, isListening: false, isProcessing: true }));
      
      const audioUri = await aiService.stopListening();
      console.log('📁 AI Agent got audio URI:', audioUri);
      
      if (audioUri) {
        await processCommand(audioUri);
      } else {
        console.warn('⚠️ No audio URI received from AI Agent');
        setAgentState(prev => ({ 
          ...prev, 
          isProcessing: false, 
          error: 'No audio recorded' 
        }));
        Alert.alert('AI Agent', 'No audio was recorded. Please try again.', [{ text: 'OK' }]);
      }

    } catch (error) {
      console.error('❌ Failed to stop AI Agent listening:', error);
      setAgentState(prev => ({ 
        ...prev, 
        isListening: false, 
        isProcessing: false,
        error: 'Failed to process voice command'
      }));
      
      Alert.alert('AI Agent Error', 'Failed to process voice recording. Please try again.', [{ text: 'OK' }]);
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
      
      try {
        await aiService.playTTSResponse(response.ttsText);
        console.log('🔊 AI Agent voice response completed');
      } catch (ttsError) {
        console.warn('🔇 AI Agent TTS failed (continuing without voice):', ttsError);
        setTimeout(() => {
          Alert.alert('AI Agent', response.confirmation, [{ text: 'OK' }]);
        }, 500);
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
        } else if (error.message.includes('connect') || error.message.includes('server') || error.message.includes('backend')) {
          errorMessage = 'Cannot connect to server. Please check your internet connection and try again.';
        } else if (error.message.includes('understand') || error.message.includes('transcription')) {
          errorMessage = 'Could not understand the audio. Please speak clearly and try again.';
        } else if (error.message.includes('format')) {
          errorMessage = 'Audio format error. Please try recording again.';
        }
      }
      
      Alert.alert('AI Agent Error', errorMessage, [{ text: 'OK' }]);
    }
  };

  const executeCommand = async (response: VoiceCommandResponse) => {
    console.log(`🎯 Executing AI command: ${response.action}`, response);
    
    switch (response.action) {
      case 'update_field':
        if (response.target && response.value !== undefined && onFieldUpdate) {
          console.log(`📝 Updating field: ${response.target} = ${response.value}`);
          onFieldUpdate(response.target, response.value);
        } else {
          console.warn('⚠️ update_field action missing target or value:', response);
        }
        break;
        
      case 'toggle_mode':
        if (onModeToggle) {
          console.log('🔄 Toggling mode');
          onModeToggle();
        } else {
          console.warn('⚠️ toggle_mode action but no onModeToggle handler');
        }
        break;
        
      case 'navigate':
        if (response.target && onNavigate) {
          console.log(`🧭 Navigating to: ${response.target}`);
          onNavigate(response.target);
        } else {
          console.warn('⚠️ navigate action missing target or handler:', response);
        }
        break;
        
      case 'execute_action':
        if (response.target && onAction) {
          console.log(`⚡ Executing action: ${response.target}`);
          onAction(response.target);
        } else {
          console.warn('⚠️ execute_action missing target or handler:', response);
        }
        break;
        
      case 'clarify':
        console.log('❓ AI Agent needs clarification:', response.clarification);
        break;
        
      default:
        console.warn('⚠️ Unknown AI command action:', response.action);
    }
  };

  const handlePress = async () => {
    if (disabled || agentState.isProcessing || agentState.isPlayingResponse) {
      console.log('🚫 AI Agent interaction blocked - disabled or busy');
      return;
    }

    if (agentState.isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  };

  const getButtonStyle = () => {
    let baseStyle = styles.agentButton;
    let additionalStyles = {};
    
    if (agentState.isListening) {
      additionalStyles = { 
        backgroundColor: '#FF4757', // Professional red for listening
        shadowColor: '#FF4757',
        shadowOpacity: 0.6,
      };
    } else if (agentState.isProcessing) {
      additionalStyles = { 
        backgroundColor: '#FFA502', // Professional orange for processing
        shadowColor: '#FFA502',
        shadowOpacity: 0.5,
      };
    } else if (agentState.isPlayingResponse) {
      additionalStyles = { 
        backgroundColor: '#2ED573', // Professional green for speaking
        shadowColor: '#2ED573',
        shadowOpacity: 0.5,
      };
    } else if (disabled) {
      additionalStyles = { 
        backgroundColor: '#747D8C', // Professional gray for disabled
        shadowOpacity: 0.2,
      };
    } else {
      additionalStyles = {
        backgroundColor: '#2a2a2a', // Slightly lighter dark gray to complement the logo
        shadowColor: '#FFA502', // Orange shadow to match logo
        shadowOpacity: 0.3,
      };
    }
    
    return [baseStyle, additionalStyles];
  };

  const getIcon = () => {
    const iconSize = 55; // Larger bear logo for better visibility and impact
    const iconColor = '#FFFFFF';
    
    if (agentState.isListening) return <MicrophoneIcon size={28} color={iconColor} />;
    if (agentState.isProcessing) return <ProcessingIcon size={28} color={iconColor} />;
    if (agentState.isPlayingResponse) return <SpeakerIcon size={28} color={iconColor} />;
    
    // Default state shows your beautiful bear logo - larger and more prominent
    return <BearLogoIcon size={iconSize} opacity={1} />;
  };

  const getStatusText = () => {
    if (agentState.isListening) return 'Listening';
    if (agentState.isProcessing) return 'Processing';
    if (agentState.isPlayingResponse) return 'Speaking';
    if (agentState.error) return 'Error';
    return null;
  };

  const containerStyle = [
    styles.container,
    position === 'bottom-left' && styles.positionBottomLeft,
    position === 'bottom-center' && styles.positionBottomCenter,
    position === 'bottom-right' && styles.positionBottomRight,
  ];

  // FIXED: Single animation style with only native driver compatible properties
  const animatedStyle = {
    transform: [
      { 
        scale: agentState.isListening || agentState.isPlayingResponse ? scaleAnim : 1 
      },
      { 
        rotate: agentState.isProcessing ? 
          rotateAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          }) : '0deg'
      }
    ],
    opacity: opacityAnim,
  };

  // Orange halo effect for default state
  const haloStyle = {
    position: 'absolute' as const,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: '#FFA502',
    opacity: haloAnim,
    // FIXED: Perfect centering around the 70px button
    top: -10, // (90 - 70) / 2 = 10px offset to center
    left: -10, // (90 - 70) / 2 = 10px offset to center
    transform: [
      {
        scale: haloAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.3],
        }),
      },
    ],
  };

  return (
    <View style={containerStyle}>
      {/* Status text - FIXED: Positioned to prevent button shifting */}
      {getStatusText() && (
        <View style={[styles.statusContainer, styles.statusFixed]}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      )}
      
      {/* Button container with centered halo */}
      <View style={styles.buttonContainer}>
        {/* Orange Halo Effect - Behind and centered on the button */}
        {!agentState.isListening && !agentState.isProcessing && !agentState.isPlayingResponse && (
          <Animated.View style={haloStyle} />
        )}
        
        {/* AI Agent Button - FIXED: Static positioning */}
        <Animated.View style={animatedStyle}>
          <TouchableOpacity
            style={getButtonStyle()}
            onPress={handlePress}
            disabled={disabled}
            activeOpacity={0.8}
          >
            {getIcon()}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 1000,
  },
  buttonContainer: {
    position: 'relative',
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionBottomLeft: {
    bottom: 100,
    left: 20,
  },
  positionBottomCenter: {
    bottom: 100,
    left: '50%',
    marginLeft: -35,
  },
  positionBottomRight: {
    bottom: 100,
    right: 20,
  },
  statusContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusFixed: {
    position: 'absolute',
    top: -50, // Fixed position above button
    left: '50%',
    marginLeft: -50, // Center horizontally (approximate)
    minWidth: 100,
    alignItems: 'center',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  agentButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#2a2a2a', // Dark gray to complement the bear logo
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 165, 2, 0.2)', // Subtle orange border to match logo
  },
  
  // Bear logo styling
  bearLogo: {
    // Image styling handled by component props
  },
  
  // Icon styles - Professional geometric designs
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  
  // Microphone Icon
  micBody: {
    width: 8,
    height: 14,
    borderRadius: 4,
    position: 'absolute',
  },
  micTop: {
    width: 8,
    height: 3,
    borderRadius: 4,
    position: 'absolute',
    top: -2,
  },
  micStand: {
    width: 2,
    height: 6,
    position: 'absolute',
    bottom: -3,
  },
  micBase: {
    width: 12,
    height: 2,
    borderRadius: 1,
    position: 'absolute',
    bottom: -5,
  },
  
  // Processing Icon (three dots)
  processingDot1: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    left: 2,
  },
  processingDot2: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    left: 10,
  },
  processingDot3: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    left: 18,
  },
  
  // Speaker Icon
  speakerBox: {
    width: 8,
    height: 8,
    borderWidth: 2,
    position: 'absolute',
    left: 2,
  },
  speakerWave1: {
    width: 6,
    height: 6,
    borderWidth: 2,
    borderRadius: 3,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopWidth: 0,
    position: 'absolute',
    right: 6,
  },
  speakerWave2: {
    width: 8,
    height: 8,
    borderWidth: 2,
    borderRadius: 4,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopWidth: 0,
    position: 'absolute',
    right: 2,
  },
  
  // AI Icon (circle with dots)
  aiCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    position: 'absolute',
  },
  aiDot1: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    position: 'absolute',
    top: 6,
    left: 10.5,
  },
  aiDot2: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    position: 'absolute',
    top: 10.5,
    left: 7,
  },
  aiDot3: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    position: 'absolute',
    top: 10.5,
    right: 7,
  },
});