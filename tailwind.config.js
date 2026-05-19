/**
 * Charte couleurs PrimeXpert — SSOT pour Tailwind (classes primexpert-*).
 * Projet Vite + Tailwind v4 : ce fichier est chargé via @config dans src/index.css.
 */
/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        primexpert: {
          blue: '#2656b7', // Fond principal — cockpit / panneaux institutionnels
          dark: '#142c6a', // Barre latérale Navigateur, cadres, en-têtes, encre
          light: '#f1f5f9', // Fonds de cartes et zones d'encre brute
          gold: '#D4AF37', // Rappel promesse d'achat acceptée
        },
      },
    },
  },
};
