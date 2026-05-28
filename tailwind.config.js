/**
 * Charte couleurs PrimeXpert — SSOT pour Tailwind (classes primexpert-*).
 * Projet Vite + Tailwind v4 : ce fichier est chargé via @config dans src/index.css.
 */
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primexpert: {
          blue: '#2656b7', // Fond principal — cockpit / panneaux institutionnels
          blueDeep: '#001b42', // Fond principal en mode foncé (bleu nuit réglementaire PO)
          dark: '#142c6a', // Barre latérale Navigateur, cadres, en-têtes, encre
          light: '#f1f5f9', // Fonds de cartes et zones d'encre brute
          cardDark: '#daeefa', // Fond carte / tableau en mode foncé (bleu pâle réglementaire PO)
          gold: '#D4AF37', // Rappel promesse d'achat acceptée
        },
      },
    },
  },
};
