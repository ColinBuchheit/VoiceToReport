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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmailHistoryItem } from '../services/emailHistoryService';
// import emailHistoryService if it is the default export
import emailHistoryService from '../services/emailHistoryService';
import draftService, { DraftItem } from '../services/draftService';
import { useTheme } from '../context/ThemeContext';

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
  const { colors, isDark } = useTheme();
  const [history, setHistory] = useState<EmailHistoryItem[]>([]);
  const [grouped, setGrouped] = useState<{
    key: string;
    title: string;
    items: EmailHistoryItem[];
  }[]>([]);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [mode, setMode] = useState<'sent' | 'drafts'>('sent');
  const [timeRange, setTimeRange] = useState<'recent' | 'week' | 'all'>('recent');
  const [search, setSearch] = useState('');
  const [compact, setCompact] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [recentlyDeleted, setRecentlyDeleted] = useState<{ item: EmailHistoryItem; index: number } | null>(null);
  const [recentlyDeletedDraft, setRecentlyDeletedDraft] = useState<{ item: DraftItem } | null>(null);
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
      const [emails, draftList] = await Promise.all([
        emailHistoryService.getEmailHistory(),
        draftService.getDrafts(),
      ]);
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
      // Sort newest first
      const sorted = [...deduped].sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return (isFinite(tb) ? tb : 0) - (isFinite(ta) ? ta : 0);
      });

      // Force a new array reference so React always re-renders even if contents are identical
  setHistory([...sorted]);
  setDrafts(draftList || []);

      // Build 'Recent' group (top 3) and exclude those from weekly buckets
      const recent = sorted.slice(0, 3);
      const recentIds = new Set(recent.map(r => r.id));
      const remainder = sorted.filter(e => !recentIds.has(e.id));

      const weekly = groupByWeekBuckets(remainder);
  const groups = [
        ...(recent.length ? [{ key: 'recent', title: 'Recent', items: recent }] : []),
        ...weekly,
      ];
      setGrouped(groups);
      // Initialize collapsed state for new keys
      setCollapsedGroups(prev => {
        const next = { ...prev };
        for (const g of groups) {
          if (next[g.key] === undefined) next[g.key] = false; // default expanded
        }
        return next;
      });
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

  // Swipe-to-delete for Drafts
  const deleteDraftDirect = async (draft: DraftItem) => {
    try {
      // Clear any lingering animation state for this draft so a restore is clean
      if (animationMapRef.current[draft.id]) {
        delete animationMapRef.current[draft.id];
      }
      if (hapticTriggeredMapRef.current[draft.id] !== undefined) {
        delete hapticTriggeredMapRef.current[draft.id];
      }
      await draftService.deleteDraft(draft.id);
      setRecentlyDeletedDraft({ item: draft });
      await loadHistory();
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = null;
      }
      undoTimeoutRef.current = setTimeout(() => {
        setRecentlyDeletedDraft(null);
        undoTimeoutRef.current = null;
      }, 6000);
    } catch (e) {
      console.warn('Failed to delete draft', e);
    }
  };

  const handleUndoDraft = async () => {
    if (!recentlyDeletedDraft) return;
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    const d = recentlyDeletedDraft.item;
    setRecentlyDeletedDraft(null);
    try {
      // Re-add the draft with same id/timestamp to restore
      await draftService.addDraft({
        id: d.id,
        timestamp: d.timestamp,
        workOrder: d.workOrder,
        location: d.location,
        transcription: d.transcription,
        summary: d.summary,
      });
      await loadHistory();
      // Ensure fresh animation values for this restored draft
      setTimeout(() => {
        if (!animationMapRef.current[d.id]) {
          animationMapRef.current[d.id] = {
            scale: new Animated.Value(1),
            opacity: new Animated.Value(1),
            swipeX: new Animated.Value(0),
          };
        } else {
          animationMapRef.current[d.id].scale.setValue(1);
          animationMapRef.current[d.id].opacity.setValue(1);
          animationMapRef.current[d.id].swipeX.setValue(0);
        }
      }, 50);
    } catch (e) {
      console.warn('Failed to restore draft', e);
    }
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

  // Helpers for grouping by week buckets
  const startOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay(); // 0 Sun - 6 Sat
    const diff = (day === 0 ? -6 : 1) - day; // make Monday the start
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const sameWeek = (a: Date, b: Date) => startOfWeek(a).getTime() === startOfWeek(b).getTime();

  const groupByWeekBuckets = (items: EmailHistoryItem[]) => {
    const now = new Date();
    const thisWeekStart = startOfWeek(now);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setMilliseconds(-1); // end of last week

    const buckets: Record<string, { title: string; items: EmailHistoryItem[] }> = {
      this_week: { title: 'This Week', items: [] },
      last_week: { title: 'Last Week', items: [] },
      older: { title: 'Older', items: [] },
    };

    for (const item of items) {
      const t = new Date(item.timestamp);
      if (sameWeek(t, now)) buckets.this_week.items.push(item);
      else if (t >= lastWeekStart && t <= lastWeekEnd) buckets.last_week.items.push(item);
      else buckets.older.items.push(item);
    }

    // Remove empty groups, keep order
    const out: { key: string; title: string; items: EmailHistoryItem[] }[] = [];
    if (buckets.this_week.items.length) out.push({ key: 'this_week', title: 'This Week', items: buckets.this_week.items });
    if (buckets.last_week.items.length) out.push({ key: 'last_week', title: 'Last Week', items: buckets.last_week.items });
    if (buckets.older.items.length) out.push({ key: 'older', title: 'Older', items: buckets.older.items });
    return out;
  };

  // Basic search filter for sent emails
  const filterMatchEmail = (
    email: EmailHistoryItem,
    term: string,
    _timeRange: 'recent' | 'week' | 'all'
  ) => {
    if (!term) return true;
    const q = term.toLowerCase();
    const loc = ((email.summary as any)?.location || (email.summary as any)?.work_order || '').toString().toLowerCase();
    const wo = (email.workOrder || '').toString().toLowerCase();
    const recips = (email.recipients || []).join(', ').toLowerCase();
    const body = ((email.summary as any)?.work_completed || '').toString().toLowerCase();
    return loc.includes(q) || wo.includes(q) || recips.includes(q) || body.includes(q);
  };

  // Basic search filter for drafts
  const filterMatchDraft = (draft: DraftItem, term: string) => {
    if (!term) return true;
    const q = term.toLowerCase();
    const loc = (draft.location || '').toLowerCase();
    const wo = (draft.workOrder || '').toLowerCase();
    const body = (draft.summary?.work_completed || draft.transcription || '').toLowerCase();
    return loc.includes(q) || wo.includes(q) || body.includes(q);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity, backgroundColor: colors.overlay }]}
        >
          <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.fullscreenPanel,
            { backgroundColor: colors.background },
            {
              transform: [
                { translateX: slideAnim },
                { scale: panelScale },
              ],
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>History</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <Animated.ScrollView
            style={[styles.content, { opacity: contentOpacity, transform: [{ translateY: contentTranslate }] }]}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Controls: Mode, Range, Search, Compact */}
            <View style={styles.controlsRow}>
              <View
                style={[
                  styles.segment,
                  { backgroundColor: isDark ? colors.surfaceAlt : '#F1F2F4', borderWidth: 1, borderColor: isDark ? colors.border : '#E5E7EB' },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    mode === 'sent' && (isDark
                      ? { backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.accent }
                      : styles.segmentBtnActive),
                  ]}
                  onPress={() => setMode('sent')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      mode === 'sent' && (isDark ? { color: colors.accentContrast } : styles.segmentTextActive),
                    ]}
                  >
                    Sent
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    mode === 'drafts' && (isDark
                      ? { backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.accent }
                      : styles.segmentBtnActive),
                  ]}
                  onPress={() => setMode('drafts')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      mode === 'drafts' && (isDark ? { color: colors.accentContrast } : styles.segmentTextActive),
                    ]}
                  >
                    Drafts
                  </Text>
                </TouchableOpacity>
              </View>
              <View
                style={[
                  styles.segmentSmall,
                  { backgroundColor: isDark ? colors.surfaceAlt : '#F1F2F4', borderWidth: 1, borderColor: isDark ? colors.border : '#E5E7EB' },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.segmentBtnSmall,
                    timeRange === 'recent' && (isDark
                      ? { backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.accent }
                      : styles.segmentBtnSmallActive),
                  ]}
                  onPress={() => setTimeRange('recent')}
                >
                  <Text
                    style={[
                      styles.segmentTextSmall,
                      timeRange === 'recent' && (isDark ? { color: colors.accentContrast } : styles.segmentTextSmallActive),
                    ]}
                  >
                    Recent
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentBtnSmall,
                    timeRange === 'week' && (isDark
                      ? { backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.accent }
                      : styles.segmentBtnSmallActive),
                  ]}
                  onPress={() => setTimeRange('week')}
                >
                  <Text
                    style={[
                      styles.segmentTextSmall,
                      timeRange === 'week' && (isDark ? { color: colors.accentContrast } : styles.segmentTextSmallActive),
                    ]}
                  >
                    This Week
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentBtnSmall,
                    timeRange === 'all' && (isDark
                      ? { backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.accent }
                      : styles.segmentBtnSmallActive),
                  ]}
                  onPress={() => setTimeRange('all')}
                >
                  <Text
                    style={[
                      styles.segmentTextSmall,
                      timeRange === 'all' && (isDark ? { color: colors.accentContrast } : styles.segmentTextSmallActive),
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.controlsRow}>
              <View
                style={[
                  styles.searchBox,
                  { backgroundColor: isDark ? colors.surfaceAlt : '#F1F2F4', borderColor: colors.border },
                ]}
              >
                <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search WO, location, recipient"
                  placeholderTextColor={colors.textSecondary}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.compactToggle,
                  isDark && { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                  compact && (isDark ? { backgroundColor: colors.accent, borderColor: colors.accent } : styles.compactToggleActive),
                ]}
                onPress={() => {
                  setCompact(prev => {
                    const next = !prev;
                    if (next) setExpandedRows({});
                    return next;
                  });
                }}
              >
                <Text
                  style={[
                    styles.compactToggleText,
                    compact && isDark ? { color: colors.accentContrast } : { color: colors.textPrimary },
                  ]}
                >
                  {compact ? 'Compact' : 'Expanded'}
                </Text>
              </TouchableOpacity>
            </View>
            {(mode === 'sent' ? history.length === 0 : drafts.length === 0) ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="mail-open" size={36} color={colors.textSecondary} />
                </View>
                <Text style={[styles.emptyText, { color: colors.textPrimary }]}>
                  {mode === 'sent' ? 'No Emails Sent Yet' : 'No Drafts'}
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }] }>
                  {mode === 'sent' ? 'Your sent closeout reports will appear here for easy access' : 'Save drafts from the Summary screen to finish later'}
                </Text>
              </View>
            ) : (
              <View style={styles.emailList}>
                {mode === 'drafts' ? (
                  drafts
                    .filter(d => filterMatchDraft(d, search))
                    .map((draft, index) => {
                      // Ensure animation refs for this draft id
                      if (!animationMapRef.current[draft.id]) {
                        animationMapRef.current[draft.id] = {
                          scale: new Animated.Value(1),
                          opacity: new Animated.Value(1),
                          swipeX: new Animated.Value(0),
                        };
                      }
                      const { scale: scaleAnim, opacity: opacityAnim, swipeX } = animationMapRef.current[draft.id];
                      const SWIPE_THRESHOLD = 50;
                      const MIN_SWIPE_START = 8;

                      if (hapticTriggeredMapRef.current[draft.id] === undefined) {
                        hapticTriggeredMapRef.current[draft.id] = false;
                      }

                      const deleteProgress = swipeX.interpolate({
                        inputRange: [-SCREEN_WIDTH * 0.5, -SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD, SCREEN_WIDTH * 0.5],
                        outputRange: [1, 0.7, 0, 0.7, 1],
                        extrapolate: 'clamp',
                      });
                      const deleteIconScale = swipeX.interpolate({
                        inputRange: [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.5, 0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD],
                        outputRange: [1, 0.8, 0, 0.8, 1],
                        extrapolate: 'clamp',
                      });
                      const deleteIconOpacity = swipeX.interpolate({
                        inputRange: [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.6, 0, SWIPE_THRESHOLD * 0.6, SWIPE_THRESHOLD],
                        outputRange: [1, 0.5, 0, 0.5, 1],
                        extrapolate: 'clamp',
                      });

                      const panResponder = PanResponder.create({
                        onStartShouldSetPanResponder: () => false,
                        onMoveShouldSetPanResponderCapture: (_evt, gesture) => {
                          const { dx, dy } = gesture;
                          const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
                          const exceedsMin = Math.abs(dx) > 3;
                          return isHorizontal && exceedsMin;
                        },
                        onMoveShouldSetPanResponder: (_evt, gesture) => {
                          const { dx, dy } = gesture;
                          const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
                          const exceedsMin = Math.abs(dx) > 3;
                          return isHorizontal && exceedsMin;
                        },
                        onPanResponderTerminationRequest: () => false,
                        onPanResponderGrant: () => {
                          hapticTriggeredMapRef.current[draft.id] = false;
                        },
                        onPanResponderMove: (_evt, gesture) => {
                          const dir = Math.sign(gesture.dx || 0);
                          if (dir !== 0) {
                            const max = SCREEN_WIDTH * 0.5;
                            const clampedValue = Math.max(-max, Math.min(gesture.dx, max));
                            swipeX.setValue(clampedValue);
                            if (Math.abs(gesture.dx) >= SWIPE_THRESHOLD && !hapticTriggeredMapRef.current[draft.id]) {
                              hapticTriggeredMapRef.current[draft.id] = true;
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
                          hapticTriggeredMapRef.current[draft.id] = false;
                          const fastSwipe = Math.abs(gesture.vx) > 0.5;
                          const exceededThreshold = Math.abs(gesture.dx) > SWIPE_THRESHOLD;
                          const exceededMinimum = Math.abs(gesture.dx) > MIN_SWIPE_START;
                          if ((exceededThreshold && exceededMinimum) || (fastSwipe && Math.abs(gesture.dx) > 30)) {
                            const offscreen = (gesture.dx >= 0 ? SCREEN_WIDTH : -SCREEN_WIDTH) + (gesture.dx >= 0 ? 40 : -40);
                            Animated.timing(swipeX, {
                              toValue: offscreen,
                              duration: 250,
                              easing: Easing.out(Easing.cubic),
                              useNativeDriver: true,
                            }).start(() => deleteDraftDirect(draft));
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
                          hapticTriggeredMapRef.current[draft.id] = false;
                          Animated.spring(swipeX, {
                            toValue: 0,
                            useNativeDriver: true,
                            tension: 180,
                            friction: 22,
                          }).start();
                        },
                      });

                      return (
                        <View key={draft.id} style={styles.swipeContainer}>
                          <Animated.View style={[styles.swipeUnderlay, { opacity: deleteProgress }]}>
                            <Animated.View style={[styles.deleteIconContainer, { transform: [{ scale: deleteIconScale }], opacity: deleteIconOpacity }]}>
                              <Text style={styles.deleteIcon}>✕</Text>
                            </Animated.View>
                            <Animated.View style={{ opacity: deleteProgress }}>
                              <Text style={styles.swipeUnderlayText}>Release to Delete</Text>
                            </Animated.View>
                          </Animated.View>

                          <Animated.View
                            {...panResponder.panHandlers}
                            style={[
                              styles.emailRow,
                              index === 0 && styles.emailRowFirst,
                              { backgroundColor: colors.surface, borderColor: colors.border },
                              {
                                transform: [
                                  { translateX: swipeX },
                                  { scale: scaleAnim },
                                ],
                                opacity: opacityAnim,
                              },
                            ]}
                          >
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() => {
                                // Open as Summary with draft payload
                                try { (onEmailSelect || onSelectEmail)?.({
                                  id: draft.id,
                                  timestamp: draft.timestamp,
                                  recipients: [],
                                  workOrder: draft.workOrder,
                                  transcription: draft.transcription,
                                  summary: draft.summary as any,
                                  rawBody: undefined,
                                  _isDraft: true,
                                  _draftId: draft.id,
                                } as any); } catch {}
                              }}
                            >
                              <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                                {draft.location || 'Unknown Location'} • WO {draft.workOrder || 'N/A'}
                              </Text>
                              <Text style={[styles.rowMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                                Draft • {formatDateTime(draft.timestamp)}
                              </Text>
                            </TouchableOpacity>
                          </Animated.View>
                        </View>
                      );
                    })
                ) : (
                  // Filter groups by selected timeRange
                  grouped
                    .filter(g =>
                      timeRange === 'all'
                        ? true
                        : timeRange === 'recent'
                        ? g.key === 'recent'
                        : (g.key === 'this_week' || g.key === 'recent')
                    )
                    .map((group) => (
                  <View key={group.key} style={styles.groupSection}>
                    <TouchableOpacity
                      style={[styles.groupHeader, { borderBottomColor: colors.border }]}
                      onPress={() => setCollapsedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>{group.title}</Text>
                      <View style={styles.groupRight}>
                        <Text style={[styles.groupCount, { color: colors.textSecondary }]}>{group.items.length}</Text>
                        <Ionicons name={collapsedGroups[group.key] ? 'chevron-forward' : 'chevron-down'} size={16} color={colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                    {!collapsedGroups[group.key] && group.items
                      .filter(email => filterMatchEmail(email, search, timeRange))
                      .map((email, index) => {
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
                    inputRange: [-SCREEN_WIDTH * 0.5, -SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD, SCREEN_WIDTH * 0.5],
                    outputRange: [1, 0.7, 0, 0.7, 1],
                    extrapolate: 'clamp',
                  });
                  const deleteIconScale = swipeX.interpolate({
                    inputRange: [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.5, 0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD],
                    outputRange: [1, 0.8, 0, 0.8, 1],
                    extrapolate: 'clamp',
                  });
                  const deleteIconOpacity = swipeX.interpolate({
                    inputRange: [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.6, 0, SWIPE_THRESHOLD * 0.6, SWIPE_THRESHOLD],
                    outputRange: [1, 0.5, 0, 0.5, 1],
                    extrapolate: 'clamp',
                  });

                  const panResponder = PanResponder.create({
                    onStartShouldSetPanResponder: () => false,
                    onMoveShouldSetPanResponderCapture: (_evt, gesture) => {
                      const { dx, dy } = gesture;
                      const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.2; // more forgiving ratio
                      const exceedsMin = Math.abs(dx) > 3; // lower activation distance
                      return isHorizontal && exceedsMin;
                    },
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
                      const dir = Math.sign(gesture.dx || 0);
                      if (dir !== 0) {
                        const max = SCREEN_WIDTH * 0.5;
                        const clampedValue = Math.max(-max, Math.min(gesture.dx, max));
                        swipeX.setValue(clampedValue);
                        if (Math.abs(gesture.dx) >= SWIPE_THRESHOLD && !hapticTriggeredMapRef.current[email.id]) {
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
                      const exceededThreshold = Math.abs(gesture.dx) > SWIPE_THRESHOLD;
                      const exceededMinimum = Math.abs(gesture.dx) > MIN_SWIPE_START;
                      if ((exceededThreshold && exceededMinimum) || (fastSwipe && Math.abs(gesture.dx) > 30)) {
                        const offscreen = (gesture.dx >= 0 ? SCREEN_WIDTH : -SCREEN_WIDTH) + (gesture.dx >= 0 ? 40 : -40);
                        Animated.timing(swipeX, {
                          toValue: offscreen,
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

                  const isExpanded = !!expandedRows[email.id] || !compact;
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
                          styles.emailRow,
                          index === 0 && styles.emailRowFirst,
                          { backgroundColor: colors.surface, borderColor: colors.border },
                          {
                            transform: [
                              { translateX: swipeX },
                              { scale: scaleAnim },
                            ],
                            opacity: opacityAnim,
                          },
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.rowTop}
                          activeOpacity={0.7}
                          onPress={() => setExpandedRows(prev => ({ ...prev, [email.id]: !prev[email.id] }))}
                        >
                          <View style={[styles.avatarSmall, { backgroundColor: colors.accent }]}>
                            <Text style={[styles.avatarText, { color: colors.accentContrast }]}>{initials}</Text>
                          </View>
                          <View style={styles.rowMain}>
                            <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                              {location} • WO {email.workOrder || 'N/A'}
                            </Text>
                            <Text style={[styles.rowMeta, { color: colors.textSecondary }]} numberOfLines={1}>{timestamp}</Text>
                          </View>
                          <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                        {isExpanded && (
                          <TouchableOpacity
                            onPress={() => {
                              try { (onEmailSelect || onSelectEmail)?.(email); } catch (e) { console.warn('Email select failed', e); }
                            }}
                            activeOpacity={0.85}
                          >
                            <View style={styles.rowExpandedSection}>
                              <View style={styles.recipientsRowCompact}>
                                <Text style={[styles.recipientsLabel, { color: colors.textSecondary }]}>To:</Text>
                                <Text style={[styles.recipientsText, { color: colors.textPrimary }]} numberOfLines={1}>
                                  {email.recipients.join(', ')}
                                </Text>
                              </View>
                              {email.summary.work_completed && (
                                <Text style={[styles.previewTextCompact, { color: colors.textSecondary }]} numberOfLines={3}>
                                  {email.summary.work_completed}
                                </Text>
                              )}
                              <View style={styles.actionRowCompact}>
                                <Text style={[styles.actionTextCompact, { color: colors.textSecondary }]}>Swipe right to delete • Tap for details</Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        )}
                      </Animated.View>
                    </View>
                  );
                })}
                  </View>
                ))
                )}
              </View>
            )}
          </Animated.ScrollView>

          {/* Undo Bar - Shows for sent deletions or draft deletions */}
          {(recentlyDeleted || recentlyDeletedDraft) && (
            <View style={[styles.undoBar, { backgroundColor: colors.surfaceAlt, borderColor: colors.accent }]}>
              <TouchableOpacity onPress={recentlyDeleted ? handleUndo : handleUndoDraft} style={styles.undoButton}>
                <Ionicons name="return-down-back" size={24} color={colors.accent} style={{ marginRight: 12 }} />
                <Text style={[styles.undoText, { color: colors.textPrimary }]}>
                  {recentlyDeleted ? 'Restore deleted email' : 'Restore deleted draft'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setRecentlyDeleted(null); setRecentlyDeletedDraft(null); }} style={[styles.undoDismiss, { backgroundColor: colors.surface }] }>
                <Text style={[styles.undoDismissText, { color: colors.textSecondary }]}>Dismiss</Text>
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
  // New compact grouping + row styles
  groupSection: {
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  groupRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupCount: {
    fontSize: 12,
    marginRight: 8,
  },
  groupChevron: {
    fontSize: 16,
  },
  emailRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  emailRowFirst: {
    // subtle accent for first item
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B35',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowMain: {
    flex: 1,
    marginLeft: 10,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowMeta: {
    fontSize: 12,
  },
  expandIcon: {
    fontSize: 18,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  rowExpandedSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  // Controls
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#F1F2F4',
    borderRadius: 10,
    padding: 4,
    gap: 6,
  },
  segmentBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  segmentBtnActive: {
    backgroundColor: '#FFEDE5',
    borderWidth: 1,
    borderColor: '#FFDBC9',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  segmentTextActive: {
    color: '#111827',
  },
  segmentSmall: {
    flexDirection: 'row',
    backgroundColor: '#F1F2F4',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segmentBtnSmall: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  segmentBtnSmallActive: {
    backgroundColor: '#FFEDE5',
    borderWidth: 1,
    borderColor: '#FFDBC9',
  },
  segmentTextSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  segmentTextSmallActive: {
    color: '#7A2E0E',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: '#F1F2F4',
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: { fontSize: 16, marginRight: 6 },
  searchInput: {
    flex: 1,
    height: 36,
    fontSize: 14,
  },
  compactToggle: {
    marginLeft: 10,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFDBC9',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEDE5',
  },
  compactToggleActive: {
    backgroundColor: '#FFDECC',
    borderColor: '#FFCBB0',
  },
  compactToggleText: { fontSize: 13, fontWeight: '600' },
});