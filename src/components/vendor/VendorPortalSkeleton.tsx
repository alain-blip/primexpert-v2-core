import React from 'react';
import { motion } from 'motion/react';
import { institutionalListingsCardShellClass } from '../../lib/institutionalTheme';

export function VendorPortalSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-3xl space-y-6 px-4 py-8"
      aria-busy
      aria-label="Chargement…"
    >
      <motion.div
        className="h-8 w-48 rounded-lg bg-white/60"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      />
      <motion.div
        className={`h-24 rounded-2xl bg-white/60 ${institutionalListingsCardShellClass}`}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 1.4, repeat: Infinity, delay: 0.1 }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <motion.div
            key={i}
            className={`h-40 rounded-2xl bg-white/60 ${institutionalListingsCardShellClass}`}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: 0.15 + i * 0.08 }}
          />
        ))}
      </div>
      <motion.div
        className={`h-32 rounded-2xl bg-white/60 ${institutionalListingsCardShellClass}`}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 1.4, repeat: Infinity, delay: 0.25 }}
      />
    </motion.div>
  );
}
