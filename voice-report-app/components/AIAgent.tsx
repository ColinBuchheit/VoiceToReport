// components/AIAgent.tsx - COMPLETE FIXED VERSION
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { AIAgentService } from '../services/aiAgentService';
import { VoiceCommandResponse, ScreenContext } from '../types/aiAgent';

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

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
    }
  }, [agentState.isListening, agentState.isProcessing, agentState.isPlayingResponse]);

  const startListeningAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
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
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopAllAnimations = () => {
    pulseAnim.stopAnimation();
    rotateAnim.stopAnimation();
    scaleAnim.stopAnimation();
    
    pulseAnim.setValue(1);
    rotateAnim.setValue(0);
    scaleAnim.setValue(1);
  };

  const startListening = async () => {
    try {
      console.log('🎙️ AI Agent starting to listen...');
      setAgentState(prev => ({ ...prev, isListening: true, error: undefined }));
      
      await aiService.startListening();
      console.log('✅ AI Agent listening started successfully');
      
      // Auto-stop after 15 seconds to prevent long recordings
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
      
      // Clear the auto-stop timer
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

  // CRITICAL FIX: Execute command first, then handle TTS separately
  const processCommand = async (audioUri: string) => {
    try {
      console.log('🤖 AI Agent processing voice command from:', audioUri);
      
      // IMPROVED: Better file validation
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      console.log('📁 Audio file info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }

      if (fileInfo.size && fileInfo.size < 500) {
        throw new Error('Audio recording too short - please speak longer');
      }
      
      // Process the voice command
      const response = await aiService.processVoiceCommand(audioUri, screenContext);
      console.log('📋 AI Agent response:', response);
      
      // CRITICAL FIX: Execute the command FIRST, regardless of TTS success
      await executeCommand(response);
      console.log('✅ AI Agent command executed successfully');
      
      // FIXED: Make TTS optional and non-blocking
      setAgentState(prev => ({ ...prev, isProcessing: false, isPlayingResponse: true }));
      
      try {
        await aiService.playTTSResponse(response.ttsText);
        console.log('🔊 AI Agent voice response completed');
      } catch (ttsError) {
        console.warn('🔇 AI Agent TTS failed (continuing without voice):', ttsError);
        // IMPROVED: Show text fallback instead of failing entirely
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
      
      // IMPROVED: More specific and helpful error messages
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
        // For clarifications, just play the TTS response or show alert
        // The TTS will be handled in processCommand
        break;
        
      default:
        console.warn('⚠️ Unknown AI command action:', response.action);
    }
  };

  const handlePress = async () => {
    // Prevent interaction when disabled or processing
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
    let additionalStyles = {};
    
    if (agentState.isListening) {
      additionalStyles = { backgroundColor: '#FF0000', shadowColor: '#FF0000' }; // Red for listening
    } else if (agentState.isProcessing) {
      additionalStyles = { backgroundColor: '#FFA500', shadowColor: '#FFA500' }; // Orange for processing
    } else if (agentState.isPlayingResponse) {
      additionalStyles = { backgroundColor: '#00FF00', shadowColor: '#00FF00' }; // Green for speaking
    } else if (disabled) {
      additionalStyles = { backgroundColor: '#999999', shadowColor: '#999999' }; // Gray for disabled
    }
    
    return [styles.agentButton, additionalStyles];
  };

  const getIcon = () => {
    if (agentState.isListening) return '🎙️';
    if (agentState.isProcessing) return '⚡';
    if (agentState.isPlayingResponse) return '🔊';
    if (disabled) return '🤖';
    return '🤖';
  };

  const getStatusText = () => {
    if (agentState.isListening) return 'Listening...';
    if (agentState.isProcessing) return 'Processing...';
    if (agentState.isPlayingResponse) return 'Speaking...';
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
        scale: agentState.isListening ? pulseAnim : 
               agentState.isPlayingResponse ? scaleAnim : 1 
      },
      { 
        rotate: agentState.isProcessing ? 
          rotateAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          }) : '0deg'
      }
    ],
  };

  return (
    <View style={containerStyle}>
      {/* Status text */}
      {getStatusText() && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      )}
      
      {/* AI Agent Button */}
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          style={getButtonStyle()}
          onPress={handlePress}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Text style={styles.agentIcon}>{getIcon()}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 1000,
  },
  positionBottomLeft: {
    bottom: 100,
    left: 20,
  },
  positionBottomCenter: {
    bottom: 100,
    left: '50%',
    marginLeft: -35, // Half of button width
  },
  positionBottomRight: {
    bottom: 100,
    right: 20,
  },
  statusContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 10,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  agentButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  agentIcon: {
    fontSize: 28,
  },
});