import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { InstitutionalToastState } from '../../../hooks/useInstitutionalToast';

const VARIANT_CLASS: Record<InstitutionalToastState['variant'], string> = {
  success: 'border-emerald-700 bg-emerald-50 text-emerald-950',
  error: 'border-red-700 bg-red-50 text-red-950',
  info: 'border-primexpert-dark bg-primexpert-light text-primexpert-dark',
};

export function InstitutionalToastBanner({
  toast,
  onDismiss,
}: {
  toast: InstitutionalToastState | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;

  return (
    <div
      role="status"
      className={cn(
        'flex items-start justify-between gap-4 rounded-xl border-2 px-5 py-4 text-[15px] font-semibold leading-snug',
        VARIANT_CLASS[toast.variant]
      )}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-lg border border-current/30 p-1.5 hover:bg-black/5"
        aria-label="Fermer"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
