import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { institutionalListingsCardShellClass } from '../../lib/institutionalTheme';

export function VendorComplianceGauge({
  percent,
  label,
  sublabel,
  receivedCount,
  requiredCount,
}: {
  percent: number;
  label: string;
  sublabel: string;
  receivedCount?: number;
  requiredCount?: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = 54;
  const stroke = 10;
  const normalized = radius - stroke / 2;
  const circumference = normalized * 2 * Math.PI;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        `flex flex-col items-center p-6 bg-white dark:bg-primexpert-cardDark ${institutionalListingsCardShellClass}`
      )}
    >
      <div className="relative h-36 w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden>
          <circle
            cx="60"
            cy="60"
            r={normalized}
            fill="none"
            stroke="rgba(20,44,106,0.15)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx="60"
            cy="60"
            r={normalized}
            fill="none"
            stroke="#142c6a"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center text-slate-900"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <span className="text-4xl font-black tabular-nums text-black">{clamped}%</span>
        </motion.div>
      </div>
      <p className="mt-4 text-center text-sm font-black uppercase tracking-widest text-black">
        {label}
      </p>
      {requiredCount != null ? (
        <p className="mt-1 text-center text-[10px] font-bold uppercase tracking-widest text-primexpert-dark">
          {receivedCount ?? 0}/{requiredCount}
        </p>
      ) : null}
      <p className="mt-2 max-w-xs text-center text-xs font-semibold leading-relaxed text-slate-900">
        {sublabel}
      </p>
    </motion.div>
  );
}
