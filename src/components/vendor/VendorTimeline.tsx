import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import {
  VENDOR_TIMELINE_STAGES,
  vendorTimelineActiveIndex,
  type VendorTimelineStageId,
} from '@primexpert/core/residence';

export function VendorTimeline({
  activeStageId,
  t,
}: {
  activeStageId: VendorTimelineStageId;
  t: (fr: string, en: string) => string;
}) {
  const activeIdx = vendorTimelineActiveIndex(activeStageId);

  return (
    <ol className="relative flex flex-col gap-6 sm:flex-row sm:gap-0">
      {VENDOR_TIMELINE_STAGES.map((stage, index) => {
        const done = index < activeIdx;
        const active = index === activeIdx;
        return (
          <li key={stage.id} className="relative flex flex-1 flex-col items-center text-center">
            {index > 0 ? (
              <span
                className="absolute left-0 top-5 hidden h-0.5 w-full -translate-x-1/2 bg-primexpert-light dark:bg-primexpert-cardDark sm:block"
                aria-hidden
              />
            ) : null}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.08 }}
              className={cn(
                'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 text-[11px] font-black',
                done || active
                  ? 'border-primexpert-blue bg-white text-primexpert-blue dark:bg-primexpert-cardDark'
                  : 'border-primexpert-dark/25 bg-white text-slate-900 dark:bg-primexpert-cardDark'
              )}
            >
              {index + 1}
            </motion.div>
            <p
              className={cn(
                'mt-3 max-w-[9rem] text-[10px] font-black uppercase leading-tight tracking-wide',
                active ? 'text-primexpert-dark' : 'text-slate-900'
              )}
            >
              {t(stage.labelFr, stage.labelEn)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
