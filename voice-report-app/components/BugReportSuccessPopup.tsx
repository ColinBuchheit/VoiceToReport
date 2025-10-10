// voice-report-app/components/BugReportSuccessPopup.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Svg, { Circle, Path } from 'react-native-svg';

interface BugReportSuccessPopupProps {
  visible: boolean;
  onComplete: () => void;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function BugReportSuccessPopup({ visible, onComplete }: BugReportSuccessPopupProps) {
  const { colors, isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const circleProgress = useRef(new Animated.Value(0)).current;
  const checkProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      circleProgress.setValue(0);
      checkProgress.setValue(0);

      // Start animation sequence
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(circleProgress, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(checkProgress, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();

      // Auto-dismiss after 2.5 seconds
      const timer = setTimeout(() => { onComplete(); }, 2500);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const circleStrokeDashoffset = circleProgress.interpolate({ inputRange: [0, 1], outputRange: [283, 0] });
  const checkStrokeDashoffset = checkProgress.interpolate({ inputRange: [0, 1], outputRange: [70, 0] });

  const successColor = '#10b981';
  const titleColor = colors.textPrimary;
  const subtitleColor = isDark ? '#a7f3d0' : '#166534';

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.overlay, { opacity: fadeAnim, backgroundColor: colors.overlay }]}>
        <Animated.View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ scale: scaleAnim }], opacity: fadeAnim }]}>
          <View style={styles.checkmarkContainer}>
            <Svg width={96} height={96} viewBox="0 0 100 100">
              <AnimatedCircle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={successColor}
                strokeWidth="4"
                strokeDasharray="283"
                strokeDashoffset={circleStrokeDashoffset}
              />
              <AnimatedPath
                d="M25 50 L40 65 L75 30"
                fill="none"
                stroke={successColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="70"
                strokeDashoffset={checkStrokeDashoffset}
              />
            </Svg>
          </View>
          <Text style={[styles.title, { color: titleColor }]}>Bug Report Sent</Text>
          <Text style={[styles.subtitle, { color: subtitleColor }]}>Thanks for helping improve the app!</Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 28,
    maxWidth: 380,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  checkmarkContainer: {
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
});
