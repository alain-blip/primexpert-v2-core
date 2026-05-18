/**
 * Déclaration du vendeur — export PDF officiel de conformité.
 */

import { doc, getDoc } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import {
  DECLARATION_SECTIONS,
  isDeclarationLockedStatus,
  normalizeDeclarationVendeur,
} from '@primexpert/core/declaration';
import type { DeclarationResponse } from '@primexpert/core/declaration';
import { db } from '../lib/firebase';

const RESPONSE_LABELS: Record<DeclarationResponse, { fr: string; en: string }> = {
  yes: { fr: 'Oui', en: 'Yes' },
  no: { fr: 'Non', en: 'No' },
  na: { fr: 'N/A', en: 'N/A' },
};

function pickAddress(data: Record<string, unknown>): string {
  const addr =
    (typeof data.address === 'string' && data.address) ||
    (typeof data.adresse === 'string' && data.adresse) ||
    '';
  const city =
    (typeof data.city === 'string' && data.city) ||
    (typeof data.ville === 'string' && data.ville) ||
    '';
  return [addr, city].filter(Boolean).join(', ') || '—';
}

function formatCertifiedAt(iso: string | undefined, locale: 'fr' | 'en'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * 4.5;
}

/**
 * Charge la fiche, génère le PDF certifié et déclenche le téléchargement.
 */
export async function generateDVDocument(
  residenceId: string,
  locale: 'fr' | 'en' = 'fr'
): Promise<void> {
  if (!residenceId) throw new Error('RESIDENCE_ID_REQUIRED');

  const snap = await getDoc(doc(db, 'residences', residenceId));
  if (!snap.exists()) throw new Error('RESIDENCE_NOT_FOUND');

  const data = snap.data() as Record<string, unknown>;
  const declaration = normalizeDeclarationVendeur(data);

  if (!isDeclarationLockedStatus(declaration.status)) {
    throw new Error('DECLARATION_NOT_CERTIFIED');
  }

  const L = locale === 'fr';
  const pdf = new jsPDF({ unit: 'mm', format: 'letter' });
  const margin = 18;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(L ? 'DÉCLARATION DU VENDEUR' : 'SELLER DISCLOSURE', margin, y);
  y += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`${L ? 'Résidence' : 'Property'} : ${pickAddress(data)}`, margin, y);
  y += 5;
  pdf.text(`ID : ${residenceId}`, margin, y);
  y += 5;
  pdf.text(
    `${L ? 'Certifiée le' : 'Certified on'} : ${formatCertifiedAt(declaration.certifiedAt, locale)}`,
    margin,
    y
  );
  y += 5;
  if (declaration.certifiedBy) {
    pdf.text(`${L ? 'Certifié par' : 'Certified by'} : ${declaration.certifiedBy}`, margin, y);
    y += 5;
  }
  if (declaration.confirmationTag) {
    pdf.setFont('courier', 'bold');
    pdf.text(`${L ? 'Code de sécurité' : 'Security code'} : ${declaration.confirmationTag}`, margin, y);
    pdf.setFont('helvetica', 'normal');
    y += 8;
  }

  pdf.setDrawColor(212, 175, 55);
  pdf.setLineWidth(0.4);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  for (const section of DECLARATION_SECTIONS) {
    if (y > 250) {
      pdf.addPage();
      y = 20;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(`${section.id} — ${L ? section.titleFr : section.titleEn}`, margin, y);
    y += 6;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);

    for (const q of section.questions) {
      if (y > 255) {
        pdf.addPage();
        y = 20;
      }

      const answer = declaration.answers[q.id];
      const response = answer?.response;
      const responseLabel = response
        ? RESPONSE_LABELS[response][locale]
        : L
          ? '—'
          : '—';

      pdf.setFont('helvetica', 'bold');
      y = wrapText(pdf, L ? q.labelFr : q.labelEn, margin, y, contentWidth);
      pdf.setFont('helvetica', 'normal');
      y += 1;
      pdf.text(`${L ? 'Réponse' : 'Answer'} : ${responseLabel}`, margin + 2, y);
      y += 5;

      const fieldValue = answer?.value?.trim();
      if (fieldValue) {
        y = wrapText(
          pdf,
          `${L ? 'Valeur' : 'Value'} : ${fieldValue}`,
          margin + 2,
          y,
          contentWidth - 4
        );
        y += 2;
      }

      const notes = answer?.notes?.trim();
      if (notes) {
        pdf.setFont('helvetica', 'italic');
        y = wrapText(
          pdf,
          `${L ? 'Notes' : 'Notes'} : ${notes}`,
          margin + 2,
          y,
          contentWidth - 4
        );
        pdf.setFont('helvetica', 'normal');
        y += 2;
      }
      y += 3;
    }
    y += 4;
  }

  const suffix = residenceId.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'DV';
  const tag = declaration.confirmationTag?.replace(/[^a-zA-Z0-9-]/g, '') ?? 'certifie';
  pdf.save(`DV-${suffix}-${tag}.pdf`);
}
