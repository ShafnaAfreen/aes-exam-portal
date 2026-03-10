import React, { useState, useEffect } from 'react';
import { Users, FileQuestion, AlertCircle, Search, ShieldCheck, Upload, Loader2, LogOut, Clock, MoreVertical } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [forensicImage, setForensicImage] = useState(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeResult, setDecodeResult] = useState(null);
  const [decodeError, setDecodeError] = useState('');
  
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const res = await api.get('/api/admin/submissions');
        setSubmissions(res.data);
      } catch (err) {
        console.error("Error fetching submissions:", err);
      }
    };
    fetchSubmissions();
    const interval = setInterval(fetchSubmissions, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleForensicUpload = async (e) => {
    e.preventDefault();
    if (!forensicImage) return;

    setIsDecoding(true);
    setDecodeResult(null);
    setDecodeError('');

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(forensicImage);
      reader.onload = async () => {
        try {
          // The backend decode expects exactly the raw base64 string without the data uri prefix
          const base64String = reader.result.split(',')[1];
          const response = await api.post('/api/admin/decode_leak', {
            image_b64: base64String
          });
          
          if (response.data.extracted_student_id) {
            setDecodeResult(response.data.extracted_student_id);
          } else {
            setDecodeError(response.data.message || 'No watermark found.');
          }
        } catch (err) {
          setDecodeError(err.response?.data?.message || 'Error communicating with StegaStamp microservice.');
        } finally {
          setIsDecoding(false);
        }
      };
    } catch (err) {
      setDecodeError('Failed to read image file.');
      setIsDecoding(false);
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
          <Link to="/teacher" className="flex items-center gap-3 px-3 py-2.5 bg-sidebar-accent text-sidebar-accent-foreground rounded-lg font-medium text-sm transition-colors">
            <Users className="h-4 w-4 flex-shrink-0" />
            Live Monitoring
          </Link>
          <Link to="/teacher/add" className="flex items-center gap-3 px-3 py-2.5 text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground rounded-lg font-medium text-sm transition-colors">
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
        
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-border bg-card shrink-0">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">System Security Checks & Activity</h1>
          
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
              <input 
                type="text" 
                placeholder="Search tools..." 
                className="pl-9 pr-4 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow w-64 shadow-sm"
              />
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-auto p-8">
          
          {/* Forensic Image Decoder */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-8 p-6 flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground tracking-tight mb-2">Forensic Leak Decoder</h2>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                Upload a leaked photo or screenshot of a secure exam question. The system will query the StegaStamp microservice to extract the originating student's watermark.
              </p>
              
              {decodeResult && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-start gap-3 mb-4 animate-in fade-in">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Leak Source Identified</span>
                    <span className="text-sm">The watermark reveals this image originated from Student ID: <strong>{decodeResult}</strong></span>
                  </div>
                </div>
              )}

              {decodeError && (
                <div className="bg-muted text-muted-foreground p-4 rounded-xl flex items-center gap-3 mb-4 text-sm font-medium border border-border">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {decodeError}
                </div>
              )}
            </div>

            <div className="w-full md:w-96 shrink-0">
              <form onSubmit={handleForensicUpload} className="flex flex-col gap-3">
                <div className="relative flex justify-center px-4 py-4 border-2 border-dashed border-border/60 hover:border-border rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors group cursor-pointer overflow-hidden">
                  <div className="text-center flex flex-col items-center justify-center">
                    <Upload className="h-6 w-6 text-muted-foreground mb-2 group-hover:text-primary transition-colors group-hover:scale-105 duration-300" />
                    <div className="flex text-sm text-muted-foreground justify-center">
                      <span className="relative cursor-pointer bg-transparent rounded-md font-medium text-primary hover:text-primary/80">
                        <span>{forensicImage ? forensicImage.name : 'Select leaked image'}</span>
                        <input 
                          type="file" 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                          accept="image/png, image/jpeg"
                          onChange={(e) => {
                            setForensicImage(e.target.files[0]);
                            setDecodeResult(null);
                            setDecodeError('');
                          }}
                        />
                      </span>
                    </div>
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={!forensicImage || isDecoding}
                  className="w-full bg-secondary text-secondary-foreground text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 border border-border"
                >
                  {isDecoding ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Decoding StegaStamp...</>
                  ) : (
                    'Analyze Image'
                  )}
                </button>
              </form>
            </div>
          </div>
          
          {/* Submissions Table */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/20">
              <h2 className="font-medium text-foreground">Completed Submissions</h2>
              <span className="text-sm text-muted-foreground">{submissions.length} Total</span>
            </div>
            <div className="overflow-x-auto">
              {submissions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No submissions recorded yet.
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-medium tracking-wider">Candidate ID</th>
                      <th className="px-6 py-4 font-medium tracking-wider">Status</th>
                      <th className="px-6 py-4 font-medium tracking-wider">Submitted At</th>
                      <th className="px-6 py-4 font-medium tracking-wider">Security Alerts</th>
                      <th className="px-6 py-4 text-right font-medium tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {submissions.map((sub, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-foreground font-mono">{sub.student_id}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border bg-green-500/10 text-green-600 border-green-500/20">
                            Completed
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground font-mono text-xs flex items-center gap-1.5 mt-2.5">
                          <Clock className="h-3 w-3" />
                          {new Date(sub.submitted_at + 'Z').toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          {sub.violations.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {sub.violations.map((v, i) => (
                                <span key={i} className="inline-flex items-center gap-1.5 px-2 py-1 bg-destructive/10 text-destructive text-[11px] font-medium rounded-md border border-destructive/20 max-w-fit">
                                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                                  {v.type} ({v.timestamp})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Clear</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
