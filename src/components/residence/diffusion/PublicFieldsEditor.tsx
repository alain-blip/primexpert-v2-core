import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '../../../lib/i18n';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { BUYER_TARGET_PROFILE } from '@primexpert/core/diffusion';

const FIELD =
  'w-full rounded-xl border-2 border-black/30 bg-white px-4 py-3 text-[16px] font-semibold text-black placeholder-slate-400 focus:border-[#142c6a] focus:outline-none focus:ring-2 focus:ring-[#142c6a]/30';

const LABEL = 'block text-[14px] font-black uppercase tracking-wider text-[#142c6a] mb-2';

function pickString(doc: Record<string, unknown>, key: string): string {
  const v = doc[key];
  return typeof v === 'string' ? v : '';
}

export interface PublicFieldsEditorProps {
  disabled?: boolean;
}

export function PublicFieldsEditor({ disabled }: PublicFieldsEditorProps) {
  const { t } = useLanguage();
  const { residenceDoc, updateResidence, saving } = useResidenceDocument();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [publicTitle, setPublicTitle] = useState('');
  const [publicDescription, setPublicDescription] = useState('');
  const [publicInclusions, setPublicInclusions] = useState('');
  const [publicExclusions, setPublicExclusions] = useState('');
  const [publicVisualUrl, setPublicVisualUrl] = useState('');
  const [buyerTargetProfile, setBuyerTargetProfile] = useState('OUVERT');
  const [buyerTargetNotes, setBuyerTargetNotes] = useState('');

  useEffect(() => {
    if (!residenceDoc) return;
    setPublicTitle(pickString(residenceDoc, 'publicTitle'));
    setPublicDescription(pickString(residenceDoc, 'publicDescription'));
    setPublicInclusions(pickString(residenceDoc, 'publicInclusions'));
    setPublicExclusions(pickString(residenceDoc, 'publicExclusions'));
    setPublicVisualUrl(pickString(residenceDoc, 'publicVisualUrl'));
    const profile = pickString(residenceDoc, 'buyerTargetProfile') || 'OUVERT';
    setBuyerTargetProfile(profile);
    setBuyerTargetNotes(pickString(residenceDoc, 'buyerTargetNotes'));
  }, [residenceDoc]);

  const saveField = useCallback(
    async (key: string, value: string) => {
      if (!residenceDoc) return;
      setSavingKey(key);
      try {
        await updateResidence({ [key]: value.trim() || null });
      } finally {
        setSavingKey(null);
      }
    },
    [residenceDoc, updateResidence]
  );

  const profileOptions = Object.values(BUYER_TARGET_PROFILE);

  if (!residenceDoc) {
    return (
      <p className="text-[15px] font-semibold text-slate-600">
        {t('Chargement des champs publics…', 'Loading public fields…')}
      </p>
    );
  }

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <fieldset disabled={disabled || saving} className="space-y-6">
        <label className="block">
          <span className={LABEL}>
            {t('Titre marketing public', 'Public marketing title')}
            {savingKey === 'publicTitle' ? (
              <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />
            ) : null}
          </span>
          <input
            type="text"
            className={FIELD}
            value={publicTitle}
            onChange={(e) => setPublicTitle(e.target.value)}
            onBlur={() => saveField('publicTitle', publicTitle)}
            placeholder={t(
              'Ex. Résidence 40 unités — Rive-Sud',
              'e.g. 40-unit home — South Shore'
            )}
          />
        </label>

        <label className="block">
          <span className={LABEL}>
            {t('Description publique', 'Public description')}
            {savingKey === 'publicDescription' ? (
              <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />
            ) : null}
          </span>
          <textarea
            className={cnTextarea(FIELD)}
            rows={6}
            value={publicDescription}
            onChange={(e) => setPublicDescription(e.target.value)}
            onBlur={() => saveField('publicDescription', publicDescription)}
          />
        </label>

        <label className="block">
          <span className={LABEL}>
            {t('URL visuel public (image générique)', 'Public visual URL (generic image)')}
            {savingKey === 'publicVisualUrl' ? (
              <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />
            ) : null}
          </span>
          <input
            type="url"
            className={FIELD}
            value={publicVisualUrl}
            onChange={(e) => setPublicVisualUrl(e.target.value)}
            onBlur={() => saveField('publicVisualUrl', publicVisualUrl)}
            placeholder="https://"
          />
        </label>

        <label className="block">
          <span className={LABEL}>
            {t('Profil acheteur cible', 'Target buyer profile')}
            {savingKey === 'buyerTargetProfile' ? (
              <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />
            ) : null}
          </span>
          <select
            className={FIELD}
            value={buyerTargetProfile}
            onChange={(e) => {
              setBuyerTargetProfile(e.target.value);
              void saveField('buyerTargetProfile', e.target.value);
            }}
          >
            {profileOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={LABEL}>
            {t('Notes profil acheteur', 'Buyer profile notes')}
            {savingKey === 'buyerTargetNotes' ? (
              <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />
            ) : null}
          </span>
          <textarea
            className={cnTextarea(FIELD)}
            rows={3}
            value={buyerTargetNotes}
            onChange={(e) => setBuyerTargetNotes(e.target.value)}
            onBlur={() => saveField('buyerTargetNotes', buyerTargetNotes)}
          />
        </label>

        <label className="block">
          <span className={LABEL}>
            {t('Inclusions de la vente', 'Sale inclusions')}
            {savingKey === 'publicInclusions' ? (
              <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />
            ) : null}
          </span>
          <textarea
            className={cnTextarea(FIELD)}
            rows={3}
            value={publicInclusions}
            onChange={(e) => setPublicInclusions(e.target.value)}
            onBlur={() => saveField('publicInclusions', publicInclusions)}
          />
        </label>

        <label className="block">
          <span className={LABEL}>
            {t('Exclusions de la vente', 'Sale exclusions')}
            {savingKey === 'publicExclusions' ? (
              <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />
            ) : null}
          </span>
          <textarea
            className={cnTextarea(FIELD)}
            rows={3}
            value={publicExclusions}
            onChange={(e) => setPublicExclusions(e.target.value)}
            onBlur={() => saveField('publicExclusions', publicExclusions)}
          />
        </label>
      </fieldset>
    </form>
  );
}

function cnTextarea(base: string): string {
  return `${base} min-h-[120px] resize-y`;
}
