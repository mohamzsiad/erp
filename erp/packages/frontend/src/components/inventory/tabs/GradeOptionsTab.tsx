import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { useUpdateItem } from '../../../api/inventory';
import { useToast } from '../../ui/Toast';

interface Props {
  itemId: string;
  grade1Options: string[];
  grade2Options: string[];
}

export default function GradeOptionsTab({ itemId, grade1Options, grade2Options }: Props) {
  const toast = useToast();
  const updateItem = useUpdateItem(itemId);

  const [g1, setG1] = useState<string[]>([]);
  const [g2, setG2] = useState<string[]>([]);
  const [g1Input, setG1Input] = useState('');
  const [g2Input, setG2Input] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setG1(Array.isArray(grade1Options) ? grade1Options : []);
    setG2(Array.isArray(grade2Options) ? grade2Options : []);
    setDirty(false);
  }, [grade1Options, grade2Options]);

  const addG1 = () => {
    const val = g1Input.trim();
    if (!val || g1.includes(val)) { setG1Input(''); return; }
    setG1((p) => [...p, val]);
    setG1Input('');
    setDirty(true);
  };

  const addG2 = () => {
    const val = g2Input.trim();
    if (!val || g2.includes(val)) { setG2Input(''); return; }
    setG2((p) => [...p, val]);
    setG2Input('');
    setDirty(true);
  };

  const removeG1 = (v: string) => { setG1((p) => p.filter((x) => x !== v)); setDirty(true); };
  const removeG2 = (v: string) => { setG2((p) => p.filter((x) => x !== v)); setDirty(true); };

  const handleSave = async () => {
    if (g1.length === 0) { toast.error('Validation', 'Grade 1 must have at least one option'); return; }
    try {
      await updateItem.mutateAsync({ grade1Options: g1, grade2Options: g2 } as any);
      toast.success('Grade options saved');
      setDirty(false);
    } catch (err: any) {
      toast.error('Save failed', err?.message);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-6 max-w-2xl">
      {/* Grade 1 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Grade 1 Options</h3>
          <span className="text-xs text-gray-400">{g1.length} option{g1.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[32px] p-2 border border-gray-200 rounded bg-gray-50">
          {g1.length === 0 && <span className="text-xs text-gray-400 self-center">No Grade 1 options yet</span>}
          {g1.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
              {v}
              <button type="button" onClick={() => removeG1(v)} className="hover:text-blue-600 transition-colors">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={g1Input}
            onChange={(e) => setG1Input(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addG1(); } }}
            className="erp-input flex-1 text-sm"
            placeholder="Type option and press Enter or click Add…"
          />
          <button type="button" onClick={addG1} className="toolbar-btn">
            <Plus size={11} /> Add
          </button>
        </div>
      </div>

      {/* Grade 2 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Grade 2 Options</h3>
          <span className="text-xs text-gray-400">{g2.length} option{g2.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[32px] p-2 border border-gray-200 rounded bg-gray-50">
          {g2.length === 0 && <span className="text-xs text-gray-400 self-center">No Grade 2 options yet</span>}
          {g2.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">
              {v}
              <button type="button" onClick={() => removeG2(v)} className="hover:text-green-600 transition-colors">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={g2Input}
            onChange={(e) => setG2Input(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addG2(); } }}
            className="erp-input flex-1 text-sm"
            placeholder="Type option and press Enter or click Add…"
          />
          <button type="button" onClick={addG2} className="toolbar-btn">
            <Plus size={11} /> Add
          </button>
        </div>
      </div>

      {dirty && (
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={handleSave}
            disabled={updateItem.isPending}
            className="toolbar-btn bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {updateItem.isPending ? 'Saving…' : 'Save Grade Options'}
          </button>
          <span className="text-xs text-amber-600">You have unsaved changes</span>
        </div>
      )}
    </div>
  );
}
