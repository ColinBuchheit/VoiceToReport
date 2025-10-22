// voice-report-app/components/DraftSaveButton.tsx
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import draftService from '../services/draftService';
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
  onSaved?: (draftId: string) => void;
  style?: ViewStyle;
  compact?: boolean;
  disabled?: boolean;
  currentRoute?: 'Home' | 'Transcript' | 'Summary';
}

export const DraftSaveButton: React.FC<DraftSaveButtonProps> = ({
  data,
  draftId,
  workOrder,
  location,
  transcription,
  checklist,
  onSaved,
  style,
  compact = false,
  disabled = false,
  currentRoute,
}) => {
  const { colors } = useTheme();
  const { scaled } = useFontScale();
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const draft = await draftService.addDraft({
        id: draftId,
        workOrder,
        location,
        transcription,
        summary: data,
        lastSavedRoute: currentRoute,
        checklist,
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

  if (compact) {
    return (
      <TouchableOpacity
        onPress={handleSave}
        disabled={saving || disabled}
        style={[
          styles.compactButton,
          { borderColor: colors.accent },
          style,
          (saving || disabled) && { opacity: 0.7 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={lastSaved ? 'Update Draft' : 'Save Draft'}
      >
        {saving ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : justSaved ? (
          <Ionicons name="checkmark-circle" size={scaled(20)} color="#10B981" />
        ) : (
          <Ionicons name="save-outline" size={scaled(20)} color={colors.accent} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleSave}
      disabled={saving || disabled}
      style={[
        styles.fullButton,
        // Outline style for higher visibility
        { backgroundColor: 'transparent', borderColor: colors.accent, opacity: saving || disabled ? 0.7 : 1 },
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
            <Ionicons name={justSaved ? 'checkmark-circle' : 'save-outline'} size={scaled(18)} color={justSaved ? '#10B981' : colors.accent} />
            <Text style={[styles.fullButtonText, { color: justSaved ? '#10B981' : colors.accent, fontSize: scaled(14) }]}>
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
});

export default DraftSaveButton;
