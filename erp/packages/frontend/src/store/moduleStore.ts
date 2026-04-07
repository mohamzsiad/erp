import { create } from 'zustand';
import { MODULE_LABELS } from '@clouderp/shared';

export interface ModuleItem {
  id: string;
  label: string;
  enabled: boolean;
}

interface ModuleState {
  modules: ModuleItem[];
  setModules: (enabled: string[]) => void;
}

export const useModuleStore = create<ModuleState>((set) => ({
  modules: [],

  setModules: (enabled: string[]) => {
    const modules = Object.entries(MODULE_LABELS).map(([id, label]) => ({
      id,
      label: label as string,
      enabled: enabled.includes(id),
    }));
    set({ modules });
  },
}));
