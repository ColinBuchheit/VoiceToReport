// voice-report-app/components/Recorder.tsx - WITH 3-DOT LOADING ANIMATION
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  Dimensions,
  Platform,
  Vibration,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import audioLockService from '../services/audioLockService';

interface RecorderProps {
  onRecordingComplete: (uri: string) => void;
  isProcessing: boolean;
  size?: 'small' | 'large';
  // Shared state props from parent
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
  recording: Audio.Recording | null;
  setRecording: (recording: Audio.Recording | null) => void;
  recordingDuration: number;
  setRecordingDuration: React.Dispatch<React.SetStateAction<number>>;
}

// 3-Dot Loading Component
const ThreeDotLoader = ({ size = 'small', color = '#FF6B35' }) => {
  const dot1Anim = useRef(new Animated.Value(0.3)).current;
  const dot2Anim = useRef(new Animated.Value(0.3)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;

  const isLarge = size === 'large';
  const dotSize = isLarge ? 8 : 6;
  const spacing = isLarge ? 12 : 8;

  useEffect(() => {
    const animateDots = () => {
      const duration = 500;
      const delay = 150;

      Animated.loop(
        Animated.sequence([
          // Animate dot 1
          Animated.timing(dot1Anim, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
          // Animate dot 2 (with overlap)
          Animated.timing(dot2Anim, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
          // Animate dot 3 (with overlap)
          Animated.timing(dot3Anim, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
          // Reset all dots
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
          // Small pause before restarting
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

export default function Recorder({ 
  onRecordingComplete, 
  isProcessing, 
  size = 'small',
  // Use shared state from parent instead of local state
  isRecording,
  setIsRecording,
  recording,
  setRecording,
  recordingDuration,
  setRecordingDuration,
}: RecorderProps) {
  
  // Company Colors
  const COLORS = {
    BLACK: '#000000',
    ORANGE: '#FF6B35',
    WHITE: '#FFFFFF',
    DARK_ORANGE: '#E55A2B',
    LIGHT_ORANGE: '#FF8A5C',
    GRAY: '#333333',
  };
  
  // Get screen dimensions
  const { width: screenWidth } = Dimensions.get('window');
  
  // Calculate responsive sizes
  const baseSmallSize = Math.min(screenWidth * 0.18, 140);
  const baseLargeSize = Math.min(screenWidth * 0.35, 280);
  const smallButtonSize = Math.max(baseSmallSize, 80);
  const largeButtonSize = Math.max(baseLargeSize, 180);
  
  const isLarge = size === 'large';
  const buttonSize = isLarge ? largeButtonSize : smallButtonSize;
  // Icon sizing: large keeps roughly same visual size, small made larger for clarity
  // Previous approach produced a very small mic in compact mode; adjust ratios.
  const iconSize = isLarge 
    ? Math.round(buttonSize * 0.36)   // ~65px for 180 button
    : Math.round(buttonSize * 0.60);  // Bigger mic (~48px for 80 button)
  
  // Enhanced Animation Values (removed rotateAnim since we don't need it anymore)
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const shadowAnim = useRef(new Animated.Value(1)).current;
  const innerGlowAnim = useRef(new Animated.Value(0)).current;
  const outerRingAnim = useRef(new Animated.Value(1)).current;

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      pulseAnim.stopAnimation();
      glowAnim.stopAnimation();
      innerGlowAnim.stopAnimation();
      outerRingAnim.stopAnimation();
    };
  }, []);

  // Enhanced animations based on state (removed rotation logic)
  useEffect(() => {
    if (isRecording) {
      // Recording state: Multiple layered animations
      Animated.loop(
        Animated.parallel([
          // Main pulse
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.12,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1200,
              useNativeDriver: true,
            }),
          ]),
          // Outer ring animation
          Animated.sequence([
            Animated.timing(outerRingAnim, {
              toValue: 1.2,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(outerRingAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();

      // Inner glow effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(innerGlowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(innerGlowAnim, {
            toValue: 0.4,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      ).start();

      // Outer glow
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.8,
            duration: 1800,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.2,
            duration: 1800,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else if (isProcessing) {
      // Processing state: Just pulse animation (dots handle the loading visual)
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
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
    } else {
      // Idle state: Stop all animations smoothly
      pulseAnim.stopAnimation();
      glowAnim.stopAnimation();
      innerGlowAnim.stopAnimation();
      outerRingAnim.stopAnimation();
      
      // Reset to idle values with smooth transitions
      Animated.parallel([
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
        Animated.timing(innerGlowAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
        Animated.timing(outerRingAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [isRecording, isProcessing]);

  const toggleRecording = async () => {
    if (isProcessing) return;

    // Haptic feedback and press animation
    Vibration.vibrate(50);
    rippleAnim.setValue(0);
    Animated.timing(rippleAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0.88, duration: 120, useNativeDriver: true }),
        Animated.timing(shadowAnim, { toValue: 0.3, duration: 120, useNativeDriver: false }),
      ]),
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 120, friction: 6, useNativeDriver: true }),
        Animated.timing(shadowAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      ]),
    ]).start();

    if (isRecording) {
      // ===== STOP RECORDING =====
      try {
        if (recording) {
          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();
          if (uri) {
            onRecordingComplete(uri);
          }
          setRecording(null);
        }
        setIsRecording(false);
        setRecordingDuration(0);
        await audioLockService.releaseLock('home-recorder');
      } catch (error) {
        console.error('Failed to stop recording:', error);
        Alert.alert('Error', 'Failed to stop recording');
        await audioLockService.releaseLock('home-recorder');
      }
      return;
    }

    // ===== START RECORDING =====
    // Check permission first to avoid Android dialog race
    const { status: initialStatus } = await Audio.getPermissionsAsync();
    if (initialStatus !== 'granted') {
      const { status: requestedStatus } = await Audio.requestPermissionsAsync();
      if (requestedStatus !== 'granted') {
        Alert.alert('Permission Required', 'Microphone access is required to record audio. Please enable it in settings.');
        return;
      }

      if (Platform.OS === 'android') {
        // Give Android a moment to settle after permission dialog
        await new Promise(resolve => setTimeout(resolve, 300));
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: false,
            staysActiveInBackground: false,
          });
        } catch (e) {
          console.warn('Initial audio mode reset failed (non-fatal):', e);
        }
      }
    }

    try {
      // Acquire audio lock
      const lockAcquired = await audioLockService.acquireLock('home-recorder');
      if (!lockAcquired) {
        Alert.alert('Microphone Busy', 'Another recording is in progress. Please stop it first.');
        return;
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      // Create and start recording — use Android speech-optimized options
      const isAndroid = Platform.OS === 'android';
      const outputFormat = (Audio as any).RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4 ?? 2; // MPEG_4 fallback
      const audioEncoder = (Audio as any).RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC ?? 3; // AAC fallback
      const audioSource = (Audio as any).RECORDING_OPTION_ANDROID_AUDIO_SOURCE_VOICE_RECOGNITION
        ?? (Audio as any).RECORDING_OPTION_ANDROID_AUDIO_SOURCE_MIC
        ?? 6; // VOICE_RECOGNITION (6) fallback

      const ANDROID_OPTIONS: Audio.RecordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat,
          audioEncoder,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          audioSource,
        },
        ios: Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
        web: Audio.RecordingOptionsPresets.HIGH_QUALITY.web,
        isMeteringEnabled: false,
      } as Audio.RecordingOptions;

      const options = isAndroid ? ANDROID_OPTIONS : Audio.RecordingOptionsPresets.HIGH_QUALITY;

      const { recording: newRecording } = await Audio.Recording.createAsync(options);

      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      // Duration timer is managed by parent (HomeScreen) when isRecording changes
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Recording Error', `Failed to start recording: ${errorMessage}\n\nPlease try again.`);
      await audioLockService.releaseLock('home-recorder');
      setIsRecording(false);
      setRecording(null);
      // Parent (HomeScreen) also clears any timer it owns
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get the appropriate icon and color based on state
  const getIconProps = () => {
    if (isRecording) {
      return {
        name: 'stop' as const, // Stop icon when recording
        color: COLORS.BLACK, // Black icon on orange background
      };
    } else if (isProcessing) {
      // No icon when processing - we'll show dots instead
      return null;
    } else {
      return {
        name: 'mic' as const, // Microphone icon when idle
        color: COLORS.WHITE, // White icon on black background
      };
    }
  };

  // Outer glow ring style
  const getOuterGlowStyle = () => {
    const glowOpacity = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.6],
    });

    return {
      position: 'absolute' as const,
      width: buttonSize + 60,
      height: buttonSize + 60,
      borderRadius: (buttonSize + 60) / 2,
      backgroundColor: 'transparent',
      borderWidth: 3,
      borderColor: COLORS.ORANGE,
      opacity: glowOpacity,
      top: -30,
      left: -30,
    };
  };

  // Outer ring animation
  const getOuterRingStyle = () => {
    return {
      position: 'absolute' as const,
      width: buttonSize + 20,
      height: buttonSize + 20,
      borderRadius: (buttonSize + 20) / 2,
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: isRecording ? COLORS.ORANGE : 'transparent',
      top: -10,
      left: -10,
      transform: [{ scale: outerRingAnim }],
    };
  };

  // Main button style with company branding
  const getButtonStyle = () => {
    const shadowIntensity = shadowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.1, 0.5],
    });

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
          shadowOpacity: shadowIntensity,
          shadowRadius: isLarge ? 20 : 12,
          shadowOffset: { width: 0, height: isLarge ? 12 : 8 },
        },
        android: {
          elevation: isLarge ? 15 : 8,
        },
      }),
    };

    if (isRecording) {
      return {
        ...baseStyle,
        backgroundColor: COLORS.ORANGE,
        borderColor: COLORS.BLACK,
      };
    } else if (isProcessing) {
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

  // Ripple effect style
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

  // Inner glow overlay
  const getInnerGlowStyle = () => {
    const innerGlowOpacity = innerGlowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.2],
    });

    return {
      position: 'absolute' as const,
      width: buttonSize - 8,
      height: buttonSize - 8,
      borderRadius: (buttonSize - 8) / 2,
      backgroundColor: COLORS.WHITE,
      opacity: innerGlowOpacity,
    };
  };

  const iconProps = getIconProps();

  return (
    <View style={[styles.container, isLarge && styles.centerContainer]}>
      {/* Enhanced Status Bubble with Company Branding */}
      {isRecording && (
        <Animated.View 
          style={[
            styles.statusBubble,
            {
              transform: [{ scale: pulseAnim }],
              backgroundColor: COLORS.BLACK,
              borderColor: COLORS.ORANGE,
            }
          ]}
        >
          <View style={[styles.recordingIndicator, { backgroundColor: COLORS.ORANGE }]} />
          <Text style={[styles.statusText, { color: COLORS.WHITE }]}>
            REC {formatDuration(recordingDuration)}
          </Text>
        </Animated.View>
      )}

      {/* Button Container with all effects */}
      <Animated.View
        style={[
          {
            transform: [
              { scale: scaleAnim },
              { scale: pulseAnim },
            ]
          }
        ]}
      >
        {/* Outer glow effect */}
        <Animated.View style={getOuterGlowStyle()} />
        
        {/* Outer ring animation */}
        <Animated.View style={getOuterRingStyle()} />
        
        {/* Ripple effect */}
        <Animated.View style={getRippleStyle()} />
        
        {/* Inner glow overlay */}
        <Animated.View style={getInnerGlowStyle()} />
        
        {/* Main Button */}
        <Animated.View style={getButtonStyle()}>
          <TouchableOpacity
            style={styles.touchableArea}
            onPress={toggleRecording}
            disabled={isProcessing}
            activeOpacity={0.95}
          >
            {/* Show either icon or 3-dot loader */}
            {isProcessing ? (
              <ThreeDotLoader 
                size={size} 
                color={COLORS.ORANGE} 
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
  },
  
  // Enhanced Status Bubble
  statusBubble: {
    position: 'absolute',
    top: -60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 8,
      },
    }),
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  
  // Button Styles
  touchableArea: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // 3-Dot Loader Styles
  dotLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    // Styles will be applied inline for dynamic sizing
  },
});