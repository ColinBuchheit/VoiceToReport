// voice-report-app/components/Recorder.tsx - COMPLETE FIXED VERSION
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
  const iconScale = buttonSize / 140;
  
  // Icon sizes
  const micSize = isLarge ? 
    { width: Math.round(32 * iconScale), height: Math.round(40 * iconScale) } : 
    { width: Math.round(20 * iconScale), height: Math.round(26 * iconScale) };
  const micSizeRecording = isLarge ? 
    { width: Math.round(24 * iconScale), height: Math.round(24 * iconScale) } : 
    { width: Math.round(16 * iconScale), height: Math.round(16 * iconScale) };
  const processingSize = isLarge ? 
    { width: Math.round(28 * iconScale), height: Math.round(28 * iconScale) } : 
    { width: Math.round(18 * iconScale), height: Math.round(18 * iconScale) };
  
  // Enhanced Animation Values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const shadowAnim = useRef(new Animated.Value(1)).current;
  const innerGlowAnim = useRef(new Animated.Value(0)).current;
  const outerRingAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      // Only clean up timer, not recording (parent manages recording state)
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Enhanced animations based on state
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
      // Processing state: Smooth rotation with pulse
      Animated.loop(
        Animated.parallel([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 2500,
            useNativeDriver: true,
          }),
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
          ]),
        ])
      ).start();
    } else {
      // Idle state: Stop all animations smoothly
      pulseAnim.stopAnimation();
      glowAnim.stopAnimation();
      rotateAnim.stopAnimation();
      innerGlowAnim.stopAnimation();
      outerRingAnim.stopAnimation();
      
      // Reset to idle values with smooth transitions
      Animated.parallel([
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(innerGlowAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
        Animated.timing(outerRingAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [isRecording, isProcessing]);

  const toggleRecording = async () => {
    if (isProcessing) return;
    
    // Platform-specific haptic feedback
    if (Platform.OS === 'ios') {
      Vibration.vibrate(80);
    } else {
      Vibration.vibrate([0, 50, 50, 50]);
    }
    
    // Ripple effect
    rippleAnim.setValue(0);
    Animated.timing(rippleAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Enhanced press feedback
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.88,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(shadowAnim, {
          toValue: 0.3,
          duration: 120,
          useNativeDriver: false,
        }),
      ]),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(shadowAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
      ]),
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

        // Start timer only if not already running (prevent duplicates)
        if (!timerRef.current) {
          timerRef.current = setInterval(() => {
            setRecordingDuration((prev: number) => prev + 1);
          }, 1000);
        }
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
          elevation: isLarge ? 16 : 12,
        },
      }),
    };

    if (isRecording) {
      return [
        baseStyle,
        {
          backgroundColor: COLORS.BLACK,
          borderColor: COLORS.ORANGE,
          borderWidth: 5,
        }
      ];
    } else if (isProcessing) {
      return [
        baseStyle,
        {
          backgroundColor: COLORS.ORANGE,
          borderColor: COLORS.BLACK,
          borderWidth: 4,
        }
      ];
    } else {
      return [
        baseStyle,
        {
          backgroundColor: COLORS.ORANGE,
          borderColor: COLORS.WHITE,
          borderWidth: 4,
        }
      ];
    }
  };

  // Ripple effect
  const getRippleStyle = () => {
    const rippleScale = rippleAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 2.5],
    });

    const rippleOpacity = rippleAnim.interpolate({
      inputRange: [0, 0.3, 1],
      outputRange: [0, 0.4, 0],
    });

    return {
      position: 'absolute' as const,
      width: buttonSize,
      height: buttonSize,
      borderRadius: buttonSize / 2,
      backgroundColor: COLORS.WHITE,
      opacity: rippleOpacity,
      transform: [{ scale: rippleScale }],
    };
  };

  // Microphone icon with company styling
  const getMicStyle = () => {
    const borderRadius = Math.round(iconScale * (isLarge ? 14 : 10));
    
    if (isRecording) {
      return [
        styles.micIconRecording,
        micSizeRecording,
        { 
          borderRadius: 4,
          backgroundColor: COLORS.ORANGE,
        }
      ];
    } else {
      return [
        styles.micIcon,
        micSize,
        { 
          borderRadius,
          backgroundColor: isProcessing ? COLORS.WHITE : COLORS.BLACK,
        }
      ];
    }
  };

  // Processing icon with rotation
  const getProcessingStyle = () => {
    const rotateInterpolate = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return [
      styles.processingIcon,
      processingSize,
      { 
        borderRadius: processingSize.width / 2,
        borderWidth: Math.max(Math.round(iconScale * 3), 2),
        borderColor: COLORS.BLACK,
        borderTopColor: 'transparent',
        transform: [{ rotate: rotateInterpolate }],
      }
    ];
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
            {isProcessing ? (
              <Animated.View style={getProcessingStyle()} />
            ) : (
              <View style={getMicStyle()} />
            )}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Company-branded Status Bubble
  statusBubble: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 25,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  recordingIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo-Bold' : 'monospace',
    letterSpacing: 1,
  },
  
  touchableArea: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 1000,
  },
  
  // Company-styled Microphone Icon
  micIcon: {
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  micIconRecording: {
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  
  // Processing Icon
  processingIcon: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});