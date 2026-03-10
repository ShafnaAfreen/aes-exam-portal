import React, { useState } from 'react';
import { FileQuestion, Users, ShieldCheck, CheckCircle2, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

export default function AddQuestion() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    timeLimit: '60',
    optA: '',
    optB: '',
    optC: '',
    optD: '',
    optE: '',
    correctOption: 'A',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    
    try {
      await api.post('/api/admin/add_question', formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setFormData({ 
        title: '', timeLimit: '60', 
        optA: '', optB: '', optC: '', optD: '', optE: '', 
        correctOption: 'A' 
      });
    } catch (err) {
      console.error(err);
      alert("Failed to deploy question. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2 text-sidebar-foreground font-semibold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span>Admin Portal</span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1">
          <Link to="/teacher" className="flex items-center gap-3 px-3 py-2.5 text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground rounded-lg font-medium text-sm transition-colors">
            <Users className="h-4 w-4 flex-shrink-0" />
            Live Monitoring
          </Link>
          <Link to="/teacher/add" className="flex items-center gap-3 px-3 py-2.5 bg-sidebar-accent text-sidebar-accent-foreground rounded-lg font-medium text-sm transition-colors">
            <FileQuestion className="h-4 w-4 flex-shrink-0" />
            Question Bank
          </Link>
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs ring-1 ring-primary/30">
                T
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-sidebar-foreground">Dr. Smith</span>
                <span className="text-xs text-muted-foreground">Admin</span>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface">
        
        <header className="h-16 flex items-center px-8 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3 text-sm">
            <Link to="/teacher" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-foreground">Add Context-Aware Question</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 lg:p-12 pl-8 pr-8 flex justify-center">
          <div className="w-full max-w-4xl">
            
            <div className="mb-8">
              <h1 className="text-2xl font-serif font-medium tracking-tight text-foreground mb-2">Deploy New Question</h1>
              <p className="text-sm text-muted-foreground">Submit a text-based question. The system will automatically construct the answer layout and inject the context-aware AES steganographic watermark for students.</p>
            </div>

            {success && (
              <div className="mb-8 bg-green-500/10 text-green-600 border border-green-500/20 px-6 py-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium text-sm">Question successfully secured and deployed to the examination pool.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl shadow-sm p-8 space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Details */}
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground block">Question Text</label>
                    <textarea
                      required
                      rows={5}
                      className="w-full px-4 py-3 bg-input border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all shadow-sm resize-none"
                      placeholder="e.g., Explain the difference between symmetric and asymmetric cryptography..."
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                    />
                  </div>

                  <div className="flex gap-4">
                    <div className="space-y-1.5 flex-1">
                      <label className="text-sm font-medium text-foreground block">Time Limit (Secs)</label>
                      <input
                        type="number"
                        required
                        min="10"
                        className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all shadow-sm"
                        value={formData.timeLimit}
                        onChange={(e) => setFormData({...formData, timeLimit: e.target.value})}
                      />
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <label className="text-sm font-medium text-foreground block">Correct Option</label>
                      <select
                        className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all shadow-sm appearance-none"
                        value={formData.correctOption}
                        onChange={(e) => setFormData({...formData, correctOption: e.target.value})}
                      >
                        {['A', 'B', 'C', 'D', 'E'].map(opt => <option key={opt} value={opt}>Option {opt}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Right Column: Options */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground">Answer Options</h3>
                  
                  {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                    <div key={letter} className="flex flex-col gap-1.5">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground w-6 h-6 flex items-center justify-center bg-muted rounded-md">{letter}</span>
                        <input
                          type="text"
                          required={letter === 'A' || letter === 'B'} // require at least A and B
                          className="w-full pl-12 pr-4 py-2 bg-input border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all shadow-sm"
                          placeholder={`Option ${letter} text...`}
                          value={formData[`opt${letter}`]}
                          onChange={(e) => setFormData({...formData, [`opt${letter}`]: e.target.value})}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Area */}
              <div className="flex items-center justify-end pt-6 border-t border-border mt-8">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="bg-primary text-primary-foreground text-sm font-medium px-8 py-2.5 rounded-xl shadow-sm hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                      Committing to Vault...
                    </>
                  ) : (
                    'Deploy Text Question'
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>

      </main>
    </div>
  );
}
