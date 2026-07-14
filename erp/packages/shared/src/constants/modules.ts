export const MODULES = {
  CORE: 'CORE',
  PROCUREMENT: 'PROCUREMENT',
  INVENTORY: 'INVENTORY',
  FINANCE: 'FINANCE',
  SALES: 'SALES',
} as const;

export type Module = (typeof MODULES)[keyof typeof MODULES];

export const MODULE_LABELS: Record<Module, string> = {
  CORE: 'Core',
  PROCUREMENT: 'Procurement',
  INVENTORY: 'Inventory',
  FINANCE: 'Finance',
  SALES: 'Sales',
};

export const MODULE_DEPENDENCIES: Record<Module, Module[]> = {
  CORE: [],
  PROCUREMENT: [],
  INVENTORY: [],
  FINANCE: ['INVENTORY', 'PROCUREMENT'],
  SALES: ['INVENTORY', 'FINANCE'],
};
