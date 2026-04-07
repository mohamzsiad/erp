import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertCircle } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { clsx } from 'clsx';

const TabBar: React.FC = () => {
  const navigate = useNavigate();
  const { tabs, activeTabId, setActiveTab, closeTab } = useUiStore();

  if (tabs.length === 0) return null;

  const handleTabClick = (path: string, id: string) => {
    setActiveTab(id);
    navigate(path);
  };

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const tab = tabs.find((t) => t.id === id);
    if (tab?.isDirty) {
      if (!window.confirm('This tab has unsaved changes. Close anyway?')) return;
    }
    closeTab(id);
    // Navigate to new active tab after close
    const remaining = tabs.filter((t) => t.id !== id);
    if (remaining.length > 0) {
      const idx = tabs.findIndex((t) => t.id === id);
      const next = remaining[idx - 1] ?? remaining[0];
      navigate(next.path);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex bg-gray-100 border-b border-gray-200 overflow-x-auto shrink-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-300">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabClick(tab.path, tab.id)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-gray-200 whitespace-nowrap shrink-0 max-w-[180px] transition-colors group',
            tab.id === activeTabId
              ? 'bg-white text-gray-800 font-medium border-t-2 border-t-[#1F4E79] -mt-px'
              : 'text-gray-500 hover:bg-white hover:text-gray-700'
          )}
        >
          {tab.isDirty && (
            <AlertCircle size={11} className="text-amber-500 shrink-0" />
          )}
          <span className="truncate flex-1">{tab.title}</span>
          <span
            role="button"
            onClick={(e) => handleClose(e, tab.id)}
            className={clsx(
              'p-0.5 rounded hover:bg-gray-200 shrink-0 transition-colors',
              tab.id === activeTabId ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60'
            )}
          >
            <X size={11} />
          </span>
        </button>
      ))}
    </div>
  );
};

export default TabBar;
