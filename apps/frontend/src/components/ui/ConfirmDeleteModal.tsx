'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  itemIdentifier?: string;
  consequences?: string[];
  confirmText?: string;
  confirmButtonText?: string;
  cancelText?: string;
  isLoading?: boolean;
  error?: string | null;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemIdentifier,
  consequences,
  confirmText = 'Delete Permanently',
  confirmButtonText,
  cancelText = 'Cancel',
  isLoading = false,
  error = null,
}: ConfirmDeleteModalProps) {
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  useEffect(() => { if (isOpen) setLocalError(null); }, [isOpen]);
  const busy = isLoading || pending;
  const failure = error || localError;
  async function confirm() {
    setPending(true); setLocalError(null);
    try { await onConfirm(); } catch(e: any) { setLocalError(e.message || 'Unable to delete record'); }
    finally { setPending(false); }
  }
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-100 space-y-4 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="delete-dialog-title" className="font-bold text-base text-gray-900 leading-snug">
              {title}
            </h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
            {itemIdentifier && <p className="mt-2 rounded-lg bg-gray-50 p-2 text-xs font-semibold text-gray-800">{itemIdentifier}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Consequences Bullet Points */}
        {consequences && consequences.length > 0 && (
          <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl space-y-1.5 text-xs text-red-900">
            <p className="font-semibold text-[11px] uppercase tracking-wider text-red-800">
              Consequences of this action:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-red-700">
              {consequences.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Error message */}
        {failure && (
          <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-red-800 text-xs font-medium">
            {failure}
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs transition disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-sm active:scale-95 transition disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmButtonText || confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
