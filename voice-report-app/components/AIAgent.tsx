// components/AIAgent.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  Dimensions,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { AIAgentProps, AIAgentState, VoiceCommandResponse } from '../types/aiAgent';
import { AIAgentService } from '../services/aiAgentService';

const { width } = Dimensions.get('window');

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

  // Animation refs (reuse patterns from your Recorder.tsx)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const aiService = useRef(AIAgentService.getInstance()).current;
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      aiService.cleanup();
      if (recordingTimer.current) {
        clearTimeout(recordingTimer.current);
      }
    };
  }, []);

  // Animation effects
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

  const handlePress = async () => {
    if (disabled || agentState.isProcessing || agentState.isPlayingResponse) {
      return;
    }

    if (agentState.isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  };

  const startListening = async () => {
    try {
      setAgentState(prev => ({ ...prev, isListening: true, error: undefined }));
      
      await aiService.startListening();
      
      // Auto-stop after 15 seconds
      recordingTimer.current = setTimeout(() => {
        stopListening();
      }, 15000);

    } catch (error) {
      console.error('Failed to start listening:', error);
      setAgentState(prev => ({ 
        ...prev, 
        isListening: false, 
        error: 'Failed to start listening' 
      }));
      Alert.alert('Error', 'Failed to start voice recognition');
    }
  };

  const stopListening = async () => {
    try {
      if (recordingTimer.current) {
        clearTimeout(recordingTimer.current);
        recordingTimer.current = null;
      }

      setAgentState(prev => ({ ...prev, isListening: false, isProcessing: true }));
      
      const audioUri = await aiService.stopListening();
      
      if (audioUri) {
        await processCommand(audioUri);
      } else {
        setAgentState(prev => ({ ...prev, isProcessing: false }));
      }

    } catch (error) {
      console.error('Failed to stop listening:', error);
      setAgentState(prev => ({ 
        ...prev, 
        isListening: false, 
        isProcessing: false,
        error: 'Failed to process voice command'
      }));
    }
  };

  const processCommand = async (audioUri: string) => {
    try {
      console.log('🤖 AI Agent processing voice command from:', audioUri);
      
      // Verify audio file exists
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      console.log('📁 Audio file info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }
      
      const response = await aiService.processVoiceCommand(audioUri, screenContext);
      console.log('📋 AI Agent response:', response);
      
      // Execute the command first
      await executeCommand(response);
      console.log('✅ AI Agent command executed successfully');
      
      // Try TTS response (make it optional)
      setAgentState(prev => ({ ...prev, isProcessing: false, isPlayingResponse: true }));
      
      try {
        await aiService.playTTSResponse(response.ttsText);
        console.log('🔊 AI Agent voice response completed');
      } catch (ttsError) {
        console.warn('🔇 AI Agent TTS failed (continuing without voice):', ttsError);
        // Show the text response instead
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
      
      // Show more specific error messages
      let errorMessage = 'Failed to process voice command. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('Audio file does not exist')) {
          errorMessage = 'Audio recording failed. Please try again.';
        } else if (error.message.includes('No backend server')) {
          errorMessage = 'Connection to server failed. Please check your internet connection.';
        } else if (error.message.includes('Transcription failed')) {
          errorMessage = 'Could not understand the audio. Please speak clearly and try again.';
        }
      }
      
      Alert.alert('AI Agent Error', errorMessage, [{ text: 'OK' }]);
    }
  };

  const executeCommand = async (response: VoiceCommandResponse) => {
    switch (response.action) {
      case 'update_field':
        if (response.target && response.value !== undefined && onFieldUpdate) {
          onFieldUpdate(response.target, response.value);
        }
        break;
        
      case 'toggle_mode':
        if (onModeToggle) {
          onModeToggle();
        }
        break;
        
      case 'navigate':
        if (response.target && onNavigate) {
          onNavigate(response.target);
        }
        break;
        
      case 'execute_action':
        if (response.target && onAction) {
          onAction(response.target);
        }
        break;
        
      case 'clarify':
        // For clarifications, just play the TTS response
        break;
        
      default:
        console.warn('Unknown command action:', response.action);
    }
  };

  const getButtonStyle = () => {
    let additionalStyles = {};
    
    if (agentState.isListening) {
      additionalStyles = { backgroundColor: '#FF0000' };
    } else if (agentState.isProcessing) {
      additionalStyles = { backgroundColor: '#FFA500' };
    } else if (agentState.isPlayingResponse) {
      additionalStyles = { backgroundColor: '#00FF00' };
    }
    
    return [styles.agentButton, additionalStyles];
  };

  const getIcon = () => {
    if (agentState.isListening) return '🎙️';
    if (agentState.isProcessing) return '⚡';
    if (agentState.isPlayingResponse) return '🔊';
    return '🤖';
  };

  const getStatusText = () => {
    if (agentState.isListening) return 'Listening...';
    if (agentState.isProcessing) return 'Processing...';
    if (agentState.isPlayingResponse) return 'Speaking...';
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
      },
    ],
  };

  return (
    <View style={containerStyle}>
      {getStatusText() && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      )}
      
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Animated.View style={[styles.iconContainer, animatedStyle]}>
          <Text style={styles.icon}>{getIcon()}</Text>
        </Animated.View>
      </TouchableOpacity>
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
    bottom: 100,
    right: 20,
  },
  positionBottomLeft: {
    bottom: 100,
    left: 20,
  },
  positionBottomCenter: {
    bottom: 100,
    left: width / 2 - 30,
  },
  statusContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  agentButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
  },
});