'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

export type RecordField = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'checkbox'; required?: boolean; min?: number; step?: string; options?: { value: string; label: string }[] };

export function RecordActions({ record, endpoint, label, fields, help, onDeleted }: {
  record: any; endpoint: string; label: string; fields: RecordField[]; help?: string; onDeleted?: () => void;
}) {
  const client = useQueryClient();
  const [mode, setMode] = useState<'view' | 'edit' | 'delete' | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  function open(next: 'view' | 'edit' | 'delete') {
    setError(''); setMessage('');
    setValues(Object.fromEntries(fields.map(f => [f.key, f.type === 'date' ? String(record[f.key] || '').slice(0, 10) : record[f.key] ?? (f.type === 'checkbox' ? false : '')])));
    setMode(next);
  }
  async function save(remove = false) {
    setBusy(true); setError('');
    try {
      if (remove) await api.delete(endpoint);
      else await api.put(endpoint, Object.fromEntries(fields.map(f => [f.key, f.type === 'number' ? Number(values[f.key]) : values[f.key]])));
      await client.invalidateQueries();
      setMode(null); setMessage(remove ? 'Deleted successfully' : 'Saved successfully');
      if (remove) onDeleted?.();
    } catch (e: any) { setError(e.message || 'Unable to save changes'); }
    finally { setBusy(false); }
  }
  return <div className="flex flex-wrap gap-2 text-xs" onClick={e => e.stopPropagation()}>
    {(['view', 'edit', 'delete'] as const).map(action => <button key={action} type="button" className="min-h-[44px] px-3 border rounded-lg bg-white capitalize" aria-label={`${action} ${label}`} onClick={() => open(action)}>{action}</button>)}
    {message && <span role="status">{message}</span>}
    {mode && createPortal(mode === 'delete' ? <ConfirmDeleteModal isOpen onClose={() => setMode(null)} onConfirm={() => save(true)} title={`Delete ${label}?`} description="Related records are checked before deletion. This action may be blocked to protect transaction history." isLoading={busy} error={error} /> :
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
        <form role="dialog" aria-modal="true" aria-label={`${mode} ${label}`} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 text-gray-900" onSubmit={e => { e.preventDefault(); save(); }}>
          <h2 className="font-bold text-lg">{mode === 'edit' ? 'Edit' : 'View'} {label}</h2>
          {help && <p className="text-sm">{help}</p>}
          {error && <p role="alert" className="text-red-700">{error}</p>}
          {fields.map(f => <label className="block text-sm" key={f.key}>{f.label}
            {f.options ? <select disabled={mode === 'view'} className="block w-full border rounded-lg p-3" value={values[f.key]} onChange={e => setValues({ ...values, [f.key]: e.target.value })}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> :
              <input className="block w-full border rounded-lg p-3" type={f.type || 'text'} required={f.required} min={f.min} step={f.step || (f.type === 'number' ? 'any' : undefined)} disabled={mode === 'view'} value={f.type === 'checkbox' ? undefined : values[f.key]} checked={f.type === 'checkbox' ? !!values[f.key] : undefined} onChange={e => setValues({ ...values, [f.key]: f.type === 'checkbox' ? e.target.checked : e.target.value })} />}
          </label>)}
          <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setMode(null)} className="p-3 border rounded-lg">Close</button>{mode === 'edit' && <button disabled={busy} className="p-3 rounded-lg bg-brand-deep text-white">{busy ? 'Saving…' : 'Save changes'}</button>}</div>
        </form>
      </div>, document.body)}
  </div>;
}
