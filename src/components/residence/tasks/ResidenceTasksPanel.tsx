import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { CalendarCheck2, CheckCircle2, ListTodo, Plus, Trash2 } from 'lucide-react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/auth';
import { cn } from '../../../lib/utils';

export interface ResidenceTasksPanelProps {
  residenceId: string;
  locale: 'fr' | 'en';
}

type TaskKind = 'task' | 'appointment';
type TaskStatus = 'a_faire' | 'fait';

interface TaskRow {
  id: string;
  title: string;
  description: string;
  dueAtMillis: number;
  kind: TaskKind;
  status: TaskStatus;
  authorId?: string;
  authorName?: string;
}

function readString(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function readMillis(data: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
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

function readKind(value: unknown): TaskKind {
  if (typeof value === 'string') {
    const v = value.toLowerCase();
    if (v === 'appointment' || v === 'rendez-vous' || v === 'rdv') return 'appointment';
  }
  return 'task';
}

function readStatus(value: unknown): TaskStatus {
  if (typeof value === 'string') {
    const v = value.toLowerCase();
    if (v === 'fait' || v === 'done' || v === 'completed' || v === 'termine') return 'fait';
  }
  return 'a_faire';
}

export function ResidenceTasksPanel({ residenceId, locale }: ResidenceTasksPanelProps) {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [dueInput, setDueInput] = useState('');
  const [kindInput, setKindInput] = useState<TaskKind>('task');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!residenceId) return undefined;
    setLoading(true);
    const ref = collection(db, 'residences', residenceId, 'tasks');
    const q = query(ref, orderBy('dueAtMillis', 'asc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const next: TaskRow[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          next.push({
            id: docSnap.id,
            title: readString(data, ['title', 'titre']),
            description: readString(data, ['description', 'note']),
            dueAtMillis: readMillis(data, ['dueAtMillis', 'dueAt', 'dateDebut', 'date']),
            kind: readKind(data.kind ?? data.type),
            status: readStatus(data.status ?? data.statut),
            authorId: typeof data.authorId === 'string' ? data.authorId : undefined,
            authorName: typeof data.authorName === 'string' ? data.authorName : undefined,
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
  }, [residenceId]);

  const formattedRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        dueLabel:
          row.dueAtMillis > 0
            ? new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'America/Toronto',
              }).format(new Date(row.dueAtMillis))
            : locale === 'fr'
            ? 'Sans échéance'
            : 'No deadline',
        overdue:
          row.status !== 'fait' && row.dueAtMillis > 0 && row.dueAtMillis < Date.now(),
      })),
    [rows, locale]
  );

  const addTask = useCallback(async () => {
    if (!residenceId || !user || !titleInput.trim()) return;
    setSaving(true);
    try {
      const dueAtMillis = dueInput ? new Date(dueInput).getTime() : 0;
      await addDoc(collection(db, 'residences', residenceId, 'tasks'), {
        title: titleInput.trim(),
        description: '',
        dueAtMillis: Number.isFinite(dueAtMillis) ? dueAtMillis : 0,
        kind: kindInput,
        status: 'a_faire',
        authorId: user.uid,
        authorName: profile?.displayName || user.displayName || user.email || 'Courtier',
        createdAt: serverTimestamp(),
      });
      setTitleInput('');
      setDueInput('');
      setKindInput('task');
    } finally {
      setSaving(false);
    }
  }, [dueInput, kindInput, profile?.displayName, residenceId, titleInput, user]);

  const toggleStatus = useCallback(
    async (row: TaskRow) => {
      if (!residenceId) return;
      const next: TaskStatus = row.status === 'fait' ? 'a_faire' : 'fait';
      await updateDoc(doc(db, 'residences', residenceId, 'tasks', row.id), {
        status: next,
        completedAtMillis: next === 'fait' ? Date.now() : 0,
        updatedAt: serverTimestamp(),
      });
    },
    [residenceId]
  );

  const removeTask = useCallback(
    async (row: TaskRow) => {
      if (!residenceId) return;
      await deleteDoc(doc(db, 'residences', residenceId, 'tasks', row.id));
    },
    [residenceId]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-[#142c6a]/25 bg-[#f1f5f9] p-4">
        <p className="mb-3 text-[12px] font-black uppercase tracking-wider text-[#142c6a]">
          {locale === 'fr' ? 'Ajouter une tâche ou un rendez-vous' : 'Add a task or appointment'}
        </p>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto_auto]">
          <input
            type="text"
            value={titleInput}
            onChange={(event) => setTitleInput(event.target.value)}
            placeholder={
              locale === 'fr'
                ? 'Titre — ex. Appeler le notaire'
                : 'Title — e.g. Call the notary'
            }
            className="rounded-xl border-2 border-[#142c6a]/25 bg-white px-3 py-2.5 text-[15px] font-semibold text-black outline-none focus:border-[#142c6a]"
          />
          <input
            type="datetime-local"
            value={dueInput}
            onChange={(event) => setDueInput(event.target.value)}
            className="rounded-xl border-2 border-[#142c6a]/25 bg-white px-3 py-2.5 text-[15px] font-semibold text-black outline-none focus:border-[#142c6a]"
          />
          <select
            value={kindInput}
            onChange={(event) => setKindInput(event.target.value as TaskKind)}
            className="rounded-xl border-2 border-[#142c6a]/25 bg-white px-3 py-2.5 text-[15px] font-semibold text-black outline-none focus:border-[#142c6a]"
          >
            <option value="task">{locale === 'fr' ? 'Tâche' : 'Task'}</option>
            <option value="appointment">{locale === 'fr' ? 'Rendez-vous' : 'Appointment'}</option>
          </select>
          <button
            type="button"
            onClick={() => void addTask()}
            disabled={!titleInput.trim() || saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#142c6a] bg-[#142c6a] px-4 py-2.5 text-[13px] font-black uppercase tracking-wider text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {locale === 'fr' ? 'Ajouter' : 'Add'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="rounded-xl border-2 border-[#142c6a]/20 bg-[#f1f5f9] p-4 text-[15px] font-semibold text-slate-700">
          {locale === 'fr' ? 'Chargement des tâches…' : 'Loading tasks…'}
        </p>
      ) : formattedRows.length === 0 ? (
        <p className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-[15px] font-bold text-amber-950">
          {locale === 'fr'
            ? 'Aucune tâche ni rendez-vous pour cette fiche. Ajoutez votre première action ci-dessus.'
            : 'No task or appointment on this file yet. Add your first action above.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {formattedRows.map((row) => (
            <li
              key={row.id}
              className={cn(
                'rounded-2xl border-2 p-4 shadow-sm',
                row.status === 'fait'
                  ? 'border-emerald-700 bg-emerald-50'
                  : row.overdue
                  ? 'border-red-700 bg-red-50'
                  : 'border-[#142c6a]/25 bg-white'
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#142c6a] text-white">
                    {row.kind === 'appointment' ? (
                      <CalendarCheck2 className="h-4 w-4" />
                    ) : (
                      <ListTodo className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-[16px] font-black leading-tight',
                        row.status === 'fait' ? 'text-slate-500 line-through' : 'text-black'
                      )}
                    >
                      {row.title || (locale === 'fr' ? 'Action sans titre' : 'Untitled action')}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-slate-700">
                      {locale === 'fr' ? 'Échéance : ' : 'Due: '}
                      <span className={row.overdue ? 'font-black text-red-800' : 'text-[#142c6a]'}>
                        {row.dueLabel}
                      </span>
                      {row.authorName ? ` · ${row.authorName}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleStatus(row)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-[12px] font-black uppercase tracking-wider',
                      row.status === 'fait'
                        ? 'border-emerald-700 bg-white text-emerald-800'
                        : 'border-[#142c6a] bg-[#142c6a] text-white'
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {row.status === 'fait'
                      ? locale === 'fr'
                        ? 'Fait'
                        : 'Done'
                      : locale === 'fr'
                      ? 'Marquer fait'
                      : 'Mark done'}
                  </button>
                  {user?.uid && row.authorId === user.uid ? (
                    <button
                      type="button"
                      onClick={() => void removeTask(row)}
                      className="inline-flex items-center gap-2 rounded-lg border-2 border-red-700 bg-white px-3 py-2 text-[12px] font-black uppercase tracking-wider text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                      {locale === 'fr' ? 'Supprimer' : 'Delete'}
                    </button>
                  ) : null}
                </div>
              </div>
              {row.description ? (
                <p className="mt-3 text-[15px] font-semibold leading-relaxed text-black">
                  {row.description}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ResidenceTasksPanel;
