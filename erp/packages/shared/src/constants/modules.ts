export const MODULES = {
  CORE: 'CORE',
  PROCUREMENT: 'PROCUREMENT',
  INVENTORY: 'INVENTORY',
  FINANCE: 'FINANCE',
} as const;

export type Module = (typeof MODULES)[keyof typeof MODULES];

export const MODULE_LABELS: Record<Module, string> = {
  CORE: 'Core',
  PROCUREMENT: 'Procurement',
  INVENTORY: 'Inventory',
  FINANCE: 'Finance',
};

export const MODULE_DEPENDENCIES: Record<Module, Module[]> = {
  CORE: [],
  PROCUREMENT: [],
  INVENTORY: [],
  FINANCE: ['INVENTORY', 'PROCUREMENT'],
};
