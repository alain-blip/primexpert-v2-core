/**
 * Identité fusionnée — Phase 4a lecture + Phase 4b écriture.
 * SSOT : buildIdentityViewModel() + ResidenceDocumentContext.
 */

import React, { useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  Bath,
  BedDouble,
  Brain,
  Building2,
  CarFront,
  Gauge,
  Info,
  Sofa,
  TreePine,
  UtensilsCrossed,
  Users2,
  Utensils,
} from 'lucide-react';
import { buildIdentityViewModel } from '@primexpert/core/identity';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { ResponsibleBrokerCard } from '../identity/ResponsibleBrokerCard';
import type { Residence } from '../../../services/residences';
import { IdentityOverviewStrip } from '../identity/IdentityOverviewStrip';
import { EditableIdentitySection } from '../identity/EditableIdentitySection';
import { BuildingAuditPanel } from '../identity/BuildingAuditPanel';
import { MsssComplianceSection } from '../identity/MsssComplianceSection';
import { RentPricingTableSection } from '../identity/RentPricingTableSection';
import { EditableCapacitySection } from '../identity/EditableCapacitySection';
import { MsssEnrichmentBanner } from '../identity/MsssEnrichmentBanner';
import { IdentitySectionCard } from '../identity/IdentitySectionCard';
import { PartiesIntervenantsSection } from '../identity/PartiesIntervenantsSection';

export interface IdentiteImmeubleTabProps {
  residence: Residence;
}

type TernaryBool = boolean | null;

interface UnitsComfortSnapshot {
  salleDeBainPrivee: TernaryBool;
  detailsSalleDeBainPrivee: string;
  nombreUnitesAvecSDBPartagee: number | null;
  cuisinette: TernaryBool;
  nombreUnitesAvecCuisinette: number | null;
  balconPatio: TernaryBool;
  nombreUnitesAvecBalcon: number | null;
  meuble: TernaryBool;
  typeMeublement: string;
  detailsUnitesProtegees: string;
  alzIssueControlee: TernaryBool;
  alzApprocheScpd: TernaryBool;
  alzEntenteCisss: TernaryBool;
  alzAnnexe6: TernaryBool;
  alzInaptitudeValide: TernaryBool;
}

const UNITS_BINARY_KEYS = {
  salleDeBainPrivee: 'salleDeBainPrivee',
  cuisinette: 'cuisinette',
  balconPatio: 'balconPatio',
  meuble: 'meuble',
  alzIssueControlee: 'alzIssueControlee',
  alzApprocheScpd: 'alzApprocheScpd',
  alzEntenteCisss: 'alzEntenteCisss',
  alzAnnexe6: 'alzAnnexe6',
  alzInaptitudeValide: 'alzInaptitudeValide',
} as const;
type UnitsBinaryKey = keyof typeof UNITS_BINARY_KEYS;
type AlzheimerRuleKey = Extract<
  UnitsBinaryKey,
  'alzIssueControlee' | 'alzApprocheScpd' | 'alzEntenteCisss' | 'alzAnnexe6' | 'alzInaptitudeValide'
>;

interface AlzheimerRule {
  key: AlzheimerRuleKey;
  letter: string;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
}

const ALZHEIMER_RULES: readonly AlzheimerRule[] = [
  {
    key: 'alzIssueControlee',
    letter: 'A',
    titleFr: 'Sécurité anti-fugue et errance',
    titleEn: 'Anti-elopement & wandering safety',
    descFr:
      'Contrôle des issues (portes codées, bracelets magnétiques) & architecture circulaire.',
    descEn:
      'Exit control (coded doors, magnetic bracelets) & looping circulation pattern.',
  },
  {
    key: 'alzApprocheScpd',
    letter: 'B',
    titleFr: 'Seuils & formation SCPD (24/7)',
    titleEn: 'Staffing & dementia-care training (24/7)',
    descFr:
      'Surveillance active continue 24/7 & formation certifiée des préposés en symptômes comportementaux et psychologiques liés à la démence (SCPD) — démence, chutes, comportements.',
    descEn:
      'Continuous 24/7 active supervision & certified training in behavioural and psychological symptoms of dementia (BPSD) for caregivers.',
  },
  {
    key: 'alzEntenteCisss',
    letter: 'C',
    titleFr: 'Entente de réseau (CISSS / CIUSSS)',
    titleEn: 'Health network agreement (CISSS / CIUSSS)',
    descFr:
      'Entente formelle de collaboration avec le centre intégré de santé et de services sociaux (CISSS / CIUSSS) local pour les soins cliniques, la distribution des médicaments et les transferts en centre d’hébergement et de soins de longue durée (CHSLD).',
    descEn:
      'Formal partnership with the local integrated health and social services centre (CISSS / CIUSSS) for clinical care, medication distribution and long-term care (CHSLD) transfers.',
  },
  {
    key: 'alzAnnexe6',
    letter: 'D',
    titleFr: 'Bail complet & Annexe 6 du TAL',
    titleEn: 'Full TAL lease & Schedule 6',
    descFr:
      'Bail obligatoire du Tribunal administratif du logement (TAL) accompagné de l’Annexe 6 détaillant chaque coût d’assistance, de soins et de services personnels.',
    descEn:
      'Mandatory lease from the Administrative Housing Tribunal (TAL) with Schedule 6 itemising every assistance, care and personal-service fee.',
  },
  {
    key: 'alzInaptitudeValide',
    letter: 'E',
    titleFr: 'Évaluation & homologation légale',
    titleEn: 'Capacity assessment & legal homologation',
    descFr:
      'Évaluations psychosociales et médicales de l’inaptitude validées, signature par le représentant légal (mandat homologué, tutelle ou curatelle).',
    descEn:
      'Validated psychosocial and medical incapacity assessments, signed by the legal representative (homologated mandate, tutorship or curatorship).',
  },
];

interface CommonSpaceRow {
  key: 'diningRoom' | 'lounges' | 'activityRoom' | 'terrace';
  labelFr: string;
  labelEn: string;
  capacity: number | null;
  floor: string;
  freeText: string;
  icon: React.ReactNode;
}

interface ParkingRow {
  key: 'residents' | 'visitors' | 'employees';
  labelFr: string;
  labelEn: string;
  spots: number | null;
}

interface SpacesAndParkingSnapshot {
  occupancyPct: number | null;
  commonSpaces: CommonSpaceRow[];
  parking: ParkingRow[];
  totalParking: number;
}

function readStringValue(
  source: Record<string, unknown>,
  keys: ReadonlyArray<string>
): string {
  for (const key of keys) {
    const raw = source[key];
    if (raw === null || raw === undefined) continue;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed) return trimmed;
    } else if (typeof raw === 'number' && Number.isFinite(raw)) {
      return String(raw);
    }
  }
  return '';
}

function readBooleanValue(
  source: Record<string, unknown>,
  keys: ReadonlyArray<string>
): boolean | null {
  for (const key of keys) {
    const raw = source[key];
    if (raw === null || raw === undefined || raw === '') continue;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') {
      if (raw === 1) return true;
      if (raw === 0) return false;
    }
    if (typeof raw === 'string') {
      const v = raw.trim().toLowerCase();
      if (['true', 'oui', 'yes', 'complet', 'complets', '1'].includes(v)) return true;
      if (['false', 'non', 'no', 'aucun', 'absent', '0'].includes(v)) return false;
    }
  }
  return null;
}

function readNumericValue(
  source: Record<string, unknown>,
  keys: ReadonlyArray<string>
): number | null {
  for (const key of keys) {
    const raw = source[key];
    if (raw === null || raw === undefined || raw === '') continue;
    const value =
      typeof raw === 'string' ? parseFloat(raw.replace(/[^\d.-]/g, '')) : Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function resolveUnitsComfortSnapshot(
  doc: Record<string, unknown> | null
): UnitsComfortSnapshot {
  const source = doc ?? {};
  return {
    salleDeBainPrivee: readBooleanValue(source, ['salleDeBainPrivee', 'privateBathroom']),
    detailsSalleDeBainPrivee: readStringValue(source, [
      'detailsSalleDeBainPrivee',
      'privateBathroomDetails',
    ]),
    nombreUnitesAvecSDBPartagee: readNumericValue(source, [
      'nombreUnitesAvecSDBPartagee',
      'sharedBathroomUnits',
    ]),
    cuisinette: readBooleanValue(source, ['cuisinette', 'kitchenette']),
    nombreUnitesAvecCuisinette: readNumericValue(source, [
      'nombreUnitesAvecCuisinette',
      'kitchenetteUnits',
    ]),
    balconPatio: readBooleanValue(source, ['balconPatio', 'balcony', 'patio']),
    nombreUnitesAvecBalcon: readNumericValue(source, [
      'nombreUnitesAvecBalcon',
      'balconyUnits',
    ]),
    meuble: readBooleanValue(source, ['meuble', 'furnished']),
    typeMeublement: readStringValue(source, ['typeMeublement', 'furnishingType']),
    detailsUnitesProtegees: readStringValue(source, [
      'detailsUnitesProtegees',
      'detailsAlzheimer',
      'protectedUnitsDetails',
    ]),
    alzIssueControlee: readBooleanValue(source, [
      'alzIssueControlee',
      'issuesControlees',
      'securiteAntifugue',
      'antiFugueControl',
      'secureExitsControl',
    ]),
    alzApprocheScpd: readBooleanValue(source, [
      'alzApprocheScpd',
      'approcheSCPD',
      'approcheScpd',
      'formationScpd',
      'scpdApproach',
      'bpsdApproach',
    ]),
    alzEntenteCisss: readBooleanValue(source, [
      'alzEntenteCisss',
      'ententeCisss',
      'ententeCiusss',
      'cisssAgreement',
      'healthNetworkAgreement',
    ]),
    alzAnnexe6: readBooleanValue(source, [
      'alzAnnexe6',
      'annexe6Tal',
      'annexeVITal',
      'talSchedule6',
      'leaseSchedule6',
    ]),
    alzInaptitudeValide: readBooleanValue(source, [
      'alzInaptitudeValide',
      'evaluationInaptitude',
      'inaptitudeValidee',
      'mandatHomologue',
      'incapacityAssessment',
      'homologatedMandate',
    ]),
  };
}

function TernaryToggle({
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
  const items: Array<{ key: string; tile: TernaryBool; label: string }> = [
    { key: 'yes', tile: true, label: language === 'fr' ? 'OUI' : 'YES' },
    { key: 'no', tile: false, label: language === 'fr' ? 'NON' : 'NO' },
    { key: 'unknown', tile: null, label: '—' },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex gap-2"
    >
      {items.map(({ key, tile, label }) => {
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
              'min-w-[68px] rounded-xl border-2 px-4 py-2 text-[16px] font-black uppercase tracking-wider transition-colors',
              active
                ? 'border-black bg-black text-white shadow-sm'
                : 'border-black bg-white text-black hover:bg-slate-50',
              disabled && 'cursor-not-allowed opacity-60'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ComfortRow({
  icon,
  label,
  language,
  toggle,
  detail,
  placeholderFr,
  placeholderEn,
}: {
  icon: React.ReactNode;
  label: { fr: string; en: string };
  language: 'fr' | 'en';
  toggle: React.ReactNode;
  detail: React.ReactNode;
  placeholderFr: string;
  placeholderEn: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-black/10 bg-[#fafaf6] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-black">
            {icon}
          </span>
          <p className="text-[15px] font-black uppercase tracking-wide text-[#142c6a]">
            {language === 'fr' ? label.fr : label.en}
          </p>
        </div>
        <div>{toggle}</div>
      </div>
      <p className="mt-3 text-[16px] font-black leading-relaxed text-black">
        {detail ?? (
          <span className="italic font-semibold text-black/40">
            {language === 'fr' ? placeholderFr : placeholderEn}
          </span>
        )}
      </p>
    </div>
  );
}

function AlzheimerComplianceRow({
  rule,
  value,
  onToggle,
  disabled,
  language,
}: {
  rule: AlzheimerRule;
  value: TernaryBool;
  onToggle: (next: TernaryBool) => void;
  disabled: boolean;
  language: 'fr' | 'en';
}) {
  const title = language === 'fr' ? rule.titleFr : rule.titleEn;
  const description = language === 'fr' ? rule.descFr : rule.descEn;
  const isCompliant = value === true;
  const isNonCompliant = value === false;

  return (
    <div
      className={cn(
        'rounded-2xl border-2 bg-white p-4 transition-colors',
        isNonCompliant
          ? 'border-red-700 bg-red-50'
          : isCompliant
            ? 'border-emerald-700 bg-emerald-50/60'
            : 'border-violet-300'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-700 text-[16px] font-black text-white"
            aria-hidden
          >
            {rule.letter}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-black uppercase tracking-wide text-violet-900">
                {`${rule.letter}. ${title}`}
              </p>
              {isCompliant ? (
                <span
                  className="inline-flex items-center gap-1 rounded-md border-2 border-emerald-700 bg-emerald-600 px-2 py-0.5 text-[12px] font-black uppercase tracking-wider text-white"
                  role="status"
                >
                  ✓ {language === 'fr' ? 'CONFORME' : 'COMPLIANT'}
                </span>
              ) : null}
              {isNonCompliant ? (
                <span
                  className="inline-flex items-center gap-1 rounded-md border-2 border-red-800 bg-red-600 px-2 py-0.5 text-[12px] font-black uppercase tracking-wider text-white"
                  role="alert"
                >
                  ⚠️{' '}
                  {language === 'fr'
                    ? 'NON-CONFORME AU QUÉBEC'
                    : 'NON-COMPLIANT IN QUEBEC'}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-[15px] font-semibold leading-relaxed text-black">
              {description}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <TernaryToggle
            value={value}
            onChange={onToggle}
            disabled={disabled}
            language={language}
            ariaLabel={title}
          />
        </div>
      </div>
    </div>
  );
}

function RpaUnitsComfortPanel({
  snapshot,
  language,
  onToggleBinary,
  disabled,
}: {
  snapshot: UnitsComfortSnapshot;
  language: 'fr' | 'en';
  onToggleBinary: (field: UnitsBinaryKey, value: TernaryBool) => void;
  disabled: boolean;
}) {
  const bathDetail =
    snapshot.salleDeBainPrivee === true && snapshot.detailsSalleDeBainPrivee
      ? `${language === 'fr' ? 'Privées' : 'Private'} — ${snapshot.detailsSalleDeBainPrivee}`
      : snapshot.salleDeBainPrivee === false &&
          snapshot.nombreUnitesAvecSDBPartagee != null &&
          snapshot.nombreUnitesAvecSDBPartagee > 0
        ? language === 'fr'
          ? `Partagées · ${snapshot.nombreUnitesAvecSDBPartagee} unités concernées`
          : `Shared · ${snapshot.nombreUnitesAvecSDBPartagee} units affected`
        : snapshot.salleDeBainPrivee === true
          ? language === 'fr'
            ? 'Salles de bain privées — détails à compléter'
            : 'Private bathrooms — details to be added'
          : snapshot.salleDeBainPrivee === false
            ? language === 'fr'
              ? 'Salles de bain partagées — nombre d’unités à confirmer'
              : 'Shared bathrooms — unit count to be confirmed'
            : null;

  const kitchenDetail =
    snapshot.cuisinette === true && snapshot.nombreUnitesAvecCuisinette != null
      ? language === 'fr'
        ? `${snapshot.nombreUnitesAvecCuisinette} unités équipées d’une cuisinette`
        : `${snapshot.nombreUnitesAvecCuisinette} units with kitchenette`
      : snapshot.cuisinette === true
        ? language === 'fr'
          ? 'Cuisinette présente — préciser le nombre d’unités équipées'
          : 'Kitchenette present — specify number of equipped units'
        : snapshot.cuisinette === false
          ? language === 'fr'
            ? 'Aucune cuisinette — repas en salle à manger commune'
            : 'No kitchenette — meals in shared dining room'
          : null;

  const balconDetail =
    snapshot.balconPatio === true && snapshot.nombreUnitesAvecBalcon != null
      ? language === 'fr'
        ? `${snapshot.nombreUnitesAvecBalcon} unités avec balcon ou patio`
        : `${snapshot.nombreUnitesAvecBalcon} units with balcony or patio`
      : snapshot.balconPatio === true
        ? language === 'fr'
          ? 'Balcons / patios présents — préciser le nombre d’unités'
          : 'Balconies / patios present — specify number of units'
        : snapshot.balconPatio === false
          ? language === 'fr'
            ? 'Sans balcon ni patio privatif'
            : 'No private balcony or patio'
          : null;

  const meubleDetail = snapshot.meuble === true
    ? snapshot.typeMeublement
      ? language === 'fr'
        ? `Meublé — ${snapshot.typeMeublement}`
        : `Furnished — ${snapshot.typeMeublement}`
      : language === 'fr'
        ? 'Meublé — préciser le type de meublement (complet / partiel)'
        : 'Furnished — specify furnishing scope (full / partial)'
    : snapshot.meuble === false
      ? language === 'fr'
        ? 'Non meublé — locataires apportent leur mobilier'
        : 'Unfurnished — tenants supply their own furniture'
      : null;

  return (
    <section className="rounded-2xl border-2 border-black/10 border-l-[8px] border-l-amber-500 bg-white p-5 shadow-sm">
      <header className="mb-5 flex items-start gap-3">
        <BedDouble className="h-6 w-6 shrink-0 text-amber-600" aria-hidden />
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#142c6a]">
            {language === 'fr'
              ? '[ UNITÉS — CONFORT & ACCESSIBILITÉ ]'
              : '[ UNITS — COMFORT & ACCESSIBILITY ]'}
          </p>
          <p className="mt-1 text-[15px] font-semibold leading-relaxed text-slate-800">
            {language === 'fr'
              ? 'Caractéristiques physiques visibles par l’acheteur et critiques pour la diligence raisonnable RPA.'
              : 'Physical features visible to the buyer and critical for RPA due diligence.'}
          </p>
        </div>
      </header>

      <div className="space-y-5">
        <div>
          <h3 className="mb-3 text-[15px] font-black uppercase tracking-wide text-[#142c6a]">
            {language === 'fr' ? 'Configuration des bains' : 'Bathroom configuration'}
          </h3>
          <ComfortRow
            icon={<Bath className="h-5 w-5" aria-hidden />}
            label={{
              fr: 'Salle de bain privée',
              en: 'Private bathroom',
            }}
            language={language}
            toggle={
              <TernaryToggle
                value={snapshot.salleDeBainPrivee}
                onChange={(next) => onToggleBinary('salleDeBainPrivee', next)}
                disabled={disabled}
                language={language}
                ariaLabel={
                  language === 'fr' ? 'Salle de bain privée' : 'Private bathroom'
                }
              />
            }
            detail={bathDetail}
            placeholderFr="Aucun détail saisi sur la configuration des salles de bain."
            placeholderEn="No detail captured for bathroom configuration."
          />
        </div>

        <div>
          <h3 className="mb-3 text-[15px] font-black uppercase tracking-wide text-[#142c6a]">
            {language === 'fr' ? 'Équipements de séjour' : 'Living amenities'}
          </h3>
          <div className="space-y-3">
            <ComfortRow
              icon={<Utensils className="h-5 w-5" aria-hidden />}
              label={{ fr: 'Cuisinette', en: 'Kitchenette' }}
              language={language}
              toggle={
                <TernaryToggle
                  value={snapshot.cuisinette}
                  onChange={(next) => onToggleBinary('cuisinette', next)}
                  disabled={disabled}
                  language={language}
                  ariaLabel={language === 'fr' ? 'Cuisinette' : 'Kitchenette'}
                />
              }
              detail={kitchenDetail}
              placeholderFr="Présence d’une cuisinette à confirmer."
              placeholderEn="Kitchenette presence to be confirmed."
            />
            <ComfortRow
              icon={<BedDouble className="h-5 w-5" aria-hidden />}
              label={{ fr: 'Balcon / patio', en: 'Balcony / patio' }}
              language={language}
              toggle={
                <TernaryToggle
                  value={snapshot.balconPatio}
                  onChange={(next) => onToggleBinary('balconPatio', next)}
                  disabled={disabled}
                  language={language}
                  ariaLabel={language === 'fr' ? 'Balcon ou patio' : 'Balcony or patio'}
                />
              }
              detail={balconDetail}
              placeholderFr="Information balcon / patio à compléter."
              placeholderEn="Balcony / patio information to be filled."
            />
            <ComfortRow
              icon={<BedDouble className="h-5 w-5" aria-hidden />}
              label={{ fr: 'Meublement', en: 'Furnishing' }}
              language={language}
              toggle={
                <TernaryToggle
                  value={snapshot.meuble}
                  onChange={(next) => onToggleBinary('meuble', next)}
                  disabled={disabled}
                  language={language}
                  ariaLabel={language === 'fr' ? 'Unités meublées' : 'Furnished units'}
                />
              }
              detail={meubleDetail}
              placeholderFr="Statut du meublement à confirmer."
              placeholderEn="Furnishing status to be confirmed."
            />
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-[15px] font-black uppercase tracking-wide text-[#142c6a]">
            {language === 'fr'
              ? 'Section cognitive / Alzheimer'
              : 'Cognitive / Alzheimer section'}
          </h3>
          <div
            className="rounded-2xl border-2 border-violet-700 bg-violet-50 p-4"
            role="region"
            aria-label={
              language === 'fr' ? 'Détails unités protégées' : 'Protected units details'
            }
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-700 text-white">
                <Brain className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[15px] font-black uppercase tracking-wide text-violet-900">
                  {language === 'fr'
                    ? 'Lits sécurisés / unités protégées · catégorie 4 (unité prothétique)'
                    : 'Secured beds / protected units · category 4 (prosthetic unit)'}
                </p>
                <p className="mt-1 text-[13px] font-semibold leading-relaxed text-violet-900/80">
                  {language === 'fr'
                    ? 'Cinq normes obligatoires applicables au Québec pour l’hébergement en unité prothétique.'
                    : 'Five mandatory standards required in Quebec for prosthetic-unit housing.'}
                </p>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-line text-[16px] font-black leading-relaxed text-black">
              {snapshot.detailsUnitesProtegees ? (
                snapshot.detailsUnitesProtegees
              ) : (
                <span className="italic font-semibold text-black/40">
                  {language === 'fr'
                    ? 'Aucun détail saisi pour les lits sécurisés / cognitifs.'
                    : 'No detail captured for secured / cognitive units.'}
                </span>
              )}
            </p>

            <div className="mt-4 space-y-3">
              {ALZHEIMER_RULES.map((rule) => (
                <AlzheimerComplianceRow
                  key={rule.key}
                  rule={rule}
                  value={snapshot[rule.key]}
                  onToggle={(next) => onToggleBinary(rule.key, next)}
                  disabled={disabled}
                  language={language}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function normalizeOccupancyPct(raw: number | null): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  if (raw <= 0) return 0;
  if (raw <= 1) return Math.min(100, raw * 100);
  return Math.min(100, raw);
}

function resolveSpacesAndParkingSnapshot(
  doc: Record<string, unknown> | null
): SpacesAndParkingSnapshot {
  const source = doc ?? {};

  const rawOccupancy = readNumericValue(source, [
    'occupancyRate',
    'tauxOccupation',
    'tauxOccupationPct',
    'tauxOccupationGlobal',
  ]);
  const occupancyPct = normalizeOccupancyPct(rawOccupancy);

  const commonSpaces: CommonSpaceRow[] = [
    {
      key: 'diningRoom',
      labelFr: 'Salle à manger',
      labelEn: 'Dining room',
      capacity: readNumericValue(source, ['capaciteSalleAManger', 'diningRoomCapacity']),
      floor: readStringValue(source, ['etageSalleAManger', 'diningRoomFloor']),
      freeText: '',
      icon: <UtensilsCrossed className="h-5 w-5" aria-hidden />,
    },
    {
      key: 'lounges',
      labelFr: 'Salons',
      labelEn: 'Lounges',
      capacity: readNumericValue(source, ['capaciteSalons', 'loungesCapacity']),
      floor: readStringValue(source, ['etageSalons', 'loungesFloor']),
      freeText: '',
      icon: <Sofa className="h-5 w-5" aria-hidden />,
    },
    {
      key: 'activityRoom',
      labelFr: 'Salle d’activités',
      labelEn: 'Activity room',
      capacity: readNumericValue(source, [
        'capaciteSalleActivites',
        'activityRoomCapacity',
      ]),
      floor: readStringValue(source, ['etageSalleActivites', 'activityRoomFloor']),
      freeText: '',
      icon: <Users2 className="h-5 w-5" aria-hidden />,
    },
    {
      key: 'terrace',
      labelFr: 'Terrasse / cour extérieure',
      labelEn: 'Terrace / outdoor court',
      capacity: null,
      floor: '',
      freeText: readStringValue(source, [
        'terrasseCourExterieure',
        'outdoorCourtyard',
      ]),
      icon: <TreePine className="h-5 w-5" aria-hidden />,
    },
  ];

  const parking: ParkingRow[] = [
    {
      key: 'residents',
      labelFr: 'Résidents',
      labelEn: 'Residents',
      spots: readNumericValue(source, ['stationnementResidents', 'parkingResidents']),
    },
    {
      key: 'visitors',
      labelFr: 'Visiteurs',
      labelEn: 'Visitors',
      spots: readNumericValue(source, ['stationnementVisiteurs', 'parkingVisitors']),
    },
    {
      key: 'employees',
      labelFr: 'Employés',
      labelEn: 'Employees',
      spots: readNumericValue(source, ['stationnementEmployes', 'parkingEmployees']),
    },
  ];

  const totalParking = parking.reduce(
    (sum, row) => sum + (row.spots != null && Number.isFinite(row.spots) ? row.spots : 0),
    0
  );

  return { occupancyPct, commonSpaces, parking, totalParking };
}

function occupancyPalette(pct: number | null): {
  bar: string;
  badge: string;
  badgeFr: string;
  badgeEn: string;
} {
  if (pct == null) {
    return {
      bar: 'bg-slate-300',
      badge: 'bg-slate-200 text-slate-900 border-slate-700',
      badgeFr: 'À VALIDER',
      badgeEn: 'TO VALIDATE',
    };
  }
  if (pct < 75) {
    return {
      bar: 'bg-red-600',
      badge: 'bg-red-600 text-white border-red-700',
      badgeFr: 'ALERTE',
      badgeEn: 'ALERT',
    };
  }
  if (pct < 90) {
    return {
      bar: 'bg-amber-500',
      badge: 'bg-amber-500 text-black border-amber-700',
      badgeFr: 'SURVEILLANCE',
      badgeEn: 'WATCH',
    };
  }
  return {
    bar: 'bg-emerald-600',
    badge: 'bg-emerald-600 text-white border-emerald-700',
    badgeFr: 'OPTIMAL',
    badgeEn: 'OPTIMAL',
  };
}

function RpaSpacesAndParkingPanel({
  snapshot,
  language,
}: {
  snapshot: SpacesAndParkingSnapshot;
  language: 'fr' | 'en';
}) {
  const palette = occupancyPalette(snapshot.occupancyPct);
  const placeholder = language === 'fr' ? '—' : '—';
  const naLabel = language === 'fr' ? 'NON RENSEIGNÉ' : 'NOT PROVIDED';
  const occupancyLabel =
    snapshot.occupancyPct != null
      ? `${snapshot.occupancyPct.toFixed(0)} %`
      : naLabel;
  const fillWidth = snapshot.occupancyPct != null ? Math.min(100, Math.max(0, snapshot.occupancyPct)) : 0;
  const barAriaValue = snapshot.occupancyPct != null ? Math.round(snapshot.occupancyPct) : 0;

  return (
    <section
      className="rounded-2xl border-2 border-[#142c6a] bg-white p-5 shadow-sm"
      aria-labelledby="spaces-parking-title"
    >
      <header className="mb-5 flex items-start gap-3">
        <Gauge className="h-6 w-6 shrink-0 text-[#142c6a]" aria-hidden />
        <div>
          <p
            id="spaces-parking-title"
            className="text-[13px] font-black uppercase tracking-[0.18em] text-[#142c6a]"
          >
            {language === 'fr'
              ? '[ OCCUPATION, ESPACES COMMUNS & STATIONNEMENT ]'
              : '[ OCCUPANCY, COMMON SPACES & PARKING ]'}
          </p>
          <p className="mt-1 text-[15px] font-semibold leading-relaxed text-slate-800">
            {language === 'fr'
              ? 'Indicateur d’occupation, capacité des espaces communs et offre de stationnement — données critiques de visite.'
              : 'Occupancy indicator, common space capacity and parking offer — critical on-site data.'}
          </p>
        </div>
      </header>

      <div className="space-y-5">
        <div className="rounded-2xl border-2 border-black/10 bg-[#f1f5f9] p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[15px] font-black uppercase tracking-wide text-[#142c6a]">
                {language === 'fr' ? 'Taux d’occupation global' : 'Global occupancy rate'}
              </p>
              <p className="mt-2 text-[36px] font-black tabular-nums leading-none text-black">
                {occupancyLabel}
              </p>
            </div>
            <span
              className={cn(
                'inline-flex items-center justify-center rounded-lg border-2 px-3 py-1 text-[13px] font-black uppercase tracking-wider',
                palette.badge
              )}
            >
              {language === 'fr' ? palette.badgeFr : palette.badgeEn}
            </span>
          </div>
          <div
            className="mt-4 h-3 w-full rounded-none border border-black/30 bg-white"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={barAriaValue}
          >
            <div
              className={cn('h-full', palette.bar)}
              style={{ width: `${fillWidth}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px] font-black uppercase tracking-wider text-slate-700">
            <span>0 %</span>
            <span className="text-red-700">75 %</span>
            <span className="text-amber-700">90 %</span>
            <span>100 %</span>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-[15px] font-black uppercase tracking-wide text-[#142c6a]">
            {language === 'fr' ? 'Espaces communs' : 'Common spaces'}
          </h3>
          <div className="overflow-hidden rounded-2xl border-2 border-black/10">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#142c6a] text-white">
                  <th className="px-4 py-2 text-left text-[12px] font-black uppercase tracking-wider">
                    {language === 'fr' ? 'Espace' : 'Space'}
                  </th>
                  <th className="px-4 py-2 text-left text-[12px] font-black uppercase tracking-wider">
                    {language === 'fr' ? 'Capacité' : 'Capacity'}
                  </th>
                  <th className="px-4 py-2 text-left text-[12px] font-black uppercase tracking-wider">
                    {language === 'fr' ? 'Étage / Note' : 'Floor / Note'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {snapshot.commonSpaces.map((row, idx) => {
                  const isTerrace = row.key === 'terrace';
                  const capacityCell = isTerrace
                    ? row.freeText
                      ? row.freeText
                      : null
                    : row.capacity != null
                      ? language === 'fr'
                        ? `${row.capacity} places`
                        : `${row.capacity} seats`
                      : null;
                  const floorCell = isTerrace
                    ? row.freeText
                      ? language === 'fr'
                        ? 'Espace extérieur'
                        : 'Outdoor space'
                      : null
                    : row.floor || null;
                  return (
                    <tr
                      key={row.key}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-[#fafaf6]'}
                    >
                      <td className="border-t border-black/10 px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-black">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#142c6a] text-white">
                            {row.icon}
                          </span>
                          {language === 'fr' ? row.labelFr : row.labelEn}
                        </span>
                      </td>
                      <td className="border-t border-black/10 px-4 py-3 text-[15px] font-semibold text-black">
                        {capacityCell ?? (
                          <span className="italic font-semibold text-black/40">
                            {placeholder}
                          </span>
                        )}
                      </td>
                      <td className="border-t border-black/10 px-4 py-3 text-[15px] font-semibold text-black">
                        {floorCell ?? (
                          <span className="italic font-semibold text-black/40">
                            {placeholder}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-[15px] font-black uppercase tracking-wide text-[#142c6a]">
            {language === 'fr' ? 'Stationnement' : 'Parking'}
          </h3>
          <div className="overflow-hidden rounded-2xl border-2 border-black/10">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#142c6a] text-white">
                  <th className="px-4 py-2 text-left text-[12px] font-black uppercase tracking-wider">
                    {language === 'fr' ? 'Type' : 'Type'}
                  </th>
                  <th className="px-4 py-2 text-right text-[12px] font-black uppercase tracking-wider">
                    {language === 'fr' ? 'Places' : 'Spots'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {snapshot.parking.map((row, idx) => (
                  <tr
                    key={row.key}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-[#fafaf6]'}
                  >
                    <td className="border-t border-black/10 px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-black">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500 text-black">
                          <CarFront className="h-5 w-5" aria-hidden />
                        </span>
                        {language === 'fr' ? row.labelFr : row.labelEn}
                      </span>
                    </td>
                    <td className="border-t border-black/10 px-4 py-3 text-right text-[15px] font-semibold tabular-nums text-black">
                      {row.spots != null ? (
                        row.spots
                      ) : (
                        <span className="italic font-semibold text-black/40">
                          {placeholder}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border-2 border-amber-700 bg-amber-100 px-4 py-3">
            <span className="text-[13px] font-black uppercase tracking-wider text-amber-900">
              {language === 'fr' ? 'Total des places' : 'Total spots'}
            </span>
            <span className="text-[18px] font-black tabular-nums text-black">
              {snapshot.totalParking}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function IdentiteImmeubleTab({ residence }: IdentiteImmeubleTabProps) {
  const { language, t } = useLanguage();
  const { profile } = useAuth();
  const {
    residenceDoc,
    loading,
    error,
    isInProvider,
    saving,
    saveError,
    updateResidence,
  } = useResidenceDocument();

  const lang = language === 'fr' ? 'fr' : 'en';

  const docWithHints = useMemo(() => {
    if (!residenceDoc) return null;
    return {
      ...residenceDoc,
      address: residenceDoc.address ?? residence.address,
      city: residenceDoc.city ?? residence.city,
      price: residence.price,
      prixDemande: residence.price,
    } as Record<string, unknown>;
  }, [residenceDoc, residence]);

  const view = useMemo(
    () => buildIdentityViewModel(docWithHints, { loading }),
    [docWithHints, loading]
  );

  const unitsComfortSnapshot = useMemo(
    () => resolveUnitsComfortSnapshot(docWithHints),
    [docWithHints]
  );

  const spacesAndParkingSnapshot = useMemo(
    () => resolveSpacesAndParkingSnapshot(docWithHints),
    [docWithHints]
  );

  const handleUnitsBinaryToggle = useCallback(
    (field: UnitsBinaryKey, value: TernaryBool) => {
      const patch: Record<string, unknown> = {
        [UNITS_BINARY_KEYS[field]]: value,
      };
      void updateResidence(patch);
    },
    [updateResidence]
  );

  const establishmentSection = view.sections.find((s) => s.id === 'establishment');
  const legalSection = view.sections.find((s) => s.id === 'legal');

  const courtiersResponsables =
    typeof residenceDoc?.courtiersResponsables === 'string'
      ? residenceDoc.courtiersResponsables
      : residence.courtiersResponsables;

  if (!isInProvider) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        {t(
          'Provider document résidence manquant.',
          'Residence document provider missing.'
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-16 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
          {t('Chargement de l’identité…', 'Loading identity…')}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-900">
        {t('Erreur Firestore', 'Firestore error')}: {error.message}
      </div>
    );
  }

  if (!view.hasDocument) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-10">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-700">
              {t('Identité & immeuble', 'Identity & building')}
            </p>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">
              {t(
                'Document résidence introuvable ou vide.',
                'Residence document not found or empty.'
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête institutionnel + statut d'enregistrement */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[#D4AF37]" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              {t('Identité fusionnée', 'Unified identity')}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              {t('Édition par section', 'Section editing')} · ID {residence.id}
              {saving ? ` · ${t('Enregistrement…', 'Saving…')}` : ''}
            </p>
          </div>
        </div>
      </div>

      {saveError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {saveError}
        </div>
      ) : null}

      {/* Parties CRM — liaisons contacts ↔ fiche résidence (bloc prioritaire haut de fiche) */}
      <PartiesIntervenantsSection />

      {/* Bannière contextuelle d'enrichissement MSSS depuis Copilote */}
      <MsssEnrichmentBanner show={view.showMsssBanner} msss={view.msss} language={lang} />

      {/* Sommaire de la fiche (nom, type, unités, région, adresse) */}
      <IdentityOverviewStrip overview={view.overview} language={lang} />

      {/* A · Identification de l'établissement (nom, contacts, dates) */}
      {establishmentSection && profile?.uid ? (
        <EditableIdentitySection
          section={establishmentSection}
          language={lang}
          leadingContent={
            <ResponsibleBrokerCard
              brokerId={profile.uid}
              brokerDisplayName={profile.displayName}
              courtiersResponsables={courtiersResponsables}
            />
          }
        />
      ) : null}

      {/* B · Structure juridique & propriétaire */}
      {legalSection && <EditableIdentitySection section={legalSection} language={lang} />}

      {/* C · Cadre réglementaire MSSS / RQRA (Lot R1) */}
      <MsssComplianceSection language={lang} />

      {/* D · Caractéristiques physiques, unités & confort (Sprint 3.2) */}
      <RpaUnitsComfortPanel
        snapshot={unitsComfortSnapshot}
        language={lang}
        onToggleBinary={handleUnitsBinaryToggle}
        disabled={saving}
      />

      {/* E · Occupation, espaces communs & stationnement (Sprint 3.3) */}
      <RpaSpacesAndParkingPanel
        snapshot={spacesAndParkingSnapshot}
        language={lang}
      />

      {/* F · Vérification du bâtiment & cadastre (JLR) */}
      <BuildingAuditPanel blocks={view.buildingAudit} language={lang} />

      {/* Compléments — tarification des loyers et capacité fine */}
      <RentPricingTableSection rentPricing={view.rentPricing} language={lang} />

      {docWithHints && <EditableCapacitySection residenceDoc={docWithHints} language={lang} />}

      {view.capacity.agePyramid.length > 0 && (
        <IdentitySectionCard
          title={lang === 'fr' ? 'Pyramide des âges — clientèle' : 'Age pyramid — clientele'}
          accent="#059669"
        >
          <div className="space-y-2">
            {view.capacity.agePyramid.map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs font-semibold text-[#142c6a]">
                  {row.label}
                </span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500/80"
                    style={{ width: `${Math.min(100, row.pct)}%` }}
                  />
                </div>
                <span className="w-20 text-right text-xs font-mono text-slate-600">
                  {row.count} ({row.pct.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </IdentitySectionCard>
      )}

      {view.criticalGaps.length > 0 && !view.showMsssBanner && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            {t(
              'Certaines sections sont incomplètes. Complétez la fiche ou lancez un enrichissement MSSS depuis Copilote.',
              'Some sections are incomplete. Complete the file or run MSSS enrichment from Copilote.'
            )}
          </p>
        </div>
      )}
    </div>
  );
}
