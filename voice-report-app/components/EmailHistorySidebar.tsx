// voice-report-app/components/EmailHistorySidebar.tsx
// Fixed: Location name display, revert button visibility, and overall UI improvements

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StatusBar,
  PanResponder,
  Easing,
  Platform,
} from 'react-native';
import { EmailHistoryItem } from '../services/emailHistoryService';
// import emailHistoryService if it is the default export
import emailHistoryService from '../services/emailHistoryService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

interface EmailHistorySidebarProps {
  visible: boolean;
  onClose: () => void;
  /** Preferred prop name */
  onEmailSelect?: (email: EmailHistoryItem) => void;
  /** Legacy prop name kept for backward compatibility */
  onSelectEmail?: (email: EmailHistoryItem) => void;
}

export default function EmailHistorySidebar({
  visible,
  onClose,
  onEmailSelect,
  onSelectEmail,
}: EmailHistorySidebarProps) {
  const [history, setHistory] = useState<EmailHistoryItem[]>([]);
  const [recentlyDeleted, setRecentlyDeleted] = useState<{ item: EmailHistoryItem; index: number } | null>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  // New animation values for smoother open/close UX
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelScale = useRef(new Animated.Value(0.96)).current;
  const contentTranslate = useRef(new Animated.Value(24)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const animationMapRef = useRef<Record<string, { scale: Animated.Value; opacity: Animated.Value; swipeX: Animated.Value }>>({});
  // Per-email haptic trigger tracking & undo timeout ref
  const hapticTriggeredMapRef = useRef<Record<string, boolean>>({});
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      loadHistory();
      // Reset entrance values before animating in
      backdropOpacity.setValue(0);
      panelScale.setValue(0.96);
      contentTranslate.setValue(24);
      contentOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 70,
          friction: 11,
        }),
        Animated.spring(panelScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 90,
          friction: 12,
        }),
        Animated.sequence([
          Animated.delay(80),
          Animated.parallel([
            Animated.timing(contentOpacity, {
              toValue: 1,
              duration: 240,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.spring(contentTranslate, {
              toValue: 0,
              useNativeDriver: true,
              tension: 110,
              friction: 14,
            }),
          ]),
        ]),
      ]).start();
    } else {
      // Animate out (reverse) with slight scale down and fade
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_WIDTH,
          duration: 260,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(panelScale, {
          toValue: 0.97,
          duration: 220,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Reset content translation after it finishes closing for next open
        contentTranslate.setValue(24);
      });
    }
  }, [visible]);

  const loadHistory = async () => {
    try {
      const emails = await emailHistoryService.getEmailHistory();
      // Deduplicate by id in case of accidental double insertion (e.g., dev double-render / strict mode)
      const seen = new Set<string>();
      const deduped: EmailHistoryItem[] = [];
      for (const e of emails) {
        if (!seen.has(e.id)) {
          seen.add(e.id);
          deduped.push(e);
        }
      }
      if (deduped.length !== emails.length) {
        console.log(`[EmailHistory] Deduplicated ${emails.length - deduped.length} duplicate entries`);
      }
      // Force a new array reference so React always re-renders even if contents are identical
      setHistory([...deduped]);
    } catch (error) {
      console.error('Failed to load email history:', error);
    }
  };

  const handleDelete = (email: EmailHistoryItem) => {
    const index = history.findIndex(h => h.id === email.id);
    const { scale: scaleAnim, opacity: opacityAnim } = animationMapRef.current[email.id] || {
      scale: new Animated.Value(1),
      opacity: new Animated.Value(1),
      swipeX: new Animated.Value(0),
    };

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      // Remove animation refs for this id so a future restore gets fresh values
      delete animationMapRef.current[email.id];
      await emailHistoryService.deleteEmail(email.id);
      setRecentlyDeleted({ item: email, index: index === -1 ? 0 : index });
      await loadHistory();
      setTimeout(() => setRecentlyDeleted(null), 6000);
    });
  };

  // Direct deletion helper (for swipe) with timeout management
  const deleteDirect = async (email: EmailHistoryItem) => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    const index = history.findIndex(h => h.id === email.id);
    delete animationMapRef.current[email.id];
    delete hapticTriggeredMapRef.current[email.id];
    await emailHistoryService.deleteEmail(email.id);
    setRecentlyDeleted({ item: email, index: index === -1 ? 0 : index });
    await loadHistory();
    undoTimeoutRef.current = setTimeout(() => {
      setRecentlyDeleted(null);
      undoTimeoutRef.current = null;
    }, 6000);
  };

  const handleUndo = async () => {
    if (!recentlyDeleted) return;
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    const restoredId = recentlyDeleted.item.id;
    setRecentlyDeleted(null);
    await emailHistoryService.restoreEmail(recentlyDeleted.item, recentlyDeleted.index);
    await loadHistory();
    setTimeout(() => {
      if (!animationMapRef.current[restoredId]) {
        animationMapRef.current[restoredId] = {
          scale: new Animated.Value(1),
          opacity: new Animated.Value(1),
          swipeX: new Animated.Value(0),
        };
      } else {
        animationMapRef.current[restoredId].scale.setValue(1);
        animationMapRef.current[restoredId].opacity.setValue(1);
        animationMapRef.current[restoredId].swipeX.setValue(0);
      }
    }, 50);
  };

  // Cleanup undo timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  // Absolute date-time formatting (e.g., "Jan 15, 2025 at 2:30 PM")
  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateStr} at ${timeStr}`;
  };

  const getInitials = (text: string) => {
    const words = text.split(' ').filter(w => w.length > 0);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        >
          <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.fullscreenPanel,
            {
              transform: [
                { translateX: slideAnim },
                { scale: panelScale },
              ],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Email History</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <Animated.ScrollView
            style={[styles.content, { opacity: contentOpacity, transform: [{ translateY: contentTranslate }] }]}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {history.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Text style={styles.emptyIcon}>📭</Text>
                </View>
                <Text style={styles.emptyText}>No Emails Sent Yet</Text>
                <Text style={styles.emptySubtext}>
                  Your sent closeout reports will appear here for easy access
                </Text>
              </View>
            ) : (
              <View style={styles.emailList}>
                {history.map((email, index) => {
                  // Diagnostic: log each render of a history card (remove after debugging)
                  try { console.log('[EmailHistory] render card', email.id); } catch {}
                  const timestamp = formatDateTime(email.timestamp);
                  const location = (email.summary && (email.summary.location || email.summary.work_order)) || 'Unknown Location';
                  const initials = getInitials(location);

                  if (!animationMapRef.current[email.id]) {
                    animationMapRef.current[email.id] = {
                      scale: new Animated.Value(1),
                      opacity: new Animated.Value(1),
                      swipeX: new Animated.Value(0),
                    };
                  }
                  const { scale: scaleAnim, opacity: opacityAnim, swipeX } = animationMapRef.current[email.id];

                  const SWIPE_THRESHOLD = 50; // Further reduced for easier deletion
                  const MIN_SWIPE_START = 8; // More forgiving swipe start

                  if (hapticTriggeredMapRef.current[email.id] === undefined) {
                    hapticTriggeredMapRef.current[email.id] = false;
                  }

                  const deleteProgress = swipeX.interpolate({
                    inputRange: [0, SWIPE_THRESHOLD, SCREEN_WIDTH * 0.5],
                    outputRange: [0, 0.7, 1],
                    extrapolate: 'clamp',
                  });
                  const deleteIconScale = swipeX.interpolate({
                    inputRange: [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD],
                    outputRange: [0, 0.8, 1],
                    extrapolate: 'clamp',
                  });
                  const deleteIconOpacity = swipeX.interpolate({
                    inputRange: [0, SWIPE_THRESHOLD * 0.6, SWIPE_THRESHOLD],
                    outputRange: [0, 0.5, 1],
                    extrapolate: 'clamp',
                  });

                  const panResponder = PanResponder.create({
                    onStartShouldSetPanResponder: () => false,
                    onMoveShouldSetPanResponder: (_evt, gesture) => {
                      const { dx, dy } = gesture;
                      const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.2; // more forgiving ratio
                      const exceedsMin = Math.abs(dx) > 3; // lower activation distance
                      return isHorizontal && exceedsMin;
                    },
                    onPanResponderTerminationRequest: () => false,
                    onPanResponderGrant: () => {
                      hapticTriggeredMapRef.current[email.id] = false;
                    },
                    onPanResponderMove: (_evt, gesture) => {
                      if (gesture.dx > 0) {
                        const clampedValue = Math.min(gesture.dx, SCREEN_WIDTH * 0.5);
                        swipeX.setValue(clampedValue);
                        if (gesture.dx >= SWIPE_THRESHOLD && !hapticTriggeredMapRef.current[email.id]) {
                          hapticTriggeredMapRef.current[email.id] = true;
                          try {
                            if (Platform.OS === 'ios' || Platform.OS === 'android') {
                              const Haptics = require('react-native').Vibration;
                              Haptics.vibrate(15);
                            }
                          } catch {}
                        }
                      }
                    },
                    onPanResponderRelease: (_evt, gesture) => {
                      hapticTriggeredMapRef.current[email.id] = false;
                      const fastSwipe = Math.abs(gesture.vx) > 0.5;
                      const exceededThreshold = gesture.dx > SWIPE_THRESHOLD;
                      const exceededMinimum = gesture.dx > MIN_SWIPE_START;
                      if ((exceededThreshold && exceededMinimum) || (fastSwipe && gesture.dx > 30)) {
                        Animated.timing(swipeX, {
                          toValue: SCREEN_WIDTH + 40,
                          duration: 250,
                          easing: Easing.out(Easing.cubic),
                          useNativeDriver: true,
                        }).start(() => deleteDirect(email));
                      } else {
                        Animated.spring(swipeX, {
                          toValue: 0,
                          useNativeDriver: true,
                          tension: 180,
                          friction: 22,
                          velocity: -gesture.vx * 0.5,
                        }).start();
                      }
                    },
                    onPanResponderTerminate: () => {
                      hapticTriggeredMapRef.current[email.id] = false;
                      Animated.spring(swipeX, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 180,
                        friction: 22,
                      }).start();
                    },
                  });

                  return (
                    <View key={email.id} style={styles.swipeContainer}>
                      <Animated.View
                        style={[styles.swipeUnderlay, { opacity: deleteProgress }]}
                      >
                        <Animated.View
                          style={[
                            styles.deleteIconContainer,
                            { transform: [{ scale: deleteIconScale }], opacity: deleteIconOpacity },
                          ]}
                        >
                          <Text style={styles.deleteIcon}>✕</Text>
                        </Animated.View>
                        <Animated.View style={{ opacity: deleteProgress }}>
                          <Text style={styles.swipeUnderlayText}>Release to Delete</Text>
                        </Animated.View>
                      </Animated.View>
                      <Animated.View
                        {...panResponder.panHandlers}
                        style={[
                          styles.emailCardCompact,
                          index === 0 && styles.emailCardFirst,
                          {
                            transform: [
                              { translateX: swipeX },
                              { scale: scaleAnim },
                            ],
                            opacity: opacityAnim,
                          },
                        ]}
                      >
                        <View style={styles.cardHeaderCompact}>
                          <View style={styles.avatarSmall}>
                            <Text style={styles.avatarText}>{initials}</Text>
                          </View>
                          <View style={styles.headerTextCompact}>
                            <Text style={styles.inlineTitle} numberOfLines={1}>
                              {location} • WO {email.workOrder || 'N/A'}
                            </Text>
                            <Text style={styles.timestamp}>{timestamp}</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            try { (onEmailSelect || onSelectEmail)?.(email); } catch (e) { console.warn('Email select failed', e); }
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={styles.recipientsRowCompact}>
                            <Text style={styles.recipientsLabel}>To:</Text>
                            <Text style={styles.recipientsText} numberOfLines={1}>
                              {email.recipients.join(', ')}
                            </Text>
                          </View>
                          {email.summary.work_completed && (
                            <Text style={styles.previewTextCompact} numberOfLines={2}>
                              {email.summary.work_completed}
                            </Text>
                          )}
                          <View style={styles.actionRowCompact}>
                            <Text style={styles.actionTextCompact}>Swipe right to delete • Tap to open</Text>
                          </View>
                        </TouchableOpacity>
                      </Animated.View>
                    </View>
                  );
                })}
              </View>
            )}
          </Animated.ScrollView>

          {/* Undo Bar - Now more prominent and always on top */}
          {recentlyDeleted && (
            <View style={styles.undoBar}>
              <TouchableOpacity onPress={handleUndo} style={styles.undoButton}>
                <Text style={styles.undoArrow}>↩</Text>
                <Text style={styles.undoText}>Restore deleted email</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setRecentlyDeleted(null)} style={styles.undoDismiss}>
                <Text style={styles.undoDismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdropTouchable: {
    flex: 1,
  },
  fullscreenPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#F8F9FA',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 50,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: '600',
  },

  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Extra padding for undo bar
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },

  // Email List
  emailList: {
    gap: 16,
  },
  emailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 16,
  },
  emailCardFirst: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  emailCardCompact: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    marginBottom: 14,
  },
  swipeContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  swipeUnderlay: {
    position: 'absolute',
    top: 0,
    bottom: 14, // Match spacing under card
    left: 0,
    right: 0,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    shadowColor: '#DC2626',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  deleteIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deleteIcon: { fontSize: 22 },
  swipeUnderlayText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Card Header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardHeaderCompact: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardHeaderText: {
    flex: 1,
    paddingTop: 2,
  },
  techName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    lineHeight: 22,
  },
  headerTextCompact: { flex: 1 },
  inlineTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 2 },
  timestamp: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  cardRightActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: 8,
    // Allow the delete button to sit inline with the badge without wrapping underneath
    flexShrink: 0,
  },
  workOrderBadge: {
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    maxWidth: 120,
    marginRight: 8,
    flexShrink: 1,
  },
  workOrderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
    // Prevent excessive vertical padding on Android
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    // Add slight elevation / shadow on supported platforms for clarity
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  recipientsRowCompact: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  previewTextCompact: { fontSize: 13, color: '#4B5563', lineHeight: 19, marginBottom: 10 },
  actionRowCompact: { paddingTop: 4, borderTopWidth: 1, borderTopColor: '#F1F2F4' },
  actionTextCompact: { fontSize: 11, color: '#6B7280', fontWeight: '500' },

  // Recipients Row
  recipientsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  recipientsLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    marginRight: 4,
  },
  recipientsText: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
    lineHeight: 20,
  },

  // Preview Text
  previewText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 21,
    marginBottom: 12,
  },

  // Action Row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionText: {
    fontSize: 13,
    color: '#FF6B35',
    fontWeight: '600',
  },
  actionArrow: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '700',
  },

  // Undo Bar - Redesigned for better visibility
  undoBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  undoArrow: {
    fontSize: 24,
    color: '#FF6B35',
    fontWeight: '700',
    marginRight: 12,
  },
  undoText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  undoDismiss: {
    marginLeft: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#374151',
  },
  undoDismissText: {
    color: '#F3F4F6',
    fontSize: 18,
    fontWeight: '700',
  },
});