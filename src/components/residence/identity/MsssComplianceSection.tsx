/**
 * Lot R1 — Conformité MSSS / RQRA (édition cockpit Identité).
 *
 * Composant CRUD entièrement natif (aucun composant MUI / dépendance lourde) :
 * - Toggles 1/3-1/3-1/3 OUI/NON/INCONNU massifs (charte Confort visuel 66+).
 * - <select> natif pour la catégorie RPA enum (A/B/C/D).
 * - <input type="date"> + sentinelle "Plus de 12 mois" pour l'inspection MAPAQ.
 * - Bandeau d'alerte rouge plein contraste si la certification MSSS est inactive.
 * - Persistance Firestore via le contexte ResidenceDocument (updateResidence).
 */

import React, { useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Stamp,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';

// -----------------------------------------------------------------------------
// Types & helpers (zéro any)
// -----------------------------------------------------------------------------

type TernaryBool = boolean | null;

interface MsssComplianceSnapshot {
  numeroMSSS: string;
  certificationActive: TernaryBool;
  categorieRpaEnum: '' | 'A' | 'B' | 'C' | 'D';
  exploitantReseauRpaUnique: TernaryBool;
  autresRPA: string;
  numeroCertification: string;
  numeroRQRA: string;
  membreRQRA: TernaryBool;
  niveauSoins: string;
  dateInspectionMAPAQ: string;
  gestionMedicaments: string;
  ententesReseau: string;
}

function readString(
  doc: Record<string, unknown> | null,
  keys: readonly string[]
): string {
  if (!doc) return '';
  for (const k of keys) {
    const v = doc[k];
    if (typeof v === 'string' && v.trim().length > 0) return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function readBoolean(
  doc: Record<string, unknown> | null,
  keys: readonly string[]
): TernaryBool {
  if (!doc) return null;
  for (const k of keys) {
    const raw = doc[k];
    if (raw === true || raw === 1) return true;
    if (raw === false || raw === 0) return false;
    if (typeof raw === 'string') {
      const norm = raw.trim().toLowerCase();
      if (['true', 'oui', 'yes', '1'].includes(norm)) return true;
      if (['false', 'non', 'no', '0'].includes(norm)) return false;
    }
  }
  return null;
}

function readDateIso(
  doc: Record<string, unknown> | null,
  keys: readonly string[]
): string {
  if (!doc) return '';
  for (const k of keys) {
    const raw = doc[k];
    if (raw && typeof raw === 'object' && 'toDate' in (raw as object)) {
      try {
        const d = (raw as { toDate(): Date }).toDate();
        if (d instanceof Date && !Number.isNaN(d.getTime())) {
          return d.toISOString().slice(0, 10);
        }
      } catch {
        /* fall through */
      }
    }
    if (typeof raw === 'string' && raw.trim().length > 0) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
      return raw.toISOString().slice(0, 10);
    }
  }
  return '';
}

function readCategorieRpaEnum(
  doc: Record<string, unknown> | null
): MsssComplianceSnapshot['categorieRpaEnum'] {
  const raw = readString(doc, [
    'categorieRpaEnum',
    'categorieRpaCode',
    'rpaCategoryEnum',
    'rpaCategoryCode',
    'categorieRPALettre',
    'categorieRPA',
    'category',
  ]).trim().toUpperCase();
  if (raw.startsWith('A')) return 'A';
  if (raw.startsWith('B')) return 'B';
  if (raw.startsWith('C')) return 'C';
  if (raw.startsWith('D')) return 'D';
  return '';
}

function resolveSnapshot(
  doc: Record<string, unknown> | null
): MsssComplianceSnapshot {
  const source = doc ?? {};
  return {
    numeroMSSS: readString(source, [
      'numeroMSSS',
      'codeMSSS',
      'msssNumber',
      'numeroRegistreMsss',
      'numeroPermisMsss',
    ]),
    certificationActive: readBoolean(source, [
      'certificationActive',
      'certificationMsssActive',
      'isCertificationActive',
      'permisActif',
      'msssCertificationActive',
    ]),
    categorieRpaEnum: readCategorieRpaEnum(source),
    exploitantReseauRpaUnique: readBoolean(source, [
      'exploitantReseauRpaUnique',
      'exploitantReseauUnique',
      'reseauRpaUnique',
      'isSoleNetworkOperator',
      'singleNetworkOperator',
    ]),
    autresRPA: readString(source, [
      'autresRPA',
      'autresResidences',
      'otherRpas',
      'networkOtherRpas',
      'reseauAutresRpa',
    ]),
    numeroCertification: readString(source, [
      'numeroCertification',
      'numeroPermisMsss',
      'permitNumber',
      'certificationNumber',
    ]),
    numeroRQRA: readString(source, [
      'numeroRQRA',
      'rqraNumber',
      'numeroRqra',
      'numeroAdhesionRqra',
    ]),
    membreRQRA: readBoolean(source, [
      'membreRQRA',
      'membreRqra',
      'isRqraMember',
      'adhesionRqra',
      'rqraActive',
    ]),
    niveauSoins: readString(source, [
      'niveauSoins',
      'careLevel',
      'niveauSoinsRpa',
      'rpaCareLevel',
    ]),
    dateInspectionMAPAQ: readDateIso(source, [
      'dateInspectionMAPAQ',
      'dateInspectionMapaq',
      'lastMapaqInspectionDate',
      'mapaqInspectionDate',
      'derniereInspectionMapaq',
    ]),
    gestionMedicaments: readString(source, [
      'gestionMedicaments',
      'medicationManagement',
      'gestionRx',
      'medicationProtocol',
    ]),
    ententesReseau: readString(source, [
      'ententesReseau',
      'networkAgreements',
      'ententesCisss',
      'ententeReseauSante',
      'reseauEntentes',
    ]),
  };
}

function isMapaqOlderThanOneYear(isoDate: string): boolean {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const elapsedMonths =
    (now.getFullYear() - d.getFullYear()) * 12 +
    (now.getMonth() - d.getMonth());
  return elapsedMonths > 12;
}

// -----------------------------------------------------------------------------
// UI sub-components
// -----------------------------------------------------------------------------

function TernaryToggleMassive({
  value,
  onChange,
  disabled,
  language,
  ariaLabel,
}: {
  value: TernaryBool;
  onChange: (next: TernaryBool) => void;
  disabled: boolean;
  language: 'fr' | 'en';
  ariaLabel: string;
}) {
  const items: Array<{ key: string; tile: TernaryBool; labelFr: string; labelEn: string }> = [
    { key: 'yes', tile: true, labelFr: 'OUI', labelEn: 'YES' },
    { key: 'no', tile: false, labelFr: 'NON', labelEn: 'NO' },
    { key: 'unknown', tile: null, labelFr: 'INCONNU', labelEn: 'UNKNOWN' },
  ];
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid grid-cols-3 gap-2">
      {items.map(({ key, tile, labelFr, labelEn }) => {
        const active = value === tile;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(tile)}
            className={cn(
              'inline-flex h-12 w-full items-center justify-center rounded-xl border-2 text-[15px] font-black uppercase tracking-wider transition-colors',
              active
                ? 'border-black bg-black text-white shadow-sm'
                : 'border-black bg-white text-black hover:bg-slate-50',
              disabled && 'cursor-not-allowed opacity-60'
            )}
          >
            {language === 'fr' ? labelFr : labelEn}
          </button>
        );
      })}
    </div>
  );
}

function FieldRow({
  labelFr,
  labelEn,
  language,
  children,
  helperFr,
  helperEn,
}: {
  labelFr: string;
  labelEn: string;
  language: 'fr' | 'en';
  children: React.ReactNode;
  helperFr?: string;
  helperEn?: string;
}) {
  return (
    <div className="rounded-xl border-2 border-black/10 bg-white p-4">
      <p className="text-[13px] font-black uppercase tracking-wider text-[#142c6a]">
        {language === 'fr' ? labelFr : labelEn}
      </p>
      <div className="mt-3">{children}</div>
      {helperFr && helperEn ? (
        <p className="mt-2 text-[13px] font-semibold leading-relaxed text-slate-700">
          {language === 'fr' ? helperFr : helperEn}
        </p>
      ) : null}
    </div>
  );
}

const TEXT_INPUT_CLASSES =
  'h-12 w-full rounded-xl border-2 border-black/30 bg-white px-3 text-[15px] font-semibold text-black placeholder-slate-400 focus:border-[#142c6a] focus:outline-none focus:ring-2 focus:ring-[#142c6a]/30 disabled:cursor-not-allowed disabled:opacity-60';

// -----------------------------------------------------------------------------
// Composant principal
// -----------------------------------------------------------------------------

export interface MsssComplianceSectionProps {
  language: 'fr' | 'en';
}

export function MsssComplianceSection({ language }: MsssComplianceSectionProps) {
  const { residenceDoc, saving, updateResidence } = useResidenceDocument();

  const snapshot = useMemo(
    () => resolveSnapshot(residenceDoc as Record<string, unknown> | null),
    [residenceDoc]
  );

  const writeField = useCallback(
    (field: string, value: unknown) => {
      void updateResidence({ [field]: value });
    },
    [updateResidence]
  );

  const mapaqStale = isMapaqOlderThanOneYear(snapshot.dateInspectionMAPAQ);
  const certificationInactive = snapshot.certificationActive === false;

  return (
    <section
      className="rounded-xl border-2 border-[#dc2626] bg-white shadow-sm overflow-hidden"
      aria-labelledby="msss-compliance-title"
    >
      <header className="flex items-center justify-between gap-3 border-b-2 border-[#dc2626]/30 bg-red-50/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <Stamp className="h-5 w-5 text-[#dc2626]" aria-hidden />
          <h3
            id="msss-compliance-title"
            className="text-[13px] font-black uppercase tracking-[0.18em] text-[#dc2626]"
          >
            {language === 'fr'
              ? 'Conformité MSSS / RQRA'
              : 'MSSS / RQRA compliance'}
          </h3>
        </div>
        {saving ? (
          <span className="text-[12px] font-black uppercase tracking-wider text-slate-600">
            {language === 'fr' ? 'Enregistrement…' : 'Saving…'}
          </span>
        ) : null}
      </header>

      <div className="space-y-4 p-5">
        {certificationInactive ? (
          <div
            className="rounded-xl border-2 border-red-700 bg-red-50 p-4"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 shrink-0 text-red-700" aria-hidden />
              <div>
                <p className="text-[15px] font-black uppercase tracking-wider text-red-900">
                  {language === 'fr'
                    ? '⚠ Certification MSSS inactive — admissibilité SCHL bloquée'
                    : '⚠ MSSS certification inactive — CMHC eligibility blocked'}
                </p>
                <p className="mt-1 text-[15px] font-semibold leading-relaxed text-red-900">
                  {language === 'fr'
                    ? "Aucun programme APH Select ni SCHL Standard ne peut être assemblé tant que le permis MSSS n'est pas réactivé. Documenter la relance et la pièce justificative avant présentation prêteur."
                    : 'No MLI Select or CMHC Standard program can be assembled until the MSSS permit is reinstated. Document the follow-up and supporting evidence before lender presentation.'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FieldRow
            labelFr="Numéro de permis MSSS"
            labelEn="MSSS permit number"
            language={language}
          >
            <input
              type="text"
              value={snapshot.numeroMSSS}
              onChange={(e) => writeField('numeroMSSS', e.target.value)}
              disabled={saving}
              className={TEXT_INPUT_CLASSES}
              placeholder={language === 'fr' ? 'Ex. : MSSS-12345' : 'e.g. MSSS-12345'}
            />
          </FieldRow>

          <FieldRow
            labelFr="Numéro de certification"
            labelEn="Certification number"
            language={language}
          >
            <input
              type="text"
              value={snapshot.numeroCertification}
              onChange={(e) => writeField('numeroCertification', e.target.value)}
              disabled={saving}
              className={TEXT_INPUT_CLASSES}
              placeholder={language === 'fr' ? 'Numéro officiel' : 'Official number'}
            />
          </FieldRow>

          <FieldRow
            labelFr="Certification MSSS active"
            labelEn="MSSS certification active"
            language={language}
            helperFr="Permis RPA en vigueur au registre du ministère."
            helperEn="RPA permit currently in force in the ministry registry."
          >
            <TernaryToggleMassive
              value={snapshot.certificationActive}
              onChange={(v) => writeField('certificationActive', v)}
              disabled={saving}
              language={language}
              ariaLabel={
                language === 'fr' ? 'Certification MSSS active' : 'MSSS certification active'
              }
            />
          </FieldRow>

          <FieldRow
            labelFr="Catégorie RPA"
            labelEn="RPA category"
            language={language}
            helperFr="A · Autonome · B · Repas · C · Soins · D · Lourds."
            helperEn="A · Independent · B · Meals · C · Care · D · Heavy care."
          >
            <select
              value={snapshot.categorieRpaEnum}
              onChange={(e) =>
                writeField(
                  'categorieRpaEnum',
                  e.target.value === '' ? null : e.target.value
                )
              }
              disabled={saving}
              className={TEXT_INPUT_CLASSES}
            >
              <option value="">
                {language === 'fr' ? '— À VALIDER —' : '— TO VALIDATE —'}
              </option>
              <option value="A">A · {language === 'fr' ? 'Autonome' : 'Independent'}</option>
              <option value="B">B · {language === 'fr' ? 'Repas' : 'Meals'}</option>
              <option value="C">C · {language === 'fr' ? 'Soins' : 'Care'}</option>
              <option value="D">D · {language === 'fr' ? 'Lourds' : 'Heavy care'}</option>
            </select>
          </FieldRow>

          <FieldRow
            labelFr="Numéro RQRA"
            labelEn="RQRA number"
            language={language}
          >
            <input
              type="text"
              value={snapshot.numeroRQRA}
              onChange={(e) => writeField('numeroRQRA', e.target.value)}
              disabled={saving}
              className={TEXT_INPUT_CLASSES}
              placeholder={language === 'fr' ? 'Numéro RQRA' : 'RQRA number'}
            />
          </FieldRow>

          <FieldRow
            labelFr="Adhésion RQRA active"
            labelEn="Active RQRA membership"
            language={language}
            helperFr="Adhésion au Regroupement québécois des résidences pour aînés (RQRA)."
            helperEn="Membership in Quebec association of seniors’ residences (RQRA)."
          >
            <TernaryToggleMassive
              value={snapshot.membreRQRA}
              onChange={(v) => writeField('membreRQRA', v)}
              disabled={saving}
              language={language}
              ariaLabel={language === 'fr' ? 'Membre RQRA' : 'RQRA member'}
            />
          </FieldRow>

          <FieldRow
            labelFr="Exploitant — réseau RPA unique"
            labelEn="Operator — single-site network"
            language={language}
            helperFr="Vrai si l'exploitant ne possède qu'une seule RPA."
            helperEn="True if the operator owns a single RPA."
          >
            <TernaryToggleMassive
              value={snapshot.exploitantReseauRpaUnique}
              onChange={(v) => writeField('exploitantReseauRpaUnique', v)}
              disabled={saving}
              language={language}
              ariaLabel={
                language === 'fr' ? 'Réseau RPA unique' : 'Single-site network'
              }
            />
          </FieldRow>

          <FieldRow
            labelFr="Autres RPA du même exploitant"
            labelEn="Other RPAs of the same operator"
            language={language}
            helperFr="Liste des autres RPA si l'exploitant gère un réseau."
            helperEn="List of other RPAs if the operator runs a network."
          >
            <input
              type="text"
              value={snapshot.autresRPA}
              onChange={(e) => writeField('autresRPA', e.target.value)}
              disabled={saving}
              className={TEXT_INPUT_CLASSES}
              placeholder={language === 'fr' ? 'Ex. : Le Manoir A, Villa B…' : 'e.g. Manor A, Villa B…'}
            />
          </FieldRow>

          <FieldRow
            labelFr="Niveau de soins"
            labelEn="Care level"
            language={language}
            helperFr="Autonome · Soins légers · Soins lourds, etc."
            helperEn="Independent · Light care · Heavy care, etc."
          >
            <input
              type="text"
              value={snapshot.niveauSoins}
              onChange={(e) => writeField('niveauSoins', e.target.value)}
              disabled={saving}
              className={TEXT_INPUT_CLASSES}
              placeholder={language === 'fr' ? 'Niveau de soins' : 'Care level'}
            />
          </FieldRow>

          <FieldRow
            labelFr="Gestion des médicaments"
            labelEn="Medication management"
            language={language}
            helperFr="Mode et fréquence de distribution des médicaments."
            helperEn="Medication management and distribution protocol."
          >
            <input
              type="text"
              value={snapshot.gestionMedicaments}
              onChange={(e) => writeField('gestionMedicaments', e.target.value)}
              disabled={saving}
              className={TEXT_INPUT_CLASSES}
              placeholder={language === 'fr' ? 'Protocole de gestion' : 'Management protocol'}
            />
          </FieldRow>

          <FieldRow
            labelFr="Ententes réseau (CISSS / CIUSSS)"
            labelEn="Network agreements (CISSS / CIUSSS)"
            language={language}
            helperFr="Centre intégré (universitaire) de santé et de services sociaux (CISSS / CIUSSS) — partenariat clinique."
            helperEn="Integrated (university) health and social services centre (CISSS / CIUSSS) — clinical partnership."
          >
            <input
              type="text"
              value={snapshot.ententesReseau}
              onChange={(e) => writeField('ententesReseau', e.target.value)}
              disabled={saving}
              className={TEXT_INPUT_CLASSES}
              placeholder={language === 'fr' ? 'Ententes en place' : 'Active agreements'}
            />
          </FieldRow>

          <FieldRow
            labelFr="Dernière inspection MAPAQ"
            labelEn="Last MAPAQ inspection"
            language={language}
            helperFr="Ministère de l'agriculture, des pêcheries et de l'alimentation du Québec (MAPAQ)."
            helperEn="Quebec ministry of agriculture, fisheries and food (MAPAQ)."
          >
            <input
              type="date"
              value={snapshot.dateInspectionMAPAQ}
              onChange={(e) =>
                writeField('dateInspectionMAPAQ', e.target.value || null)
              }
              disabled={saving}
              className={TEXT_INPUT_CLASSES}
            />
            {mapaqStale ? (
              <p
                role="alert"
                className="mt-3 inline-flex items-center gap-2 rounded-lg border-2 border-amber-700 bg-amber-100 px-3 py-2 text-[14px] font-black uppercase tracking-wider text-amber-900"
              >
                <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden />
                {language === 'fr'
                  ? '⚠️ Plus de 12 mois — relance recommandée'
                  : '⚠️ More than 12 months — follow-up recommended'}
              </p>
            ) : snapshot.dateInspectionMAPAQ ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-lg border-2 border-emerald-700 bg-emerald-50 px-3 py-2 text-[14px] font-black uppercase tracking-wider text-emerald-900">
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
                {language === 'fr'
                  ? 'Inspection MAPAQ récente'
                  : 'Recent MAPAQ inspection'}
              </p>
            ) : null}
          </FieldRow>
        </div>
      </div>
    </section>
  );
}

export default MsssComplianceSection;
