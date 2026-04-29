import React, { useState } from 'react';
import { clsx } from 'clsx';

export interface TabDef {
  id: string;
  label: string;
  content: React.ReactNode;
  badge?: number;
}

interface KeyInfoItemDetailsTabsProps {
  /** Key Info panel — always visible above the tabs, typically a grid of label/value pairs */
  keyInfo?: React.ReactNode;
  /** The tab definitions */
  tabs: TabDef[];
  defaultTabId?: string;
  /** Controlled active tab id */
  activeTabId?: string;
  /** Called when user clicks a tab (controlled mode) */
  onTabChange?: (id: string) => void;
  className?: string;
}

/** Standard ERP document layout: key info header + detail tabs below */
export const KeyInfoItemDetailsTabs: React.FC<KeyInfoItemDetailsTabsProps> = ({
  keyInfo,
  tabs,
  defaultTabId,
  activeTabId,
  onTabChange,
  className,
}) => {
  const [internalId, setInternalId] = useState(defaultTabId ?? tabs[0]?.id);
  const activeId   = activeTabId ?? internalId;
  const setActiveId = (id: string) => { setInternalId(id); onTabChange?.(id); };

  const activeTab = tabs.find((t) => t.id === activeId);

  return (
    <div className={clsx('flex flex-col', className)}>
      {/* Key Info */}
      {keyInfo && (
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          {keyInfo}
        </div>
      )}

      {/* Tab strip */}
      <div className="flex border-b border-gray-200 bg-white">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
              tab.id === activeId
                ? 'border-[#1F4E79] text-[#1F4E79]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="bg-[#1F4E79] text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto bg-white">
        {activeTab?.content}
      </div>
    </div>
  );
};

/** A grid of key-value pairs for the Key Info area */
interface KeyInfoGridProps {
  items: { label: string; value: React.ReactNode }[];
  columns?: 2 | 3 | 4 | 5 | 6;
}

export const KeyInfoGrid: React.FC<KeyInfoGridProps> = ({ items, columns = 4 }) => {
  const gridClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  }[columns];

  return (
    <div className={clsx('grid gap-x-6 gap-y-2', gridClass)}>
      {items.map((item, i) => (
        <div key={i}>
          <p className="erp-label">{item.label}</p>
          <p className="text-sm text-gray-800 mt-0.5">{item.value ?? '—'}</p>
        </div>
      ))}
    </div>
  );
};
