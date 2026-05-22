/// <reference types="vite/client" />

declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: { type?: string; quality?: number };
    html2canvas?: {
      scale?: number;
      logging?: boolean;
      useCORS?: boolean;
      letterRendering?: boolean;
      onclone?: (doc: Document) => void;
      [key: string]: unknown;
    };
    jsPDF?: Record<string, unknown>;
    pagebreak?: Record<string, unknown>;
  }
  interface Html2PdfWorker {
    set(options: Html2PdfOptions): Html2PdfWorker;
    from(element: HTMLElement): Html2PdfWorker;
    save(): Promise<void>;
  }
  function html2pdf(): Html2PdfWorker;
  export default html2pdf;
}

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_FIRESTORE_DATABASE_ID?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  /** `true` = Listings affiche des fiches fictives si le pipeline Firestore est vide (démo UX uniquement). */
  readonly VITE_USE_FICTITIOUS_DATA?: string;
  /** CraftMyPDF — rapport financier détaillé (Hub Finance). */
  readonly VITE_CRAFTMYPDF_API_KEY?: string;
  readonly VITE_CRAFTMYPDF_TEMPLATE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
