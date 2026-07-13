import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="text-center animate-fade-in">
        <p className="text-8xl font-bold gradient-text mb-4">404</p>
        <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-slate-400 mb-6">The page you're looking for doesn't exist.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand-light text-white font-semibold rounded-xl transition-all duration-150"
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
