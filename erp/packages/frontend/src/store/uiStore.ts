import { create } from 'zustand';

export interface Tab {
  id: string;         // unique tab id, e.g. "MRL-202604001" or "new-mrl"
  title: string;      // display title
  path: string;       // route path
  isDirty: boolean;   // unsaved changes?
  icon?: string;      // lucide icon name (optional)
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface UiState {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  tabs: Tab[];
  activeTabId: string | null;
  toasts: Toast[];

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  openTab: (tab: Omit<Tab, 'isDirty'>) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  setTabDirty: (id: string, dirty: boolean) => void;
  closeAllTabs: () => void;

  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const MAX_TABS = 8;

export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: false,
  sidebarWidth: 240,
  tabs: [],
  activeTabId: null,
  toasts: [],

  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  openTab: (tab) =>
    set((s) => {
      // If already open, just activate it
      const existing = s.tabs.find((t) => t.id === tab.id);
      if (existing) return { activeTabId: tab.id };

      let tabs = [...s.tabs, { ...tab, isDirty: false }];

      // Evict oldest non-dirty tab if over limit
      if (tabs.length > MAX_TABS) {
        const oldestClean = tabs.find((t) => !t.isDirty);
        if (oldestClean) {
          tabs = tabs.filter((t) => t.id !== oldestClean.id);
        } else {
          // All dirty — evict oldest anyway
          tabs = tabs.slice(1);
        }
      }

      return { tabs, activeTabId: tab.id };
    }),

  closeTab: (id) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      let activeTabId = s.activeTabId;
      if (activeTabId === id) {
        const idx = s.tabs.findIndex((t) => t.id === id);
        activeTabId = tabs[idx - 1]?.id ?? tabs[idx]?.id ?? null;
      }
      return { tabs, activeTabId };
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  setTabDirty: (id, dirty) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, isDirty: dirty } : t)),
    })),

  closeAllTabs: () => set({ tabs: [], activeTabId: null }),

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    const duration = toast.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => get().removeToast(id), duration);
    }
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
