/**
 * LineDetailPanel
 * Master-detail panel that opens below a selected PR line row.
 * Contains 7 tabs: Delivery Schedule, A/C Details, Alternates,
 * Item Status, Short Close, Inputs, Lead Time.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronDown } from 'lucide-react';
import {
  useDeliverySchedules,
  useAccountDetails,
  useAlternateItems,
  useAttachments,
  useShortCloseInfo,
} from '../../api/prSubSections';

import DeliveryScheduleTab  from './tabs/DeliveryScheduleTab';
import AccountDetailsTab    from './tabs/AccountDetailsTab';
import AlternateItemsTab    from './tabs/AlternateItemsTab';
import ItemStatusTab        from './tabs/ItemStatusTab';
import ShortCloseTab        from './tabs/ShortCloseTab';
import InputsTab            from './tabs/InputsTab';
import LeadTimeTab          from './tabs/LeadTimeTab';

export interface LineDetailPanelProps {
  prlId:      string;
  lineId:     string;
  lineNo:     number;
  itemLabel?: string;
  reqQty:     number;
  approxPrice: number;
  prStatus:   string;
  onClose:    () => void;
}

type TabId =
  | 'delivery'
  | 'account'
  | 'alternates'
  | 'status'
  | 'shortclose'
  | 'inputs'
  | 'leadtime';

const isReadOnly = (status: string) =>
  ['CLOSED', 'SHORT_CLOSED'].includes(status);

export default function LineDetailPanel({
  prlId,
  lineId,
  lineNo,
  itemLabel,
  reqQty,
  approxPrice,
  prStatus,
  onClose,
}: LineDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('delivery');
  const panelRef = useRef<HTMLDivElement>(null);
  const readOnly = isReadOnly(prStatus);

  // Pre-fetch badge counts
  const { data: schedules }   = useDeliverySchedules(prlId, lineId);
  const { data: accounts }    = useAccountDetails(prlId, lineId);
  const { data: alternates }  = useAlternateItems(prlId, lineId);
  const { data: attachments } = useAttachments(prlId, lineId);
  const { data: scInfo }      = useShortCloseInfo(prlId, lineId);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const tabs: Array<{ id: TabId; label: string; badge?: number | string }> = [
    {
      id: 'delivery',
      label: 'Delivery Schedule',
      badge: schedules?.length || undefined,
    },
    {
      id: 'account',
      label: 'A/C Details',
      badge: accounts?.length || undefined,
    },
    {
      id: 'alternates',
      label: 'Alternates',
      badge: alternates?.length || undefined,
    },
    { id: 'status',     label: 'Item Status' },
    {
      id: 'shortclose',
      label: 'Short Close',
      badge: scInfo?.shortCloseStatus !== 'NONE' ? scInfo?.shortCloseStatus : undefined,
    },
    {
      id: 'inputs',
      label: 'Inputs',
      badge: attachments?.length || undefined,
    },
    { id: 'leadtime', label: 'Lead Time' },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'delivery':
        return (
          <DeliveryScheduleTab
            prlId={prlId}
            lineId={lineId}
            reqQty={reqQty}
            readOnly={readOnly}
          />
        );
      case 'account':
        return (
          <AccountDetailsTab
            prlId={prlId}
            lineId={lineId}
            approxPrice={approxPrice}
            reqQty={reqQty}
            readOnly={readOnly}
          />
        );
      case 'alternates':
        return (
          <AlternateItemsTab
            prlId={prlId}
            lineId={lineId}
            readOnly={readOnly}
          />
        );
      case 'status':
        return <ItemStatusTab prlId={prlId} lineId={lineId} reqQty={reqQty} />;
      case 'shortclose':
        return (
          <ShortCloseTab
            prlId={prlId}
            lineId={lineId}
            prStatus={prStatus}
          />
        );
      case 'inputs':
        return (
          <InputsTab
            prlId={prlId}
            lineId={lineId}
            readOnly={readOnly}
          />
        );
      case 'leadtime':
        return (
          <LeadTimeTab
            prlId={prlId}
            lineId={lineId}
            prRequiredDate={undefined}
            readOnly={readOnly}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={panelRef}
      className="border-t-2 border-blue-500 bg-white shadow-inner"
      style={{ minHeight: 280 }}
    >
      {/* Panel header */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-blue-50 border-b border-blue-100">
        <ChevronDown size={14} className="text-blue-500 shrink-0" />
        <span className="text-xs font-semibold text-blue-700">
          Line {lineNo}{itemLabel ? ` — ${itemLabel}` : ''}
        </span>
        {readOnly && (
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-gray-200 text-gray-500 font-medium">
            READ ONLY
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto p-1 rounded hover:bg-blue-100 text-blue-400 hover:text-blue-700 transition-colors"
          aria-label="Close detail panel"
        >
          <X size={13} />
        </button>
      </div>

      {/* Tab strip */}
      <div className="flex items-end gap-0 border-b border-gray-200 bg-gray-50 px-2 pt-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 whitespace-nowrap
              transition-colors duration-100
              ${activeTab === tab.id
                ? 'border-blue-500 text-blue-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className={`
                  inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold
                  ${activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-200 text-gray-600'
                  }
                `}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-3 overflow-auto" style={{ maxHeight: 340 }}>
        {renderTab()}
      </div>
    </div>
  );
}
