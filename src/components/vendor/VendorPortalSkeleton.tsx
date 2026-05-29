import React from 'react';
import { motion } from 'motion/react';
import {
  institutionalListingsCardShellClass,
  vendorPortalLayoutShellClass,
} from '../../lib/institutionalTheme';
import { cn } from '../../lib/utils';

export function VendorPortalSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('space-y-4 py-8', vendorPortalLayoutShellClass)}
    >
      <div className="h-8 w-48 animate-pulse rounded-lg bg-white dark:bg-primexpert-cardDark" />
      <div
        className={`h-24 animate-pulse rounded-2xl bg-white dark:bg-primexpert-cardDark ${institutionalListingsCardShellClass}`}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className={`h-40 animate-pulse rounded-2xl bg-white dark:bg-primexpert-cardDark ${institutionalListingsCardShellClass}`}
          />
        ))}
      </div>
      <div
        className={`h-32 animate-pulse rounded-2xl bg-white dark:bg-primexpert-cardDark ${institutionalListingsCardShellClass}`}
      />
    </motion.div>
  );
}
