import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useFontScale } from '../context/FontScaleContext';
import { useTheme } from '../context/ThemeContext';
import { useChecklist } from '../context/ChecklistContext';
import { criteriaCategories } from './checklistData';
import { useSettings } from '../context/SettingsContext';

interface ChecklistProps {
  contentPaddingBottom?: number;
}

export default function Checklist({ contentPaddingBottom = 0 }: ChecklistProps) {
  const { scaled } = useFontScale();
  const { colors } = useTheme();
  const { checkedItems, toggleItem } = useChecklist();
  const { showReportProgressBar } = useSettings();

  const totalItems = criteriaCategories.reduce((sum, cat) => sum + cat.items.length, 0);
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const requiredItems = criteriaCategories.flatMap(cat => cat.items.filter(item => item.required));
  const checkedRequiredCount = requiredItems.filter(item => checkedItems[item.id]).length;
  const progressPercent = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  return (
    <View style={{ flex: 1 }}>
      {/* Progress Summary (controlled by Settings) */}
      {showReportProgressBar && (
        <View style={[styles.progressSummary, { backgroundColor: colors.surfaceAlt, borderBottomColor: colors.border }]}>
          <View style={styles.progressInfo}>
            <Text style={[styles.progressTitle, { fontSize: scaled(16), color: colors.textPrimary }]}>Report Progress</Text>
            <Text style={[styles.progressDetails, { fontSize: scaled(13), color: colors.textSecondary }]}>
              {checkedRequiredCount}/{requiredItems.length} required • {checkedCount}/{totalItems} total
            </Text>
          </View>
          <View style={[styles.progressCircle, { backgroundColor: colors.accent }]}>
            <Text style={[styles.progressPercent, { color: colors.accentContrast }]}>{progressPercent}%</Text>
          </View>
        </View>
      )}

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.checklistContent, { paddingBottom: contentPaddingBottom }]}
      >
        {criteriaCategories.map((category) => {
          const categoryChecked = category.items.filter(item => checkedItems[item.id]).length;
          return (
            <View key={category.title} style={styles.categorySection}>
              <View style={[styles.categoryHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.categoryTitle, { fontSize: scaled(16), color: colors.textPrimary }]}>{category.title}</Text>
                <Text style={[styles.categoryProgress, { backgroundColor: colors.surfaceAlt, color: colors.textSecondary }]}>
                  {categoryChecked}/{category.items.length}
                </Text>
              </View>
              {category.items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.checklistItem, checkedItems[item.id] && styles.checklistItemChecked]}
                  onPress={() => toggleItem(item.id)}
                >
                  <View style={[styles.itemCheckbox, { borderColor: colors.border }]}>
                    {checkedItems[item.id] && <View style={[styles.checkmark, { backgroundColor: '#10B981' }]} />}
                  </View>
                  <View style={styles.itemContent}>
                    <View style={styles.itemLabelRow}>
                      <Text
                        style={[
                          styles.itemLabel,
                          { fontSize: scaled(15), color: colors.textPrimary },
                          checkedItems[item.id] && { textDecorationLine: 'line-through', color: colors.textSecondary },
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.required && <View style={[styles.requiredDot, { backgroundColor: '#EF4444' }]} />}
                    </View>
                    <Text style={[styles.itemHint, { fontSize: scaled(13), lineHeight: scaled(16), color: colors.textSecondary }]}>{item.hint}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  progressSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressInfo: { flex: 1 },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  progressDetails: { fontSize: 13, color: '#6B7280' },
  progressCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  checklistContent: {
    padding: 20,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  categoryProgress: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  checklistItemChecked: {
    opacity: 0.7,
  },
  itemCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#10B981',
  },
  itemContent: { flex: 1 },
  itemLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  itemLabel: { fontSize: 15, fontWeight: '500', color: '#1F2937', flex: 1 },
  requiredDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444', marginLeft: 8 },
  itemHint: { fontSize: 13, color: '#6B7280', lineHeight: 16 },
});
