import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';

export interface CriteriaItem {
  id: string;
  label: string;
  hint: string;
  required: boolean;
}

export interface CriteriaCategory {
  title: string;
  color: string;
  items: CriteriaItem[];
}

interface ChecklistContextValue {
  checkedItems: Record<string, boolean>;
  toggleItem: (id: string) => void;
  setChecked: (id: string, checked: boolean) => void;
  setAll: (items: Record<string, boolean>) => void;
  reset: () => void;
}

const ChecklistContext = createContext<ChecklistContextValue | undefined>(undefined);

export function ChecklistProvider({ children }: { children: ReactNode }) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const value = useMemo<ChecklistContextValue>(() => ({
    checkedItems,
    toggleItem: (id: string) => {
      setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
    },
    setChecked: (id: string, checked: boolean) => {
      setCheckedItems(prev => ({ ...prev, [id]: checked }));
    },
    setAll: (items: Record<string, boolean>) => {
      setCheckedItems(items || {});
    },
    reset: () => setCheckedItems({}),
  }), [checkedItems]);

  return (
    <ChecklistContext.Provider value={value}>{children}</ChecklistContext.Provider>
  );
}

export function useChecklist() {
  const ctx = useContext(ChecklistContext);
  if (!ctx) throw new Error('useChecklist must be used within a ChecklistProvider');
  return ctx;
}
