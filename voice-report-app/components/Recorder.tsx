// mobile-app/components/Recorder.tsx - FIXED VERSION
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
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, [recording]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const startRecording = async () => {
    try {
      // Clean up any existing recording
      if (recording) {
        await recording.stopAndUnloadAsync();
        setRecording(null);
      }

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable microphone permissions');
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
      startPulseAnimation();
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      stopPulseAnimation();
      setIsRecording(false);

      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
      const uri = recording.getURI();

      if (uri) {
        onRecordingComplete(uri);
      }

      setRecording(null);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
      setRecording(null);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.pulseCircle,
          {
            transform: [{ scale: pulseAnim }],
            opacity: isRecording ? 0.3 : 0,
          },
        ]}
      />
      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecording && styles.recordingActive,
          isProcessing && styles.disabled,
        ]}
        onPressIn={startRecording}
        onPressOut={stopRecording}
        disabled={isProcessing}
      >
        <View style={styles.innerCircle}>
          {isProcessing ? (
            <Text style={styles.processingText}>Processing...</Text>
          ) : (
            <>
              <View style={[styles.micIcon, isRecording && styles.micIconActive]} />
              {isRecording && (
                <Text style={styles.recordingText}>Recording...</Text>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FF3B30',
  },
  recordButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordingActive: {
    backgroundColor: '#FF3B30',
  },
  disabled: {
    opacity: 0.5,
  },
  innerCircle: {
    alignItems: 'center',
  },
  micIcon: {
    width: 40,
    height: 60,
    backgroundColor: 'white',
    borderRadius: 20,
    marginBottom: 8,
  },
  micIconActive: {
    backgroundColor: '#FFF',
  },
  recordingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  processingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});