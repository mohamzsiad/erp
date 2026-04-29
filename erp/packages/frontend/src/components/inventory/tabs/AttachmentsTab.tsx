import React, { useState } from 'react';
import { Plus, Trash2, ExternalLink, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { useItemAttachments, useAddItemAttachment, useDeleteItemAttachment } from '../../../api/inventory';
import { useToast } from '../../ui/Toast';

interface Props {
  itemId: string;
}

interface AddForm {
  fileName:    string;
  url:         string;
  description: string;
}

const BLANK: AddForm = { fileName: '', url: '', description: '' };

export default function AttachmentsTab({ itemId }: Props) {
  const toast = useToast();
  const { data: rawData, isLoading } = useItemAttachments(itemId);
  const addMutation    = useAddItemAttachment(itemId);
  const deleteMutation = useDeleteItemAttachment(itemId);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddForm>(BLANK);
  const [deleting, setDeleting] = useState<string | null>(null);

  const attachments: any[] = Array.isArray(rawData) ? rawData : (rawData as any)?.data ?? [];

  const handleAdd = async () => {
    if (!form.fileName.trim()) { toast.error('Validation', 'File name is required'); return; }
    if (!form.url.trim()) { toast.error('Validation', 'URL / link is required'); return; }
    try {
      await addMutation.mutateAsync({ fileName: form.fileName.trim(), url: form.url.trim(), description: form.description.trim() || undefined });
      toast.success('Attachment added');
      setForm(BLANK);
      setShowForm(false);
    } catch (err: any) {
      toast.error('Failed to add attachment', err?.message);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Attachment removed');
    } catch (err: any) {
      toast.error('Delete failed', err?.message);
    } finally {
      setDeleting(null);
    }
  };

  const iconForMime = (mime?: string) => {
    if (!mime) return <Paperclip size={14} className="text-gray-400" />;
    if (mime.startsWith('image/')) return <span className="text-xs">🖼️</span>;
    if (mime.includes('pdf'))      return <span className="text-xs">📄</span>;
    if (mime.includes('sheet') || mime.includes('excel')) return <span className="text-xs">📊</span>;
    if (mime.includes('word') || mime.includes('document')) return <span className="text-xs">📝</span>;
    return <Paperclip size={14} className="text-gray-400" />;
  };

  if (isLoading) return <p className="text-xs text-gray-400 py-6 text-center">Loading…</p>;

  return (
    <div className="flex flex-col gap-3 p-1">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setShowForm((v) => !v)} className="toolbar-btn">
          <Plus size={11} /> Add Attachment
        </button>
        <span className="text-xs text-gray-400">{attachments.length} attachment{attachments.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="border border-blue-200 rounded-lg bg-blue-50/40 p-3 flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-600 mb-1">New Attachment</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">File Name *</label>
              <input
                type="text"
                value={form.fileName}
                onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))}
                className="erp-input text-xs"
                placeholder="e.g. Datasheet_Rev3.pdf"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">URL / Link *</label>
              <input
                type="text"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                className="erp-input text-xs"
                placeholder="https://… or \\server\share\file"
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs text-gray-500">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="erp-input text-xs"
                placeholder="Optional description…"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={handleAdd}
              disabled={addMutation.isPending}
              className="toolbar-btn bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {addMutation.isPending ? 'Adding…' : 'Add'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm(BLANK); }} className="toolbar-btn">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {attachments.length === 0 && !showForm && (
        <div className="text-center py-10 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
          <Paperclip size={24} className="mx-auto mb-2 opacity-40" />
          No attachments. Click &quot;+ Add Attachment&quot; to link a file or URL.
        </div>
      )}

      {attachments.length > 0 && (
        <div className="overflow-auto">
          <table className="w-full text-xs border border-gray-200 rounded">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1.5 text-left w-8" />
                <th className="px-2 py-1.5 text-left min-w-[180px]">File Name</th>
                <th className="px-2 py-1.5 text-left min-w-[200px]">URL / Link</th>
                <th className="px-2 py-1.5 text-left">Description</th>
                <th className="px-2 py-1.5 text-left w-32">Uploaded</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {attachments.map((att, idx) => (
                <tr key={att.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-2 py-1.5 text-center">{iconForMime(att.mimeType)}</td>
                  <td className="px-2 py-1.5 font-medium text-gray-800 truncate max-w-[180px]" title={att.fileName}>
                    {att.fileName}
                  </td>
                  <td className="px-2 py-1.5">
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline truncate max-w-[200px]"
                      title={att.url}
                    >
                      <ExternalLink size={10} />
                      {att.url.length > 40 ? att.url.slice(0, 40) + '…' : att.url}
                    </a>
                  </td>
                  <td className="px-2 py-1.5 text-gray-500 truncate max-w-[200px]">{att.description ?? '—'}</td>
                  <td className="px-2 py-1.5 text-gray-400 whitespace-nowrap">
                    {att.uploadedAt ? format(new Date(att.uploadedAt), 'dd/MM/yyyy') : '—'}
                  </td>
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => handleDelete(att.id)}
                      disabled={deleting === att.id}
                      className="p-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
