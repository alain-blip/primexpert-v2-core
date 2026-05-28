import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  uploadVoiceNote,
  watchResidenceVoiceNoteCompletion,
  type VoiceNoteParentKind,
} from '../../services/voiceNoteService';

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
];

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return PREFERRED_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

export interface AudioRecorderButtonProps {
  orgId: string;
  brokerId: string;
  authorName: string;
  parentKind: VoiceNoteParentKind;
  parentId: string;
  locale?: 'fr' | 'en';
  onAnalysisComplete?: () => void;
  onError?: (message: string) => void;
  className?: string;
  labels?: {
    record: string;
    stop: string;
    analyzing: string;
    unsupported: string;
  };
}

export function AudioRecorderButton({
  orgId,
  brokerId,
  authorName,
  parentKind,
  parentId,
  locale = 'fr',
  onAnalysisComplete,
  onError,
  className,
  labels,
}: AudioRecorderButtonProps) {
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [supported, setSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const watchUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSupported(
      typeof navigator !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== 'undefined'
    );
    return () => {
      watchUnsubRef.current?.();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const finishUpload = useCallback(
    async (blob: Blob) => {
      setAnalyzing(true);
      try {
        const { uploadId } = await uploadVoiceNote({
          orgId,
          brokerId,
          authorName,
          parentKind,
          parentId,
          blob,
          locale,
        });

        if (parentKind === 'residences') {
          watchUnsubRef.current?.();
          watchUnsubRef.current = watchResidenceVoiceNoteCompletion(
            parentId,
            uploadId,
            () => {
              setAnalyzing(false);
              watchUnsubRef.current?.();
              watchUnsubRef.current = null;
              onAnalysisComplete?.();
            },
            () => {
              setAnalyzing(false);
              onError?.(
                locale === 'fr'
                  ? 'Délai dépassé — vérifiez vos notes dans quelques instants.'
                  : 'Timed out — check your notes shortly.'
              );
            }
          );
        } else {
          setAnalyzing(false);
          onAnalysisComplete?.();
        }
      } catch (e) {
        setAnalyzing(false);
        const msg = e instanceof Error ? e.message : String(e);
        onError?.(msg);
      }
    },
    [orgId, brokerId, authorName, parentKind, parentId, locale, onAnalysisComplete, onError]
  );

  const startRecording = useCallback(async () => {
    if (!supported || analyzing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stopStream();
        const blob = new Blob(chunksRef.current, {
          type: mimeType || recorder.mimeType || 'audio/webm',
        });
        chunksRef.current = [];
        if (blob.size > 0) void finishUpload(blob);
        else setAnalyzing(false);
      };
      recorder.start(250);
      setRecording(true);
    } catch (e) {
      stopStream();
      const msg = e instanceof Error ? e.message : String(e);
      onError?.(msg);
    }
  }, [supported, analyzing, finishUpload, stopStream, onError]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    setRecording(false);
    if (!analyzing) setAnalyzing(true);
  }, [analyzing]);

  if (!supported) {
    return (
      <p className={cn('text-[11px] font-semibold text-amber-800', className)}>
        {labels?.unsupported ??
          (locale === 'fr'
            ? 'Enregistrement vocal non pris en charge sur ce navigateur.'
            : 'Voice recording is not supported in this browser.')}
      </p>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <button
        type="button"
        disabled={analyzing}
        onClick={() => (recording ? stopRecording() : void startRecording())}
        className={cn(
          'inline-flex h-11 w-11 items-center justify-center rounded-full border-2 shadow-md transition',
          recording
            ? 'border-red-700 bg-red-50 text-red-800 animate-pulse'
            : 'border-[#142c6a] bg-[#142c6a] text-white hover:bg-[#0f2254]',
          analyzing && 'opacity-60'
        )}
        aria-label={recording ? labels?.stop ?? 'Arrêter' : labels?.record ?? 'Enregistrer une note vocale'}
      >
        {analyzing ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : recording ? (
          <Square className="h-4 w-4 fill-current" aria-hidden />
        ) : (
          <Mic className="h-5 w-5" aria-hidden />
        )}
      </button>

      {analyzing ? (
        <p className="text-[12px] font-bold text-[#142c6a]">
          {labels?.analyzing ??
            (locale === 'fr'
              ? "L'IA analyse votre note…"
              : 'AI is analyzing your note…')}
        </p>
      ) : recording ? (
        <p className="text-[12px] font-bold text-red-800">
          {locale === 'fr' ? 'Enregistrement en cours…' : 'Recording…'}
        </p>
      ) : (
        <p className="text-[11px] font-semibold text-slate-600">
          {locale === 'fr'
            ? 'Note vocale — appuyez pour enregistrer'
            : 'Voice note — tap to record'}
        </p>
      )}
    </div>
  );
}
