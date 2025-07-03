// Simplified Recorder.tsx with single press toggle
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
}

const { width } = Dimensions.get('window');

export default function Recorder({ onRecordingComplete, isProcessing }: RecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Simple animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
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

  // Start recording animations
  const startAnimations = () => {
    // Pulse animation
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

    // Wave animations
    const createWave = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    Animated.parallel([
      createWave(waveAnim1, 0),
      createWave(waveAnim2, 1000),
    ]).start();
  };

  // Start processing animation
  const startProcessingAnimation = () => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  };

  // Stop all animations
  const stopAnimations = () => {
    pulseAnim.stopAnimation();
    waveAnim1.stopAnimation();
    waveAnim2.stopAnimation();
    rotateAnim.stopAnimation();
    
    pulseAnim.setValue(1);
    waveAnim1.setValue(0);
    waveAnim2.setValue(0);
    rotateAnim.setValue(0);
  };

  // Start processing animation when isProcessing changes
  useEffect(() => {
    if (isProcessing) {
      startProcessingAnimation();
    } else if (!isRecording) {
      stopAnimations();
    }
  }, [isProcessing]);

  // Main toggle function
  const toggleRecording = async () => {
    if (isProcessing) return; // Don't allow interaction during processing
    
    if (isRecording) {
      // Stop recording
      await stopRecording();
    } else {
      // Start recording
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      console.log('Starting recording...');
      
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

      console.log('Recording started successfully');
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);
      startAnimations();

      // Start timer
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
      console.log('Stopping recording...');
      
      // Stop animations and timer immediately
      stopAnimations();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop the recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      console.log('Recording stopped successfully');
      
      // Update state
      setIsRecording(false);
      setRecording(null);
      setRecordingDuration(0);

      // Call completion callback
      if (uri) {
        console.log('Calling onRecordingComplete with URI:', uri);
        onRecordingComplete(uri);
      }

    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
      
      // Reset state on error
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

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Animated waves during recording */}
      {isRecording && (
        <>
          <Animated.View
            style={[
              styles.wave,
              {
                opacity: waveAnim1.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.3, 0],
                }),
                transform: [{
                  scale: waveAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 2],
                  }),
                }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.wave,
              {
                opacity: waveAnim2.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.2, 0],
                }),
                transform: [{
                  scale: waveAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.8],
                  }),
                }],
              },
            ]}
          />
        </>
      )}

      {/* Main pulse circle */}
      <Animated.View
        style={[
          styles.pulseCircle,
          {
            opacity: isRecording ? 0.4 : 0,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />

      {/* Main button */}
      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecording && styles.recordingActive,
          isProcessing && styles.processingActive,
        ]}
        onPress={toggleRecording}
        disabled={isProcessing}
        activeOpacity={0.8}
      >
        {isProcessing ? (
          <Animated.View
            style={[
              styles.processingContent,
              { transform: [{ rotate: rotateInterpolate }] },
            ]}
          >
            <View style={styles.processingSpinner} />
          </Animated.View>
        ) : (
          <View style={styles.micContainer}>
            <View style={[styles.micIcon, isRecording && styles.micIconActive]} />
            {isRecording && (
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Status text */}
      <View style={styles.statusContainer}>
        {isProcessing ? (
          <Text style={styles.statusText}>Processing your recording...</Text>
        ) : isRecording ? (
          <View style={styles.recordingStatus}>
            <Text style={styles.recordingText}>Recording</Text>
            <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
          </View>
        ) : (
          <Text style={styles.instructionText}>
            Press to start recording
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: width,
    height: 300,
  },
  wave: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  pulseCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#007AFF',
  },
  recordButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  recordingActive: {
    backgroundColor: '#FF3B30',
  },
  processingActive: {
    backgroundColor: '#34C759',
  },
  micContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: {
    width: 40,
    height: 50,
    backgroundColor: 'white',
    borderRadius: 20,
    position: 'relative',
  },
  micIconActive: {
    backgroundColor: '#FFF',
  },
  recordingIndicator: {
    position: 'absolute',
    top: -10,
    right: -10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFF',
  },
  processingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingSpinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: '#ffffff',
    borderTopColor: 'transparent',
  },
  statusContainer: {
    position: 'absolute',
    bottom: -60,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#34C759',
    fontWeight: '600',
  },
  recordingStatus: {
    alignItems: 'center',
  },
  recordingText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
    marginBottom: 4,
  },
  durationText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  instructionText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});