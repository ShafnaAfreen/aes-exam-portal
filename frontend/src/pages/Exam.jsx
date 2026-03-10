import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, ShieldAlert, Loader2, RefreshCw } from 'lucide-react';
import api from '../api';

// Utility: Base64 to Uint8Array
function base64ToBytes(base64) {
  const binString = window.atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0));
}

// Utility: String to Uint8Array
function stringToBytes(str) {
  return new TextEncoder().encode(str);
}

// Utility: Generate or retrieve a consistent device ID
function getDeviceId() {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

export default function Exam() {
  const [timeLeft, setTimeLeft] = useState(3600);
  const [violations, setViolations] = useState([]);
  const [showWarning, setShowWarning] = useState(false);
  
  // Exam State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [questionImage, setQuestionImage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState("");
  
  const studentId = localStorage.getItem('student_id') || 'UNKNOWN';

  // Timer logic
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Violation Tracking
  useEffect(() => {
    const handleViolation = (type) => {
      const timestamp = new Date().toLocaleTimeString();
      const newViolation = { type, timestamp };
      
      setViolations((prev) => [...prev, newViolation]);
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 3000);
      console.warn(`Violation Logged: ${type} at ${timestamp}`);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleViolation('Tab Switch Detected');
    };

    const handleWindowBlur = () => {
      handleViolation('Window Blur/Loss of Focus');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // Fetch Metadata & First Question
  useEffect(() => {
    const initExam = async () => {
      try {
        const metaRes = await api.get('/questions/meta');
        setTotalQuestions(metaRes.data.total);
        await fetchQuestion(0);
      } catch (err) {
        setErrorMsg(err.response?.data?.message || "Failed to initialize exam.");
        setIsLoading(false);
      }
    };
    initExam();
  }, []);

  const getGeolocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
      } else {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      }
    });
  };

  const fetchQuestion = async (index) => {
    setIsLoading(true);
    setErrorMsg("");
    setQuestionImage(null);
    setSelectedAnswer("");

    try {
      // 1. Get Geolocation
      let geoData;
      try {
        geoData = await getGeolocation();
      } catch (e) {
        throw new Error("Location access required to fetch encrypted question chunk.");
      }
      
      const lat = geoData.coords.latitude;
      const lon = geoData.coords.longitude;
      const deviceId = getDeviceId();

      // 2. Fetch encrypted chunk
      const res = await api.get(`/questions/chunk/${index}`, {
        headers: {
          'X-Registration-No': studentId,
          'X-Device-Id': deviceId,
          'X-Geo-Lat': lat.toString(),
          'X-Geo-Lon': lon.toString()
        }
      });

      const chunk = res.data;

      // 3. Crypto Variables Prep
      const nonce = base64ToBytes(chunk.nonce_b64);
      const ciphertext = base64ToBytes(chunk.ciphertext_b64);
      const bindingSalt = base64ToBytes(chunk.binding_salt_b64);
      const keyNonce = base64ToBytes(chunk.key_nonce_b64);
      const wrappedKey = base64ToBytes(chunk.wrapped_key_b64);
      const timeWindow = chunk.time_window;

      // 4. Derive Binding Key: SHA-256(reg_no|device_id|geo_lat,geo_lon|time_window|salt)
      // Format lat/lon exactly as backend does: f"{geo_lat:.3f},{geo_lon:.3f}"
      const geoCell = `${lat.toFixed(3)},${lon.toFixed(3)}`;
      const materialStr = `${studentId}|${deviceId}|${geoCell}|${timeWindow}|`;
      
      const materialBytes = stringToBytes(materialStr);
      const combinedMaterial = new Uint8Array(materialBytes.length + bindingSalt.length);
      combinedMaterial.set(materialBytes);
      combinedMaterial.set(bindingSalt, materialBytes.length);

      const bindingKeyDigest = await window.crypto.subtle.digest('SHA-256', combinedMaterial);

      const bindingKey = await window.crypto.subtle.importKey(
        'raw',
        bindingKeyDigest,
        { name: 'AES-GCM' },
        false,
        ['unwrapKey']
      );

      // 5. Unwrap the Ephemeral Key
      const ephemeralKey = await window.crypto.subtle.unwrapKey(
        'raw',
        wrappedKey,
        bindingKey,
        { name: 'AES-GCM', iv: keyNonce },
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      // 6. Decrypt the Image Payload
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonce },
        ephemeralKey,
        ciphertext
      );

      // 7. Convert decrypted bytes back to base64 string
      const decryptedBytes = new Uint8Array(decryptedBuffer);
      let binaryStr = '';
      // Use chunking to avoid Maximum call stack size exceeded for large arrays
      for (let i = 0; i < decryptedBytes.length; i += 10000) {
        binaryStr += String.fromCharCode.apply(null, decryptedBytes.subarray(i, i + 10000));
      }
      
      // The decrypted bytes from the backend is the base64 string of the image
      const imageBase64Data = decodeURIComponent(escape(binaryStr));
      
      setQuestionImage(`data:image/jpeg;base64,${imageBase64Data}`);
      setCurrentQuestionIndex(index);

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || err.response?.data?.message || "Decryption or network error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      fetchQuestion(currentQuestionIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      fetchQuestion(currentQuestionIndex - 1);
    }
  };

  const handleSubmitExam = async () => {
    setIsLoading(true);
    try {
      await api.post('/api/submit_exam', {
        student_id: studentId,
        violations: violations
      });
      localStorage.removeItem('student_id');
      localStorage.removeItem('device_id');
      window.location.href = '/login';
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to submit exam. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">Computer Networks - Midterm</span>
            <span className="text-xs text-muted-foreground">ID: {studentId}</span>
          </div>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-medium tracking-tight ${
          timeLeft < 300 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'
        }`}>
          <Clock className="h-5 w-5" />
          {formatTime(timeLeft)}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center p-6 lg:p-12 overflow-y-auto">
        
        {/* Violation Warning Toast */}
        {showWarning && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 bg-destructive text-destructive-foreground px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium text-sm">Warning: Activity recorded and reported.</span>
          </div>
        )}

        <div className="w-full max-w-4xl space-y-8">
          
          <div className="bg-card border border-border rounded-xl xl:rounded-3xl shadow-sm overflow-hidden select-none">
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-md">
                    Question {currentQuestionIndex + 1} of {totalQuestions || '?'}
                  </span>
                  <span className="text-sm text-muted-foreground">Multiple Choice</span>
                </div>
                
                <button 
                  onClick={() => fetchQuestion(currentQuestionIndex)}
                  className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
                  title="Reload Question"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              
              {/* Question Render Area */}
              <div className="w-full bg-muted/30 rounded-lg md:rounded-xl border border-border/50 flex flex-col items-center justify-center p-4 text-center mb-8 relative group min-h-[300px]">
                {isLoading ? (
                  <div className="flex flex-col items-center text-primary gap-4">
                    <Loader2 className="h-10 w-10 animate-spin" />
                    <p className="text-sm font-medium text-muted-foreground">Verifying Context & Decrypting Chunk...</p>
                  </div>
                ) : errorMsg ? (
                  <div className="flex flex-col items-center text-destructive gap-3 max-w-sm px-4">
                    <AlertTriangle className="h-10 w-10" />
                    <p className="font-medium">{errorMsg}</p>
                    <p className="text-xs text-muted-foreground">Make sure location services are enabled and you are inside the authorized geofence.</p>
                  </div>
                ) : questionImage ? (
                  <img 
                    src={questionImage} 
                    alt="Secure Exam Question" 
                    className="max-w-full h-auto rounded-lg shadow-sm border border-border/50"
                    onContextMenu={(e) => e.preventDefault()}
                    draggable="false"
                  />
                ) : (
                  <div className="flex flex-col items-center">
                    <ShieldAlert className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground font-medium">Secured Question Render Area</p>
                  </div>
                )}
                
                {/* Visual Security Overlay */}
                <div className="absolute inset-0 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAiLz4KPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjEiIGhlaWdodD0iMSIgZmlsbD0iIzAwMCIgZmlsbC1vcGFjaXR5PSIwLjA1Ii8+Cjwvc3ZnPg==')] opacity-50 mix-blend-overlay"></div>
              </div>

              {/* Static Answer Options */}
              <div className="grid gap-3">
                {['A', 'B', 'C', 'D', 'E'].map((option) => (
                  <label key={option} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors group cursor-pointer ${
                    selectedAnswer === option 
                      ? 'bg-primary/5 border-primary' 
                      : 'border-border bg-background hover:bg-muted/50'
                  }`}>
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="radio" 
                        name="answer" 
                        value={option}
                        checked={selectedAnswer === option}
                        onChange={(e) => setSelectedAnswer(e.target.value)}
                        className="peer sr-only" 
                      />
                      <div className={`h-5 w-5 rounded-full border transition-all ${
                        selectedAnswer === option
                          ? 'border-[6px] border-primary'
                          : 'border-border'
                      }`}></div>
                    </div>
                    <span className="font-medium text-foreground">Option {option}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-muted/30 border-t border-border p-4 px-6 md:px-8 flex items-center justify-between">
              <button 
                onClick={handlePrev}
                disabled={currentQuestionIndex === 0 || isLoading}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg disabled:opacity-50"
              >
                Previous
              </button>
              
              <button 
                onClick={currentQuestionIndex >= totalQuestions - 1 ? handleSubmitExam : handleNext}
                disabled={isLoading}
                className="bg-primary text-primary-foreground text-sm font-medium px-6 py-2.5 rounded-xl shadow-sm hover:bg-primary/90 transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                {currentQuestionIndex >= totalQuestions - 1 ? 'Finish & Submit Exam' : 'Save & Next'}
              </button>
            </div>
          </div>

          {/* Violations Debug List */}
          {violations.length > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Detected Violations (Debug View)
              </h3>
              <ul className="space-y-2">
                {violations.map((v, i) => (
                  <li key={i} className="text-sm text-foreground flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                    <span>{v.type}</span>
                    <span className="text-muted-foreground text-xs font-mono bg-background px-2 py-1 rounded-md border border-border/50">{v.timestamp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
