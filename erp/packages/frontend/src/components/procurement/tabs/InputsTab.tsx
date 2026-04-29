import React, { useRef, useState } from 'react';
import { Upload, Trash2, FileText, Image, File, ExternalLink, Loader2 } from 'lucide-react';
import { useAttachments, useUploadAttachment, useDeleteAttachment } from '../../../api/prSubSections';
import { useToast } from '../../ui/Toast';

interface Props {
  prlId:    string;
  lineId:   string;
  readOnly: boolean;
}

const ALLOWED_EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.xlsx', '.docx', '.dwg'];
const MAX_SIZE_MB  = 10;

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return <Image size={14} className="text-blue-400" />;
  if (mime === 'application/pdf') return <FileText size={14} className="text-red-400" />;
  return <File size={14} className="text-gray-400" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function InputsTab({ prlId, lineId, readOnly }: Props) {
  const toast = useToast();
  const { data: attachments = [], isLoading } = useAttachments(prlId, lineId);
  const upload = useUploadAttachment(prlId, lineId);
  const remove = useDeleteAttachment(prlId, lineId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      toast.error('File type not allowed', `Allowed: ${ALLOWED_EXT.join(', ')}`);
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error('File too large', `Maximum size is ${MAX_SIZE_MB} MB`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      await upload.mutateAsync(file);
      toast.success('File uploaded', file.name);
    } catch (err: any) {
      toast.error('Upload failed', err?.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success('Attachment removed');
      setDeleteConfirm(null);
    } catch (err: any) {
      toast.error('Delete failed', err?.message);
    }
  };

  if (isLoading) return <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>;

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      {!readOnly && (
        <div
          className={`
            border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer
            ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}
          `}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXT.join(',')}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={20} className="text-blue-500 animate-spin" />
              <p className="text-xs text-blue-600">Uploading…</p>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <Upload size={18} className="mx-auto text-gray-400 mb-1.5" />
              <p className="text-xs text-gray-500">
                Drop a file here or <span className="text-blue-600 font-medium">browse</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                PDF, PNG, JPG, XLSX, DOCX, DWG · Max {MAX_SIZE_MB} MB · Up to 10 files
              </p>
            </>
          )}
        </div>
      )}

      {/* Attachment list */}
      {attachments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">
          No attachments. {!readOnly && 'Drop a file above to attach it to this line.'}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 px-3 py-2 rounded border border-gray-200 hover:bg-gray-50 group transition-colors"
            >
              {fileIcon(a.mimeType)}
              <div className="flex-1 min-w-0">
                <a
                  href={a.sasUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1 truncate"
                >
                  {a.fileName}
                  <ExternalLink size={10} className="shrink-0" />
                </a>
                <p className="text-[10px] text-gray-400">
                  {formatBytes(a.fileSize)} · {new Date(a.uploadedAt).toLocaleString()}
                </p>
              </div>

              {!readOnly && (
                <>
                  {deleteConfirm === a.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-red-500">Delete?</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        className="text-[10px] text-red-600 font-semibold hover:underline"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(null)}
                        className="text-[10px] text-gray-400 hover:underline"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(a.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-gray-400">
        {attachments.length} / 10 files attached
      </p>
    </div>
  );
}
