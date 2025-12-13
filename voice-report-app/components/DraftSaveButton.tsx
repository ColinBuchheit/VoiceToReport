// voice-report-app/components/DraftSaveButton.tsx
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View, StyleSheet, ViewStyle, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import draftService, { DraftAttachment } from '../services/draftService';
import { CloseoutSummary } from '../types/aiAgent';
import { useTheme } from '../context/ThemeContext';
import { useFontScale } from '../context/FontScaleContext';

interface DraftSaveButtonProps {
  data: CloseoutSummary;
  draftId?: string;
  workOrder?: string;
  location?: string;
  transcription?: string;
  checklist?: Record<string, boolean>;
  attachments?: DraftAttachment[];
  onSaved?: (draftId: string) => void;
  style?: ViewStyle;
  compact?: boolean;
  disabled?: boolean;
  currentRoute?: 'Home' | 'Transcript' | 'Summary';
  requireNameOnFirstSave?: boolean;
}

export const DraftSaveButton: React.FC<DraftSaveButtonProps> = ({
  data,
  draftId,
  workOrder,
  location,
  transcription,
  checklist,
  attachments,
  onSaved,
  style,
  compact = false,
  disabled = false,
  currentRoute,
  requireNameOnFirstSave = true,
}) => {
  const { colors } = useTheme();
  const { scaled } = useFontScale();
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  // Build a sensible default title from Work Order and Location when available
  const buildDefaultTitle = () => {
    const wo = (workOrder || '').trim();
    const loc = (location || '').trim();
    const parts: string[] = [];
    if (wo) parts.push(`WO ${wo}`);
    if (loc) parts.push(loc);
    return parts.length ? parts.join(' – ') : undefined;
  };

  const handleSave = async () => {
    if (saving) return;
    // If this is the first save (no draftId) and a name is required, prompt for title
    const hasWOOrLoc = !!(workOrder?.trim() || location?.trim());
    if (!draftId && requireNameOnFirstSave && !hasWOOrLoc) {
      setShowNameModal(true);
      return;
    }
    setSaving(true);
    try {
      const defaultTitle = buildDefaultTitle();
      const draft = await draftService.addDraft({
        id: draftId,
        title: titleInput?.trim() ? titleInput.trim() : defaultTitle,
        workOrder,
        location,
        transcription,
        summary: data,
        lastSavedRoute: currentRoute,
        checklist,
        attachments,
        timestamp: new Date().toISOString(),
      });
      setLastSaved(new Date());
      // Brief visual confirmation state
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
      onSaved?.(draft.id);
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmNameAndSave = async () => {
    if (saving) return;
    setShowNameModal(false);
    setSaving(true);
    try {
      const defaultTitle = buildDefaultTitle();
      const draft = await draftService.addDraft({
        id: draftId,
        title: titleInput?.trim() ? titleInput.trim() : defaultTitle,
        workOrder,
        location,
        transcription,
        summary: data,
        lastSavedRoute: currentRoute,
        checklist,
        attachments,
        timestamp: new Date().toISOString(),
      });
      setLastSaved(new Date());
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
      onSaved?.(draft.id);
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setSaving(false);
    }
  };

  if (compact) {
    const disabledEffective = saving || disabled;
    const iconColor = disabledEffective ? colors.textSecondary : colors.accent;
    const borderColor = disabledEffective ? colors.border : colors.accent;
    return (
      <>
      <TouchableOpacity
        onPress={handleSave}
        disabled={disabledEffective}
        style={[
          styles.compactButton,
          { borderColor },
          style,
          disabledEffective && { opacity: 0.45 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={lastSaved ? 'Update Draft' : 'Save Draft'}
      >
        {saving ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : justSaved ? (
          <Ionicons name="checkmark-circle" size={scaled(20)} color="#10B981" />
        ) : (
          <Ionicons name="save-outline" size={scaled(20)} color={iconColor} />
        )}
      </TouchableOpacity>
      {showNameModal && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShowNameModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Name your draft</Text>
              <TextInput
                value={titleInput}
                onChangeText={setTitleInput}
                placeholder="Draft name"
                placeholderTextColor={colors.textSecondary}
                style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]}
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setShowNameModal(false)} style={[styles.modalBtn, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirmNameAndSave} style={[styles.modalBtnPrimary, { backgroundColor: colors.accent }]}>
                  <Text style={{ color: colors.accentContrast, fontWeight: '700' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      </>
    );
  }

  return (
    <>
    <TouchableOpacity
      onPress={handleSave}
      disabled={saving || disabled}
      style={[
        styles.fullButton,
        // Outline style for higher visibility
        {
          backgroundColor: 'transparent',
          borderColor: disabled ? colors.border : colors.accent,
          opacity: saving || disabled ? 0.5 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={lastSaved ? 'Update Draft' : 'Save Draft'}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {saving ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <>
            <Ionicons
              name={justSaved ? 'checkmark-circle' : 'save-outline'}
              size={scaled(18)}
              color={justSaved ? '#10B981' : (disabled ? colors.textSecondary : colors.accent)}
            />
            <Text
              style={[
                styles.fullButtonText,
                { color: justSaved ? '#10B981' : (disabled ? colors.textSecondary : colors.accent), fontSize: scaled(14) },
              ]}
            >
              {justSaved ? 'Saved' : (lastSaved ? 'Update Draft' : 'Save Draft')}
            </Text>
          </>
        )}
      </View>
      {lastSaved && !saving && !justSaved && (
        <Text style={[styles.lastSavedText, { color: colors.textSecondary, fontSize: scaled(10) }]}>
          Last saved {lastSaved.toLocaleTimeString()}
        </Text>
      )}
    </TouchableOpacity>
    {showNameModal && (
      <Modal transparent animationType="fade" visible onRequestClose={() => setShowNameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Name your draft</Text>
            <TextInput
              value={titleInput}
              onChangeText={setTitleInput}
              placeholder="Draft name"
              placeholderTextColor={colors.textSecondary}
              style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowNameModal(false)} style={[styles.modalBtn, { borderColor: colors.border }]}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirmNameAndSave} style={[styles.modalBtnPrimary, { backgroundColor: colors.accent }]}>
                <Text style={{ color: colors.accentContrast, fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    )}
    </>
  );
};

const styles = StyleSheet.create({
  compactButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 2,
  },
  fullButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    borderWidth: 2,
  },
  fullButtonText: {
    marginLeft: 8,
    fontWeight: '700',
  },
  lastSavedText: {
    marginTop: 2,
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalBtnPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
});

export default DraftSaveButton;
