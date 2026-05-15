/**
 * E-3 — Point d’entrée historique (Softphone importe encore ce module).
 * Logique déplacée vers `transcriptionService.ts`.
 */

export {
  startCallAnalysisAfterUpload as enqueueRecordingTranscription,
  subscribeRecentCallAnalyses,
  registerRecordedCallAnalysis,
  runCallAnalysisPipeline,
  CALL_ANALYSES_SUBCOLLECTION,
} from './transcriptionService';

export type { CallAnalysisRow, CallPipelineStatus } from './transcriptionService';
