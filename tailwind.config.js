/**
 * Charte couleurs PrimeXpert — SSOT pour Tailwind (classes primexpert-*).
 * Projet Vite + Tailwind v4 : ce fichier est chargé via @config dans src/index.css.
 */
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        /** SPA V2.8 — aligné useResponsiveLayoutMode */
        mobile: { max: '767px' },
        tablet: { min: '768px', max: '1199px' },
        laptop: { min: '1200px' },
      },
      colors: {
        primexpert: {
          cockpit: '#0B0F19',
          blue: '#2656b7',
          blueDeep: '#001b42',
          dark: '#142c6a',
          light: '#f1f5f9',
          cardDark: '#daeefa',
          gold: '#D4AF37',
        },
      },
    },
  },
};
