import { useState, type FormEvent } from 'react';
import Button from '../ui/Button';

interface SubmitFormProps {
  onSubmit: (url: string, label?: string) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export default function SubmitForm({ onSubmit, loading, error }: SubmitFormProps) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    await onSubmit(url.trim(), label.trim() || undefined);
  }

  return (
    <form onSubmit={handleSubmit} className="glass p-6">
      <div className="space-y-4">
        {/* URL input */}
        <div>
          <label htmlFor="target-url" className="block text-sm font-medium text-slate-300 mb-1.5">
            Target URL
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.172 5.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.1-1.1" />
              </svg>
            </div>
            <input
              id="target-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              autoComplete="off"
              className="w-full pl-9 pr-4 py-3 bg-surface-2 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand/50 transition-all"
            />
          </div>
        </div>

        {/* Optional label */}
        <div>
          <label htmlFor="site-label" className="block text-sm font-medium text-slate-300 mb-1.5">
            Label <span className="text-slate-500 font-normal">(optional)</span>
          </label>
          <input
            id="site-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Marketing site, Staging env"
            maxLength={200}
            className="w-full px-4 py-3 bg-surface-2 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand/50 transition-all"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-fail/10 border border-fail/30 rounded-xl text-sm text-fail">
            {error}
          </div>
        )}

        {/* Submit */}
        <Button
          id="run-test-btn"
          type="submit"
          size="lg"
          loading={loading}
          className="w-full"
        >
          {loading ? 'Starting run…' : 'Run AutoTest'}
        </Button>
      </div>

      <p className="mt-4 text-xs text-slate-500 text-center">
        Only public URLs are supported. Internal IPs and local addresses are blocked.
      </p>
    </form>
  );
}
