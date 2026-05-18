import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface MarketBlurTextareaProps {
  label: string;
  fieldId: string;
  value: string;
  saving: boolean;
  placeholder?: string;
  rows?: number;
  onDraft: (fieldId: string, value: string) => void;
  onSave: (fieldId: string, value: string) => void;
}

export function MarketBlurTextarea({
  label,
  fieldId,
  value,
  saving,
  placeholder,
  rows = 5,
  onDraft,
  onSave,
}: MarketBlurTextareaProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleBlur = useCallback(() => {
    onDraft(fieldId, local);
    void onSave(fieldId, local);
  }, [fieldId, local, onDraft, onSave]);

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
        {label}
        {saving ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" /> : null}
      </p>
      <textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleBlur}
        rows={rows}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed',
          'text-[#000000] placeholder:text-slate-400',
          'focus:border-[#D4AF37]/50 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/25 resize-y min-h-[120px]'
        )}
      />
    </div>
  );
}
