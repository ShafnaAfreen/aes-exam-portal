import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import api from '../api';

export default function Login() {
  const [role, setRole] = useState('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      if (role === 'student') {
        const response = await api.post('/login', {
          username: identifier,
          password: password
        });

        if (response.status === 200) {
          // Store basic user info for the session
          localStorage.setItem('user_role', 'student');
          localStorage.setItem('student_id', identifier);
          
          navigate('/exam');
        }
      } else {
        // Teacher login logic
        if (identifier === 'admin' && password === 'admin') {
           navigate('/teacher');
        } else {
           setError('Invalid teacher credentials');
        }
      }
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Connection to secure server failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card text-card-foreground p-8 rounded-2xl shadow-xl border border-border ring-1 ring-ring/10">
        
        {/* Header Icon & Title */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="h-12 w-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-4 ring-1 ring-primary/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-serif font-medium tracking-tight">Secure Exam Portal</h1>
          <p className="text-muted-foreground mt-2 text-sm">Sign in to access your secure environment</p>
        </div>

        {/* Role Toggle Tabs */}
        <div className="flex bg-muted p-1 rounded-xl mb-6 shadow-inner ring-1 ring-inset ring-border/50">
          <button
            type="button"
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              role === 'student' 
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border' 
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
            onClick={() => setRole('student')}
          >
            Student
          </button>
          <button
            type="button"
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              role === 'teacher' 
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border' 
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
            onClick={() => setRole('teacher')}
          >
            Teacher
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-destructive/10 text-destructive text-sm font-medium p-3 rounded-lg border border-destructive/20 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground block">
              {role === 'student' ? 'Registration Number' : 'Username'}
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              </div>
              <input
                type="text"
                required
                className="w-full pl-10 pr-3 py-2.5 bg-input border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all placeholder:text-muted-foreground/50 shadow-sm"
                placeholder={role === 'student' ? 'e.g., 23BCE1240' : 'Enter admin'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground block">
              Password
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              </div>
              <input
                type="password"
                required
                className="w-full pl-10 pr-3 py-2.5 bg-input border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all placeholder:text-muted-foreground/50 shadow-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-8 py-2.5 px-4 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-ring focus:outline-none focus:ring-offset-background active:scale-[0.98] disabled:opacity-70"
          >
            {isLoading ? 'Authenticating...' : 'Sign In'}
            {!isLoading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
