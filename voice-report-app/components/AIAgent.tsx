import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Alert,
  Image,
  ViewStyle,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { AIAgentService } from '../services/aiAgentService';
import { VoiceCommandResponse, ScreenContext, AIAgentProps, AIAgentState } from '../types/aiAgent';

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

// FIXED: Updated component to use the correct AIAgentProps interface
export default function AIAgent({
  screenContext,
  onFieldUpdate,
  onModeToggle,
  onNavigate,
  onAction,
  onCapabilityExplain,        // FIXED: Added missing prop
  onSuggestionProvided,       // FIXED: Added missing prop
  position = 'bottom-right',
  disabled = false,
  showDebugInfo = false,      // FIXED: Added missing prop
  customStyle,                // FIXED: Added missing prop
}: AIAgentProps) {
  const [agentState, setAgentState] = useState<AIAgentState>({
    isListening: false,
    isProcessing: false,
    isPlayingResponse: false,
  });

  const aiService = AIAgentService.getInstance();
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);

  // FIXED: Separate animation values for different properties
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
      startHaloAnimation();
    }
  }, [agentState.isListening, agentState.isProcessing, agentState.isPlayingResponse]);

  const startListeningAnimation = () => {
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
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  };

  const startResponseAnimation = () => {
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
    haloAnim.stopAnimation();
    
    scaleAnim.setValue(1);
    rotateAnim.setValue(0);
    opacityAnim.setValue(1);
    haloAnim.setValue(0);
  };

  const startListening = async () => {
    try {
      console.log('🎤 AI Agent starting to listen...');
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
      setAgentState(prev => ({ ...prev, isListening: false, isProcessing: true }));
      
      if (recordingTimer.current) {
        clearTimeout(recordingTimer.current);
        recordingTimer.current = null;
      }
      
      const audioUri = await aiService.stopListening();
      
      if (audioUri) {
        await processCommand(audioUri);
      } else {
        setAgentState(prev => ({ ...prev, isProcessing: false }));
        Alert.alert('AI Agent', 'No audio recorded. Please try again.', [{ text: 'OK' }]);
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
          onNavigate(response.target, response.metadata);
        } else {
          console.warn('⚠️ navigate action missing target or handler:', response);
        }
        break;
        
      case 'execute_action':
        if (response.target && onAction) {
          console.log(`⚡ Executing action: ${response.target}`);
          onAction(response.target, response.metadata);
        } else {
          console.warn('⚠️ execute_action missing target or handler:', response);
        }
        break;
        
      case 'explain_capabilities':
        if (response.target && onCapabilityExplain) {
          console.log(`💡 Explaining capability: ${response.target}`);
          onCapabilityExplain(response.target);
        } else {
          console.warn('⚠️ explain_capabilities missing target or handler:', response);
        }
        break;
        
      case 'provide_suggestion':
        if (response.value && onSuggestionProvided) {
          console.log(`💭 Providing suggestion: ${response.value}`);
          onSuggestionProvided(response.value, response.target);
        } else {
          console.warn('⚠️ provide_suggestion missing value or handler:', response);
        }
        break;
        
      case 'clarify':
        console.log('❓ AI Agent needs clarification:', response.clarification);
        Alert.alert('Clarification Needed', response.clarification || 'Could you please rephrase that?');
        break;
        
      case 'acknowledge':
        console.log('✅ AI Agent acknowledged:', response.confirmation);
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

  // FIXED: Proper button styling with correct TypeScript types
  const getButtonStyle = (): ViewStyle[] => {
    const baseStyle: ViewStyle = {
      ...styles.agentButton,
    };
    
    // Apply custom styling if provided
    if (customStyle) {
      if (customStyle.buttonColor) {
        baseStyle.backgroundColor = customStyle.buttonColor;
      }
      if (customStyle.size) {
        baseStyle.width = customStyle.size;
        baseStyle.height = customStyle.size;
        baseStyle.borderRadius = customStyle.size / 2;
      }
    }
    
    // State-based styling overrides
    if (agentState.isListening) {
      baseStyle.backgroundColor = '#FF4757';
      baseStyle.shadowColor = '#FF4757';
      baseStyle.shadowOpacity = 0.6;
    } else if (agentState.isProcessing) {
      baseStyle.backgroundColor = '#FFA502';
      baseStyle.shadowColor = '#FFA502';
      baseStyle.shadowOpacity = 0.5;
    } else if (agentState.isPlayingResponse) {
      baseStyle.backgroundColor = '#2ED573';
      baseStyle.shadowColor = '#2ED573';
      baseStyle.shadowOpacity = 0.5;
    } else if (disabled) {
      baseStyle.backgroundColor = '#747D8C';
      baseStyle.shadowOpacity = 0.2;
    }
    
    return [baseStyle];
  };

  const getIcon = () => {
    const iconSize = customStyle?.size ? Math.floor(customStyle.size * 0.9) : 55;
    const iconColor = customStyle?.iconColor || '#FFFFFF';
    
    if (agentState.isListening) return <MicrophoneIcon size={28} color={iconColor} />;
    if (agentState.isProcessing) return <ProcessingIcon size={28} color={iconColor} />;
    if (agentState.isPlayingResponse) return <SpeakerIcon size={28} color={iconColor} />;
    
    // Default state shows the bear logo
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

  const animatedStyle = {
    transform: [
      { 
        scale: agentState.isListening || agentState.isPlayingResponse ? scaleAnim : 1 
      },
      { 
        rotate: agentState.isProcessing ? rotateAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }) : '0deg'
      },
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
    top: -10,
    left: -10,
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
      {/* Status text */}
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
        
        {/* AI Agent Button */}
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
      
      {/* Debug info */}
      {showDebugInfo && __DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            Screen: {screenContext.screenName}
          </Text>
          <Text style={styles.debugText}>
            Fields: {screenContext.visibleFields.length}
          </Text>
          <Text style={styles.debugText}>
            Actions: {screenContext.availableActions.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 1000,
  },
  positionBottomRight: {
    bottom: 20,
    right: 20,
  },
  positionBottomLeft: {
    bottom: 20,
    left: 20,
  },
  positionBottomCenter: {
    bottom: 20,
    left: '50%',
    marginLeft: -30,
  },
  buttonContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFA502',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusFixed: {
    position: 'absolute',
    top: -35,
    left: '50%',
    marginLeft: -25,
    width: 50,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  debugContainer: {
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 8,
    borderRadius: 4,
    minWidth: 120,
  },
  debugText: {
    fontSize: 10,
    color: '#fff',
    textAlign: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  micBody: {
    width: 8,
    height: 12,
    borderRadius: 4,
  },
  micTop: {
    width: 12,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  micStand: {
    width: 2,
    height: 6,
    marginTop: 2,
  },
  micBase: {
    width: 8,
    height: 2,
    borderRadius: 1,
    marginTop: 1,
  },
  processingDot1: {
    width: 4,
    height: 4,
    borderRadius: 2,
    margin: 2,
  },
  processingDot2: {
    width: 4,
    height: 4,
    borderRadius: 2,
    margin: 2,
  },
  processingDot3: {
    width: 4,
    height: 4,
    borderRadius: 2,
    margin: 2,
  },
  speakerBox: {
    width: 8,
    height: 8,
    borderWidth: 2,
    borderRadius: 2,
  },
  speakerWave1: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderRadius: 8,
    position: 'absolute',
    borderColor: 'transparent',
    borderRightColor: '#fff',
    borderTopColor: '#fff',
    borderBottomColor: '#fff',
  },
  speakerWave2: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 10,
    position: 'absolute',
    borderColor: 'transparent',
    borderRightColor: '#fff',
    borderTopColor: '#fff',
    borderBottomColor: '#fff',
  },
  bearLogo: {
    // Bear logo specific styling
  },
});