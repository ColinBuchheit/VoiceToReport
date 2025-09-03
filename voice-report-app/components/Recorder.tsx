// voice-report-app/components/Recorder.tsx - Fully responsive with proper variable scoping
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
import { Audio } from 'expo-av';

interface RecorderProps {
  onRecordingComplete: (uri: string) => void;
  isProcessing: boolean;
  size?: 'small' | 'large'; // Size prop to control button size
}

export default function Recorder({ 
  onRecordingComplete, 
  isProcessing, 
  size = 'small' // Default to small size
}: RecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Get screen dimensions
  const { width: screenWidth } = Dimensions.get('window');
  
  // Calculate responsive sizes based on screen dimensions
  const baseSmallSize = Math.min(screenWidth * 0.18, 140); // 18% of screen width, max 140px
  const baseLargeSize = Math.min(screenWidth * 0.35, 280); // 35% of screen width, max 280px
  
  // Ensure minimum sizes for usability
  const smallButtonSize = Math.max(baseSmallSize, 80); // Minimum 80px
  const largeButtonSize = Math.max(baseLargeSize, 180); // Minimum 180px
  
  const isLarge = size === 'large';
  const buttonSize = isLarge ? largeButtonSize : smallButtonSize;
  
  // Scale icons proportionally to button size
  const iconScale = buttonSize / 140; // 140 was our original base size
  
  const micSize = isLarge ? 
    { width: Math.round(36 * iconScale), height: Math.round(42 * iconScale) } : 
    { width: Math.round(24 * iconScale), height: Math.round(28 * iconScale) };
  const micSizeRecording = isLarge ? 
    { width: Math.round(30 * iconScale), height: Math.round(30 * iconScale) } : 
    { width: Math.round(20 * iconScale), height: Math.round(20 * iconScale) };
  const processingSize = isLarge ? 
    { width: Math.round(30 * iconScale), height: Math.round(30 * iconScale) } : 
    { width: Math.round(20 * iconScale), height: Math.round(20 * iconScale) };
  
  // Animations for floating button
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(console.warn);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Floating button animations
  useEffect(() => {
    if (isRecording) {
      // Pulsing animation during recording
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
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
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const toggleRecording = async () => {
    if (isProcessing) return;
    
    // Haptic feedback on press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    if (isRecording) {
      // Stop recording
      try {
        if (recording) {
          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();
          if (uri) {
            onRecordingComplete(uri);
          }
          setRecording(null);
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setIsRecording(false);
        setRecordingDuration(0);
      } catch (error) {
        console.error('Failed to stop recording:', error);
        Alert.alert('Error', 'Failed to stop recording');
      }
    } else {
      // Start recording
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Please enable microphone access');
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const newRecording = new Audio.Recording();
        await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await newRecording.startAsync();
        
        setRecording(newRecording);
        setIsRecording(true);
        setRecordingDuration(0);

        // Start timer
        timerRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
      } catch (error) {
        console.error('Failed to start recording:', error);
        Alert.alert('Error', 'Failed to start recording');
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getButtonStyle = () => {
    if (isLarge) {
      return [
        styles.centerFab,
        isRecording && styles.centerFabRecording,
        isProcessing && styles.centerFabProcessing,
        { 
          width: buttonSize, 
          height: buttonSize, 
          borderRadius: buttonSize / 2,
          borderWidth: Math.max(Math.round(iconScale * 4), 3) // Responsive border width
        }
      ];
    } else {
      return [
        styles.fab,
        isRecording && styles.fabRecording,
        isProcessing && styles.fabProcessing,
        { 
          width: buttonSize, 
          height: buttonSize, 
          borderRadius: buttonSize / 2,
          borderWidth: Math.max(Math.round(iconScale * 3), 2) // Responsive border width
        }
      ];
    }
  };

  const getMicStyle = () => {
    const borderRadius = size === 'large' ? Math.round(iconScale * 18) : Math.round(iconScale * 12);
    if (isRecording) {
      return [
        styles.micIconRecording,
        micSizeRecording,
        { borderRadius: Math.round(borderRadius * 0.3) } // Smaller radius when recording
      ];
    } else {
      return [
        styles.micIcon,
        micSize,
        { borderRadius }
      ];
    }
  };

  const getProcessingStyle = () => {
    return [
      styles.processingIcon,
      processingSize,
      { 
        borderRadius: processingSize.width / 2,
        borderWidth: Math.max(Math.round(iconScale * 3), 2) // Responsive border width
      }
    ];
  };

  return (
    <View style={[styles.container, isLarge && styles.centerContainer]}>
      {/* Status Bubble - Only show during recording */}
      {isRecording && (
        <View style={styles.statusBubble}>
          <Text style={styles.statusText}>
            {formatDuration(recordingDuration)}
          </Text>
        </View>
      )}

      {/* Main Recording Button */}
      <Animated.View
        style={[
          { transform: [{ scale: scaleAnim }, { scale: pulseAnim }] }
        ]}
      >
        <TouchableOpacity
          style={getButtonStyle()}
          onPress={toggleRecording}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <View style={getProcessingStyle()} />
          ) : (
            <View style={getMicStyle()} />
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Status Bubble - Appears above button
  statusBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  
  // Regular Floating Action Button
  fab: {
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  fabRecording: {
    backgroundColor: '#EF4444',
    borderColor: '#FFFFFF',
  },
  fabProcessing: {
    backgroundColor: '#6B7280',
  },
  
  // Large Center Mode FAB
  centerFab: {
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  centerFabRecording: {
    backgroundColor: '#EF4444',
    borderColor: '#FFFFFF',
  },
  centerFabProcessing: {
    backgroundColor: '#6B7280',
  },
  
  // Microphone Icon (responsive to size)
  micIcon: {
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  micIconRecording: {
    backgroundColor: '#FFFFFF',
  },
  
  // Processing Icon (responsive to size)
  processingIcon: {
    borderColor: '#FFFFFF',
    borderTopColor: 'transparent',
  },
});