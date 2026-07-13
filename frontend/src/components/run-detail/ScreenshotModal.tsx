import { useEffect } from 'react';

interface ScreenshotModalProps {
  url: string;
  open: boolean;
  onClose: () => void;
}

export default function ScreenshotModal({ url, open, onClose }: ScreenshotModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot preview"
    >
      <div
        className="relative max-w-4xl w-full glass p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-surface-2 hover:bg-surface-3 text-slate-400 hover:text-white transition-colors"
          aria-label="Close screenshot"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img
          src={url}
          alt="Test failure screenshot"
          className="w-full rounded-xl object-contain max-h-[80vh]"
        />
        <p className="mt-2 text-center text-xs text-slate-500">
          Failure screenshot captured by Playwright
        </p>
      </div>
    </div>
  );
}
