// voice-report-app/components/EmailSuccessPopup.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface EmailSuccessPopupProps {
  visible: boolean;
  emailList: string[];
  onComplete: () => void;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function EmailSuccessPopup({ visible, emailList, onComplete }: EmailSuccessPopupProps) {
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
        // Fade in overlay
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        // Scale in card
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // Draw circle
        Animated.timing(circleProgress, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        // Draw checkmark
        Animated.timing(checkProgress, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => {
        onComplete();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const circleStrokeDashoffset = circleProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [283, 0],
  });

  const checkStrokeDashoffset = checkProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [70, 0],
  });

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            }
          ]}
        >
          {/* Animated Checkmark */}
          <View style={styles.checkmarkContainer}>
            <Svg width={96} height={96} viewBox="0 0 100 100">
              {/* Circle */}
              <AnimatedCircle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeDasharray="283"
                strokeDashoffset={circleStrokeDashoffset}
              />
              {/* Checkmark */}
              <AnimatedPath
                d="M25 50 L40 65 L75 30"
                fill="none"
                stroke="#10b981"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="70"
                strokeDashoffset={checkStrokeDashoffset}
              />
            </Svg>
          </View>

          {/* Success Message */}
          <Text style={styles.title}>Successfully Sent!</Text>

          {/* Email List */}
          <View style={styles.emailListContainer}>
            <Text style={styles.emailListTitle}>Sent to:</Text>
            {emailList.map((email, index) => (
              <View key={index} style={styles.emailItem}>
                <View style={styles.bullet} />
                <Text style={styles.emailText}>{email}</Text>
              </View>
            ))}
          </View>
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
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    maxWidth: 400,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  checkmarkContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  emailListContainer: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  emailListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 8,
  },
  emailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
    marginRight: 8,
  },
  emailText: {
    fontSize: 14,
    color: '#15803d',
  },
});