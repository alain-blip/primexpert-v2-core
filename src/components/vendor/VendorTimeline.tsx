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
    <div className="w-full overflow-x-auto pb-2">
      <ol className="flex min-w-[640px] items-start gap-0">
        {VENDOR_TIMELINE_STAGES.map((stage, idx) => {
          const done = idx < activeIdx;
          const active = idx === activeIdx;
          return (
            <li key={stage.id} className="relative flex flex-1 flex-col items-center">
              {idx > 0 ? (
                <motion.div
                  className="absolute left-0 top-5 h-0.5 w-full -translate-x-1/2 bg-slate-200"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: done || active ? 1 : 0.15 }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  style={{ originX: 0 }}
                >
                  <motion.div
                    className={cn(
                      'h-full w-full',
                      done ? 'bg-primexpert-blue' : active ? 'bg-primexpert-blue/60' : 'bg-slate-200'
                    )}
                    layout
                  />
                </motion.div>
              ) : null}
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: idx * 0.06 }}
                className={cn(
                  'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-black shadow-sm',
                  done
                    ? 'border-primexpert-blue bg-primexpert-blue text-white'
                    : active
                      ? 'border-primexpert-blue bg-white text-primexpert-blue ring-4 ring-primexpert-blue/20'
                      : 'border-slate-200 bg-white text-slate-400'
                )}
              >
                {idx + 1}
              </motion.div>
              <p
                className={cn(
                  'mt-3 max-w-[9rem] text-center text-[10px] font-bold uppercase leading-snug tracking-wide',
                  active ? 'text-primexpert-dark' : done ? 'text-slate-600' : 'text-slate-400'
                )}
              >
                {t(stage.labelFr, stage.labelEn)}
              </p>
            </li>
          );
        })}
      </ol>
    </motion.div>
  );
}
