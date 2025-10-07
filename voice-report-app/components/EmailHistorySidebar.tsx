// voice-report-app/components/EmailHistorySidebar.tsx
import React, { useState, useEffect, JSX } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import emailHistoryService, { EmailHistoryItem } from '../services/emailHistoryService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

interface Props {
  visible: boolean;
  onClose: () => void;
  onEmailSelect: (email: EmailHistoryItem) => void;
}

export default function EmailHistorySidebar({ visible, onClose, onEmailSelect }: Props): JSX.Element {
  const [slideAnim] = useState(new Animated.Value(SCREEN_WIDTH));
  const [history, setHistory] = useState<EmailHistoryItem[]>([]);

  useEffect(() => {
    if (visible) {
      loadHistory();
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const loadHistory = async () => {
    const emails = await emailHistoryService.getEmailHistory();
    setHistory(emails);
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();

    if (isToday) {
      return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else if (isYesterday) {
      return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  };

  const getInitials = (name: string) => {
    if (!name || name === 'Unknown') return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar backgroundColor="rgba(0, 0, 0, 0.5)" barStyle="light-content" />
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.fullscreenPanel,
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
          {/* Header with Close Button */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Email History</Text>
              <Text style={styles.headerSubtitle}>
                {history.length} {history.length === 1 ? 'email' : 'emails'} sent
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <View style={styles.closeIconContainer}>
                <Text style={styles.closeIcon}>✕</Text>
              </View>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.scrollView}
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
                  const timestamp = formatDateTime(email.timestamp);
                  const initials = getInitials(email.technicianName || 'Unknown');
                  
                  return (
                    <TouchableOpacity
                      key={email.id}
                      style={[
                        styles.emailCard,
                        index === 0 && styles.emailCardFirst
                      ]}
                      onPress={() => {
                        onEmailSelect(email);
                        onClose();
                      }}
                      activeOpacity={0.7}
                    >
                      {/* Avatar and Header Row */}
                      <View style={styles.cardHeader}>
                        <View style={styles.avatarContainer}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{initials}</Text>
                          </View>
                          <View style={styles.cardHeaderText}>
                            <Text style={styles.techName} numberOfLines={1}>
                              {email.technicianName || 'Unknown Technician'}
                            </Text>
                            <Text style={styles.timestamp}>{timestamp}</Text>
                          </View>
                        </View>
                        <View style={styles.workOrderBadge}>
                          <Text style={styles.workOrderText}>
                            {email.workOrder || 'N/A'}
                          </Text>
                        </View>
                      </View>

                      {/* Recipients */}
                      <View style={styles.recipientsRow}>
                        <Text style={styles.recipientsLabel}>To: </Text>
                        <Text style={styles.recipientsText} numberOfLines={1}>
                          {email.recipients.join(', ')}
                        </Text>
                      </View>

                      {/* Work Preview */}
                      {email.summary.work_completed && (
                        <Text style={styles.previewText} numberOfLines={2}>
                          {email.summary.work_completed}
                        </Text>
                      )}

                      {/* Action Indicator */}
                      <View style={styles.actionRow}>
                        <Text style={styles.actionText}>Tap to view details</Text>
                        <Text style={styles.actionArrow}>→</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
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
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 50,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  closeButton: {
    alignItems: 'center',
    paddingLeft: 16,
  },
  closeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  closeIcon: {
    fontSize: 20,
    color: '#4B5563',
    fontWeight: '600',
  },
  closeText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  
  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIcon: {
    fontSize: 56,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
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
    alignItems: 'center',
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
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardHeaderText: {
    flex: 1,
  },
  techName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  workOrderBadge: {
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  workOrderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
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
  },
  recipientsText: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
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
});