import React from 'react';
import { motion } from 'motion/react';

export function VendorComplianceGauge({
  percent,
  label,
  sublabel,
}: {
  percent: number;
  label: string;
  sublabel: string;
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
      className="flex flex-col items-center rounded-2xl border border-white/20 bg-white/10 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)] backdrop-blur-sm"
    >
      <div className="relative h-36 w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden>
          <circle
            cx="60"
            cy="60"
            r={normalized}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx="60"
            cy="60"
            r={normalized}
            fill="none"
            stroke="white"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <span className="text-4xl font-black tabular-nums">{clamped}%</span>
        </motion.div>
      </div>
      <p className="mt-4 text-center text-sm font-black uppercase tracking-widest text-white">
        {label}
      </p>
      <p className="mt-2 max-w-xs text-center text-xs font-medium leading-relaxed text-white/80">
        {sublabel}
      </p>
    </motion.div>
  );
}
