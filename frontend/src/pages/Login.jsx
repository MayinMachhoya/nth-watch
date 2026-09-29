import React, { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthShell, { fieldClass, inputClass } from '../components/AuthShell';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { Mail, Lock, Eye, EyeOff, LogIn, Loader2, AlertCircle } from 'lucide-react';

const Login = () => {
  const { login, loginWithGoogle, isAuthenticated } = useAuth();
  const location = useLocation();
  useDocumentTitle('Sign in');
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);



  // If already authenticated, redirect
  if (isAuthenticated) return <Navigate to={from} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password);
      // Navigation handled by auth state change → ProtectedRoute
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };



  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back"
      subtitle="Sign in to get personalised recommendations"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-accent font-semibold hover:text-fg transition-colors duration-fast">
            Create one
          </Link>
        </>
      }
    >
      <div className="space-y-lg">
        {/* Google OAuth */}
        <button
          onClick={loginWithGoogle}
          type="button"
          className="flex items-center justify-center gap-sm w-full h-control-lg rounded-sm border border-line-strong text-fg text-body font-medium hover:border-fg hover:bg-surface transition-colors duration-fast"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-sm">
          <div className="flex-1 h-px bg-line" />
          <span className="label text-fg-subtle">or sign in with email</span>
          <div className="flex-1 h-px bg-line" />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-xs bg-negative/10 border border-negative/30 border-l-rule border-l-negative rounded-xs px-md py-sm" role="alert">
            <AlertCircle size={16} className="text-negative shrink-0" />
            <span className="text-small text-negative">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-md">
          {/* Email */}
          <div className="space-y-xs">
            <label htmlFor="login-email" className="label text-fg-muted">
              Email address
            </label>
            <div className={fieldClass}>
              <Mail size={16} className="text-fg-subtle shrink-0" />
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-xs">
            <label htmlFor="login-password" className="label text-fg-muted">
              Password
            </label>
            <div className={fieldClass}>
              <Lock size={16} className="text-fg-subtle shrink-0" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="text-fg-subtle hover:text-fg transition-colors duration-fast"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-xs w-full h-control-lg rounded-sm bg-accent text-accent-ink text-body font-semibold hover:bg-accent-strong transition-colors duration-fast disabled:opacity-muted disabled:cursor-not-allowed mt-lg"
          >
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <LogIn size={18} />
            )}
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>

    </AuthShell>
  );
};

export default Login;
