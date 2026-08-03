import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLearner } from '../contexts/LearnerContext';

export default function Toasts() {
  const { toasts, dismissToast } = useLearner();

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(20rem,calc(100vw-2.5rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 shadow-[0_10px_30px_-18px_rgba(28,27,23,0.4)]"
          >
            <span className="mt-0.5 font-mono text-sm text-clay">{t.glyph || '✦'}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs leading-snug text-muted">{t.body}</p>}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
              className="-mr-1 -mt-1 rounded p-1 text-faint transition-colors hover:text-ink"
            >
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
