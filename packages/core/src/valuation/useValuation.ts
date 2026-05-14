/**
 * Hook React pour utiliser le moteur de valorisation
 *
 * Ce hook permet d'intégrer facilement le moteur de valorisation
 * dans les composants React avec mémoisation des calculs.
 */

import { useMemo, useCallback, useState } from 'react';
import {
  calculateValuation,
  createDefaultValuationInputs,
  mapFirestoreDataToValuationInputs,
  type ValuationInputs,
  type ValuationOutputs,
  DEFAULT_VALUATION_PARAMS,
} from './valuationEngine';

/**
 * Options du hook useValuation
 */
export interface UseValuationOptions {
  /** Données initiales de la résidence (format Firestore) */
  residenceData?: Record<string, unknown>;
  /** Données financières initiales (format Firestore) */
  financialData?: Record<string, unknown>;
  /** Inputs directs (prioritaires sur residenceData/financialData) */
  initialInputs?: Partial<ValuationInputs>;
  /** Recalculer automatiquement quand les inputs changent */
  autoCalculate?: boolean;
}

/**
 * Retour du hook useValuation
 */
export interface UseValuationReturn {
  /** Inputs actuels */
  inputs: ValuationInputs;
  /** Résultats de la valorisation */
  outputs: ValuationOutputs | null;
  /** Mettre à jour un ou plusieurs champs d'input */
  updateInputs: (updates: Partial<ValuationInputs>) => void;
  /** Mettre à jour les dépenses */
  updateExpenses: (expenses: Record<string, number>) => void;
  /** Mettre à jour les paramètres de financement */
  updateFinancing: (financing: Partial<ValuationInputs['financing']>) => void;
  /** Mettre à jour les poids de pondération */
  updateWeights: (weights: Partial<ValuationInputs['weights']>) => void;
  /** Mettre à jour les ajustements */
  updateAdjustments: (adjustments: Partial<ValuationInputs['adjustments']>) => void;
  /** Forcer le recalcul */
  recalculate: () => ValuationOutputs;
  /** Réinitialiser aux valeurs par défaut */
  reset: () => void;
  /** Indicateur de calcul en cours */
  isCalculating: boolean;
  /** Erreur éventuelle */
  error: Error | null;
}

/**
 * Hook pour utiliser le moteur de valorisation dans les composants React
 *
 * @example
 * ```tsx
 * function FinancialDashboard({ residenceId }) {
 *   const { inputs, outputs, updateInputs, updateFinancing } = useValuation({
 *     residenceData: residence,
 *     financialData: financialDetails,
 *     autoCalculate: true,
 *   });
 *
 *   return (
 *     <div>
 *       <h2>Prix suggéré: {outputs?.suggestedPrice?.toLocaleString('fr-CA')} $</h2>
 *       <input
 *         type="number"
 *         value={inputs.askingPrice}
 *         onChange={(e) => updateInputs({ askingPrice: Number(e.target.value) })}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useValuation(options: UseValuationOptions = {}): UseValuationReturn {
  const {
    residenceData,
    financialData,
    initialInputs,
    autoCalculate = true,
  } = options;

  // Initialiser les inputs
  const initialValues = useMemo(() => {
    // Convertir les données Firestore si fournies
    const mappedData = residenceData || financialData
      ? mapFirestoreDataToValuationInputs(
          residenceData || {},
          financialData || {}
        )
      : {};

    // Créer les inputs avec les valeurs par défaut
    return createDefaultValuationInputs({
      ...mappedData,
      ...initialInputs,
    });
  }, [residenceData, financialData, initialInputs]);

  // État des inputs
  const [inputs, setInputs] = useState<ValuationInputs>(initialValues);

  // État pour le calcul
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Calculer les outputs avec mémoisation
  const outputs = useMemo(() => {
    if (!autoCalculate) return null;

    try {
      setError(null);
      return calculateValuation(inputs);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur de calcul'));
      return null;
    }
  }, [inputs, autoCalculate]);

  // Mettre à jour les inputs
  const updateInputs = useCallback((updates: Partial<ValuationInputs>) => {
    setInputs((prev) => ({ ...prev, ...updates }));
  }, []);

  // Mettre à jour les dépenses
  const updateExpenses = useCallback((expenses: Record<string, number>) => {
    setInputs((prev) => ({
      ...prev,
      operatingExpenses: { ...prev.operatingExpenses, ...expenses },
    }));
  }, []);

  // Mettre à jour les paramètres de financement
  const updateFinancing = useCallback(
    (financing: Partial<ValuationInputs['financing']>) => {
      setInputs((prev) => ({
        ...prev,
        financing: { ...prev.financing, ...financing },
      }));
    },
    []
  );

  // Mettre à jour les poids
  const updateWeights = useCallback(
    (weights: Partial<ValuationInputs['weights']>) => {
      setInputs((prev) => ({
        ...prev,
        weights: { ...prev.weights, ...weights },
      }));
    },
    []
  );

  // Mettre à jour les ajustements
  const updateAdjustments = useCallback(
    (adjustments: Partial<ValuationInputs['adjustments']>) => {
      setInputs((prev) => ({
        ...prev,
        adjustments: { ...prev.adjustments, ...adjustments },
      }));
    },
    []
  );

  // Forcer le recalcul
  const recalculate = useCallback(() => {
    setIsCalculating(true);
    try {
      setError(null);
      const result = calculateValuation(inputs);
      setIsCalculating(false);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur de calcul'));
      setIsCalculating(false);
      throw err;
    }
  }, [inputs]);

  // Réinitialiser
  const reset = useCallback(() => {
    setInputs(initialValues);
    setError(null);
  }, [initialValues]);

  return {
    inputs,
    outputs,
    updateInputs,
    updateExpenses,
    updateFinancing,
    updateWeights,
    updateAdjustments,
    recalculate,
    reset,
    isCalculating,
    error,
  };
}

export default useValuation;
