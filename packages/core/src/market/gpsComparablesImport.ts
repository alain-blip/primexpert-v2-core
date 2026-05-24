/**
 * Import / export CSV — comparables GPS (port V1 Copilote).
 * Séparateur : virgule ou point-virgule (détection sur la 1re ligne).
 */

export const GPS_COMPARABLES_CSV_HEADER =
  'canal_import;ville;prix_vente;prix_mise_en_marche;nombre_unites;prix_par_unite;dom;date_vente;region;classe_immeuble';

export const GPS_COMPARABLES_CSV_EXAMPLE =
  'Centris;Montréal;8500000;8990000;96;88542;210;2024-06-15;06 Montréal;RPA';

export interface GpsComparableCsvRow {
  canal_import: 'CoStar' | 'Centris';
  ville_comparable: string;
  prix_vente: number;
  prix_mise_en_marche: number | null;
  nombre_unites: number | null;
  prix_par_unite: number | null;
  dom: number | null;
  date_vente: string | null;
  region: string | null;
  classe_immeuble: string | null;
  ecart_liste_vente_pct: number | null;
}

function normHeader(h: string): string {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '');
}

function detectDelimiter(line: string): ',' | ';' {
  const semi = (line.match(/;/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  return semi >= comma ? ';' : ',';
}

function parseCsvLine(line: string, delim: ',' | ';'): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && c === delim) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** @param text — contenu fichier UTF-8 */
export function parseGpsComparablesCsv(text: string): {
  rows: GpsComparableCsvRow[];
  errors: string[];
} {
  const raw = String(text).replace(/^\uFEFF/, '').trim();
  if (!raw) return { rows: [], errors: ['Fichier vide'] };

  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      rows: [],
      errors: ['Le CSV doit contenir une ligne d’en-tête et au moins une ligne de données'],
    };
  }

  const delim = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delim).map(normHeader);

  const col = (aliases: string[]) => {
    for (const a of aliases) {
      const n = normHeader(a);
      const idx = headers.indexOf(n);
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const idxCanal = col(['canal_import', 'source', 'canal']);
  const idxVille = col(['ville', 'ville_comparable']);
  const idxPv = col(['prix_vente', 'prixvente', 'prix_de_vente']);
  const idxPm = col(['prix_mise_en_marche', 'prixliste', 'prix_affich', 'liste']);
  const idxNu = col(['nombre_unites', 'unites', 'nb_unites']);
  const idxPpu = col(['prix_par_unite', 'prixporte', 'prix_unite']);
  const idxDom = col(['dom', 'jours_sur_marche']);
  const idxDv = col(['date_vente', 'date']);
  const idxReg = col(['region', 'region_dossier']);
  const idxCl = col(['classe_immeuble', 'classe']);

  if (idxCanal < 0 || idxVille < 0 || idxPv < 0) {
    return {
      rows: [],
      errors: [
        'Colonnes obligatoires manquantes : canal_import (ou source), ville, prix_vente.',
      ],
    };
  }

  const rows: GpsComparableCsvRow[] = [];
  const errors: string[] = [];

  const parseNum = (s: string | undefined, opts: { integer?: boolean } = {}) => {
    if (s == null || String(s).trim() === '') return null;
    const cleaned = String(s).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = opts.integer ? parseInt(cleaned, 10) : parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], delim);
    const canalRaw = cells[idxCanal]?.trim();
    const canalNorm = canalRaw?.toLowerCase();
    let canal_import: GpsComparableCsvRow['canal_import'] | null = null;
    if (canalNorm === 'costar' || canalNorm === 'co-star') canal_import = 'CoStar';
    else if (canalNorm === 'centris') canal_import = 'Centris';

    const ville = cells[idxVille]?.trim();
    const prix_vente = parseNum(cells[idxPv]);

    if (!canal_import) {
      errors.push(
        `Ligne ${i + 1}: canal_import doit être « CoStar » ou « Centris » (reçu : « ${canalRaw || ''} »)`
      );
      continue;
    }
    if (!ville) {
      errors.push(`Ligne ${i + 1}: ville manquante`);
      continue;
    }
    if (prix_vente == null || prix_vente <= 0) {
      errors.push(`Ligne ${i + 1}: prix_vente invalide`);
      continue;
    }

    const nombre_unites = idxNu >= 0 ? parseNum(cells[idxNu], { integer: true }) : null;
    let prix_par_unite = idxPpu >= 0 ? parseNum(cells[idxPpu]) : null;
    if ((prix_par_unite == null || prix_par_unite <= 0) && nombre_unites != null && nombre_unites > 0) {
      prix_par_unite = Math.round(prix_vente / nombre_unites);
    }

    const prix_mise_en_marche = idxPm >= 0 ? parseNum(cells[idxPm]) : null;
    const dom = idxDom >= 0 ? parseNum(cells[idxDom], { integer: true }) : null;
    const date_vente = idxDv >= 0 ? String(cells[idxDv] || '').trim() || null : null;
    const region = idxReg >= 0 ? String(cells[idxReg] || '').trim() || null : null;
    const classe_immeuble = idxCl >= 0 ? String(cells[idxCl] || '').trim() || null : null;

    let ecart_liste_vente_pct: number | null = null;
    if (prix_mise_en_marche != null && prix_mise_en_marche > 0 && prix_vente > 0) {
      ecart_liste_vente_pct = ((prix_mise_en_marche - prix_vente) / prix_mise_en_marche) * 100;
    }

    rows.push({
      canal_import,
      ville_comparable: ville,
      prix_vente,
      prix_mise_en_marche: prix_mise_en_marche != null && prix_mise_en_marche > 0 ? prix_mise_en_marche : null,
      nombre_unites: nombre_unites != null && nombre_unites > 0 ? nombre_unites : null,
      prix_par_unite: prix_par_unite != null && prix_par_unite > 0 ? prix_par_unite : null,
      dom: dom != null && dom > 0 ? dom : null,
      date_vente,
      region,
      classe_immeuble,
      ecart_liste_vente_pct,
    });
  }

  return { rows, errors };
}

export function gpsComparablesCsvTemplateBody(): string {
  return `${GPS_COMPARABLES_CSV_HEADER}\n${GPS_COMPARABLES_CSV_EXAMPLE}\n`;
}

export function downloadGpsComparablesTemplate(): void {
  if (typeof document === 'undefined') return;
  const bom = '\uFEFF';
  const blob = new Blob([bom + gpsComparablesCsvTemplateBody()], {
    type: 'text/csv;charset=utf-8',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'modele_comparables_gps.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export interface GpsComparableExportRow {
  canal_import?: string | null;
  ville?: string | null;
  city?: string | null;
  address?: string | null;
  prix_vente?: number | null;
  prixVente?: number | null;
  prix_mise_en_marche?: number | null;
  nombre_unites?: number | null;
  nbPortes?: number | null;
  prix_par_unite?: number | null;
  prixParPorte?: number | null;
  dom?: number | null;
  date_vente?: string | null;
  date?: string | null;
  region?: string | null;
  classe_immeuble?: string | null;
  tgaPct?: number | null;
}

/** Exporte des lignes comparables filtrées vers CSV (navigateur). */
export function exportGpsComparablesCsv(
  rows: GpsComparableExportRow[],
  filenameStem = 'comparables_gps_export'
): void {
  if (typeof document === 'undefined') return;
  const header = GPS_COMPARABLES_CSV_HEADER.split(';');
  const lines = [GPS_COMPARABLES_CSV_HEADER];

  for (const row of rows) {
    const ville = row.ville ?? row.city ?? row.address ?? '';
    const pv = row.prix_vente ?? row.prixVente ?? '';
    const pm = row.prix_mise_en_marche ?? '';
    const nu = row.nombre_unites ?? row.nbPortes ?? '';
    const ppu = row.prix_par_unite ?? row.prixParPorte ?? '';
    const dv = row.date_vente ?? row.date ?? '';
    const cells = [
      row.canal_import ?? 'Centris',
      ville,
      pv,
      pm,
      nu,
      ppu,
      row.dom ?? '',
      dv,
      row.region ?? '',
      row.classe_immeuble ?? 'RPA',
    ].map((c) => String(c).replace(/;/g, ','));
    lines.push(cells.join(';'));
  }

  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filenameStem}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
