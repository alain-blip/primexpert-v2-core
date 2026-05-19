import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { CalendarClock, FileText, Mail, MessageSquare, Phone, StickyNote } from 'lucide-react';
import { db } from '../../../lib/firebase';

export interface ResidenceActivitiesPanelProps {
  residenceId: string;
  locale: 'fr' | 'en';
}

interface ActivityRow {
  id: string;
  type: string;
  title: string;
  description: string;
  sentAtMillis: number;
  recipient?: string;
}

const TYPE_LABEL_FR: Record<string, string> = {
  document_selection_sent: 'Envoi documentaire (Prime-Mail)',
  email_sent: 'Courriel envoyé',
  email_received: 'Courriel reçu',
  call_made: 'Appel sortant',
  call_received: 'Appel entrant',
  sms_sent: 'SMS envoyé',
  sms_received: 'SMS reçu',
  note: 'Note interne',
};

const TYPE_LABEL_EN: Record<string, string> = {
  document_selection_sent: 'Document delivery (Prime-Mail)',
  email_sent: 'Email sent',
  email_received: 'Email received',
  call_made: 'Outbound call',
  call_received: 'Inbound call',
  sms_sent: 'SMS sent',
  sms_received: 'SMS received',
  note: 'Internal note',
};

function pickIcon(type: string): React.ReactNode {
  if (type.startsWith('email')) return <Mail className="h-4 w-4" />;
  if (type.startsWith('call')) return <Phone className="h-4 w-4" />;
  if (type.startsWith('sms')) return <MessageSquare className="h-4 w-4" />;
  if (type === 'note') return <StickyNote className="h-4 w-4" />;
  if (type === 'document_selection_sent') return <FileText className="h-4 w-4" />;
  return <CalendarClock className="h-4 w-4" />;
}

function readMillis(data: Record<string, unknown>): number {
  const candidates = ['sentAtMillis', 'createdAtMillis', 'updatedAtMillis', 'timestampMillis'];
  for (const key of candidates) {
    const value = data[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  const tsCandidates = ['sentAt', 'createdAt', 'timestamp'];
  for (const key of tsCandidates) {
    const value = data[key];
    if (value && typeof value === 'object' && 'toDate' in value) {
      const fn = (value as { toDate?: () => Date }).toDate;
      if (typeof fn === 'function') {
        const d = fn.call(value);
        if (d instanceof Date && !Number.isNaN(d.getTime())) return d.getTime();
      }
    }
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
    }
  }
  return 0;
}

function readString(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function buildDescription(type: string, data: Record<string, unknown>): string {
  if (type === 'document_selection_sent') {
    const names = data.documentNames;
    if (Array.isArray(names) && names.length > 0) {
      return `${names.length} pièce(s) — ${names
        .slice(0, 3)
        .map((n) => String(n))
        .join(', ')}${names.length > 3 ? '…' : ''}`;
    }
    const subject = readString(data, ['subject']);
    if (subject) return subject;
  }
  if (type === 'note') {
    return readString(data, ['text', 'note', 'texte']);
  }
  return readString(data, ['subject', 'summary', 'message', 'body', 'description']);
}

export function ResidenceActivitiesPanel({ residenceId, locale }: ResidenceActivitiesPanelProps) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!residenceId) return undefined;
    setLoading(true);
    const ref = collection(db, 'residences', residenceId, 'activities');
    const q = query(ref, orderBy('sentAt', 'desc'), limit(50));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const next: ActivityRow[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const type = readString(data, ['type', 'kind', 'category']) || 'activity';
          next.push({
            id: docSnap.id,
            type,
            title:
              (locale === 'fr' ? TYPE_LABEL_FR[type] : TYPE_LABEL_EN[type]) ||
              (locale === 'fr' ? 'Activité' : 'Activity'),
            description: buildDescription(type, data),
            sentAtMillis: readMillis(data),
            recipient: readString(data, ['recipientEmail', 'recipient', 'to', 'destinataire']),
          });
        });
        setRows(next);
        setLoading(false);
      },
      () => {
        setRows([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [residenceId, locale]);

  const formattedRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        dateLabel:
          row.sentAtMillis > 0
            ? new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'America/Toronto',
              }).format(new Date(row.sentAtMillis))
            : '—',
      })),
    [rows, locale]
  );

  if (loading) {
    return (
      <p className="rounded-xl border-2 border-[#142c6a]/20 bg-[#f1f5f9] p-4 text-[15px] font-semibold text-slate-700">
        {locale === 'fr' ? 'Chargement du fil d’activités…' : 'Loading activity feed…'}
      </p>
    );
  }

  if (formattedRows.length === 0) {
    return (
      <p className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-[15px] font-bold text-amber-950">
        {locale === 'fr'
          ? 'Aucune activité enregistrée pour le moment. Le fil se peuple automatiquement à chaque envoi, appel ou message.'
          : 'No activity yet. The feed populates automatically with every send, call or message.'}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {formattedRows.map((row) => (
        <li
          key={row.id}
          className="rounded-2xl border-2 border-[#142c6a]/25 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#142c6a] text-white">
                {pickIcon(row.type)}
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-black text-[#142c6a]">{row.title}</p>
                {row.recipient ? (
                  <p className="mt-0.5 text-[13px] font-semibold text-slate-700">
                    {locale === 'fr' ? 'Destinataire : ' : 'Recipient: '}
                    <span className="text-black">{row.recipient}</span>
                  </p>
                ) : null}
              </div>
            </div>
            <span className="text-[13px] font-bold text-slate-600">{row.dateLabel}</span>
          </div>
          {row.description ? (
            <p className="mt-3 text-[15px] font-semibold leading-relaxed text-black">
              {row.description}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default ResidenceActivitiesPanel;
