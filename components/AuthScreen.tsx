import React, { useState } from 'react';
import { signUp, signIn } from '../services/authService';

type AuthScreenProps = {
  onLoginSuccess: () => void;
};

const LuminaLogo = () => (
  <div className="flex flex-col items-center gap-2">
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: '#D8B4FE', stopOpacity: 1}} />
          <stop offset="100%" style={{stopColor: '#6D35FF', stopOpacity: 1}} />
        </linearGradient>
      </defs>
      <path d="M24 0L28.8235 19.1765L48 24L28.8235 28.8235L24 48L19.1765 28.8235L0 24L19.1765 19.1765L24 0Z" fill="url(#logoGradient)"/>
      <path d="M24 14.1176L26.3529 21.6471L33.8824 24L26.3529 26.3529L24 33.8824L21.6471 26.3529L14.1176 24L21.6471 21.6471L24 14.1176Z" fill="#29212A"/>
      <path d="M24 16L25.8824 22.1176L32 24L25.8824 25.8824L24 32L22.1176 25.8824L16 24L22.1176 22.1176L24 16Z" fill="white"/>
    </svg>
    <h1 className="text-xl font-medium text-white/90">Lumina AI</h1>
  </div>
);

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (authMode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 flex flex-col items-center gap-8 shadow-2xl">
        <LuminaLogo />

        <div className="w-full bg-black/20 rounded-full p-1 flex">
          <button
            onClick={() => setAuthMode('login')}
            className={`w-1/2 rounded-full py-2 text-sm font-medium transition-colors ${authMode === 'login' ? 'bg-[#6D35FF] text-white' : 'text-white/70 hover:bg-white/10'}`}
          >
            Login
          </button>
          <button
            onClick={() => setAuthMode('signup')}
            className={`w-1/2 rounded-full py-2 text-sm font-medium transition-colors ${authMode === 'signup' ? 'bg-[#6D35FF] text-white' : 'text-white/70 hover:bg-white/10'}`}
          >
            Signup
          </button>
        </div>

        {error && (
          <div className="w-full p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black/20 text-white placeholder:text-[#9481AA]/70 rounded-lg px-4 py-3 border border-transparent focus:border-[#6D35FF] focus:outline-none focus:ring-2 focus:ring-[#6D35FF]/50 transition-all"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black/20 text-white placeholder:text-[#9481AA]/70 rounded-lg px-4 py-3 border border-transparent focus:border-[#6D35FF] focus:outline-none focus:ring-2 focus:ring-[#6D35FF]/50 transition-all"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#9481AA]/50 text-white font-semibold rounded-lg py-3 mt-4 hover:bg-[#9481AA]/70 transition-colors disabled:opacity-50"
          >
            {loading ? 'Processing...' : (authMode === 'login' ? 'Login' : 'Signup')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;