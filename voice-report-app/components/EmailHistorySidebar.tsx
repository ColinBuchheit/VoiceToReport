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
  const animationMapRef = useRef<Record<string, { scale: Animated.Value; opacity: Animated.Value }>>({});

  useEffect(() => {
    if (visible) {
      loadHistory();
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 10,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }).start();
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
      setHistory(deduped);
    } catch (error) {
      console.error('Failed to load email history:', error);
    }
  };

  const handleDelete = (email: EmailHistoryItem) => {
    const index = history.findIndex(h => h.id === email.id);
    const { scale: scaleAnim, opacity: opacityAnim } = animationMapRef.current[email.id] || {
      scale: new Animated.Value(1),
      opacity: new Animated.Value(1),
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

  const handleUndo = async () => {
    if (!recentlyDeleted) return;
    const restoredId = recentlyDeleted.item.id;
    await emailHistoryService.restoreEmail(recentlyDeleted.item, recentlyDeleted.index);
    setRecentlyDeleted(null);
    await loadHistory();
    // Ensure restored item is visible (fresh animation values)
    if (!animationMapRef.current[restoredId]) {
      animationMapRef.current[restoredId] = {
        scale: new Animated.Value(1),
        opacity: new Animated.Value(1),
      };
    } else {
      animationMapRef.current[restoredId].scale.setValue(1);
      animationMapRef.current[restoredId].opacity.setValue(1);
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
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
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <Animated.View
          style={[styles.fullscreenPanel, { transform: [{ translateX: slideAnim }] }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Email History</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
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

                  // Get or create animation values for this item
                  if (!animationMapRef.current[email.id]) {
                    animationMapRef.current[email.id] = {
                      scale: new Animated.Value(1),
                      opacity: new Animated.Value(1),
                    };
                  }
                  const { scale: scaleAnim, opacity: opacityAnim } = animationMapRef.current[email.id];

                  return (
                    <Animated.View
                      key={email.id}
                      style={[
                        styles.emailCard,
                        index === 0 && styles.emailCardFirst,
                        { transform: [{ scale: scaleAnim }], opacity: opacityAnim }
                      ]}
                    >
                      {/* Avatar and Header Row */}
                      <View style={styles.cardHeader}>
                        <View style={styles.avatarContainer}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{initials}</Text>
                          </View>
                          <View style={styles.cardHeaderText}>
                            <Text style={styles.techName} numberOfLines={2}>
                              {location}
                            </Text>
                            <Text style={styles.timestamp}>{timestamp}</Text>
                          </View>
                        </View>
                        <View style={styles.cardRightActions}>
                          <View style={styles.workOrderBadge}>
                            <Text style={styles.workOrderText}>
                              {`WO ${email.workOrder || 'N/A'}`}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleDelete(email)}
                            style={styles.deleteButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Text style={styles.deleteButtonText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Main Content - Touchable */}
                      <TouchableOpacity
                        onPress={() => {
                          // Fire selection callback then close sidebar so Summary shows in foreground
                          try { (onEmailSelect || onSelectEmail)?.(email); } catch (e) { console.warn('Email select failed', e); }
                          onClose();
                        }}
                        activeOpacity={0.7}
                      >
                        {/* Recipients */}
                        <View style={styles.recipientsRow}>
                          <Text style={styles.recipientsLabel}>To: </Text>
                          <Text style={styles.recipientsText} numberOfLines={2}>
                            {email.recipients.join(', ')}
                          </Text>
                        </View>

                        {/* Work Preview */}
                        {email.summary.work_completed && (
                          <Text style={styles.previewText} numberOfLines={3}>
                            {email.summary.work_completed}
                          </Text>
                        )}

                        {/* Action Indicator */}
                        <View style={styles.actionRow}>
                          <Text style={styles.actionText}>Tap to view details</Text>
                          <Text style={styles.actionArrow}>→</Text>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </ScrollView>

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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  fullscreenPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#F8F9FA',
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

  // Card Header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
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
  timestamp: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  cardRightActions: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 8,
  },
  workOrderBadge: {
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    maxWidth: 100,
  },
  workOrderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonText: {
    fontSize: 18,
  },

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