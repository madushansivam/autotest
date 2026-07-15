import LoginForm from '../components/auth/LoginForm';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    // If already authenticated, go straight to dashboard
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/', { replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-dark/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo / title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand/20 border border-brand/30 mb-4">
            <svg className="w-7 h-7 text-brand-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text tracking-tight">AUTOTEST</h1>
          <p className="mt-2 text-slate-400 text-sm">
            Autonomous web application testing agent
          </p>
        </div>

        {/* Auth form card */}
        <div className="glass p-8">
          <LoginForm />
        </div>

        <p className="text-center mt-6 text-xs text-slate-500">
          AutoTest generates structural and behavioural tests using AI.
          <br />
          LLM-generated tests cannot verify business-logic correctness.
        </p>
      </div>
    </div>
  );
}