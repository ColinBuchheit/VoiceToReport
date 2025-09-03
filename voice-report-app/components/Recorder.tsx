// voice-report-app/components/Recorder.tsx - FLOATING ACTION BUTTON STYLE
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';

interface RecorderProps {
  onRecordingComplete: (uri: string) => void;
  isProcessing: boolean;
}

export default function Recorder({ onRecordingComplete, isProcessing }: RecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
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
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable microphone permissions in Settings');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      setIsRecording(false);
      setRecording(null);
      setRecordingDuration(0);

      if (uri) {
        onRecordingComplete(uri);
      }

    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
      
      setIsRecording(false);
      setRecording(null);
      setRecordingDuration(0);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Status Text - Appears above button when active */}
      {(isRecording || isProcessing) && (
        <View style={styles.statusBubble}>
          {isProcessing ? (
            <Text style={styles.statusText}>Processing...</Text>
          ) : (
            <Text style={styles.statusText}>{formatDuration(recordingDuration)}</Text>
          )}
        </View>
      )}

      {/* Main Floating Action Button */}
      <Animated.View style={{
        transform: [
          { scale: Animated.multiply(scaleAnim, pulseAnim) }
        ]
      }}>
        <TouchableOpacity
          style={[
            styles.fab,
            isRecording && styles.fabRecording,
            isProcessing && styles.fabProcessing,
          ]}
          onPress={toggleRecording}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <View style={styles.processingIcon} />
          ) : (
            <View style={[
              styles.micIcon,
              isRecording && styles.micIconRecording
            ]} />
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
    width: 70,
    height: 70,
    borderRadius: 35,
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
    width: 120,
    height: 120,
    borderRadius: 60,
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
  
  // Regular Microphone Icon
  micIcon: {
    width: 24,
    height: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    position: 'relative',
  },
  micIconRecording: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    width: 20,
    height: 20,
  },
  
  // Large Microphone Icon for Center Mode
  micIconLarge: {
    width: 36,
    height: 42,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
  },
  
  // Regular Processing Icon
  processingIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderTopColor: 'transparent',
  },
  
  // Large Processing Icon for Center Mode
  processingIconLarge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    borderTopColor: 'transparent',
  },
});