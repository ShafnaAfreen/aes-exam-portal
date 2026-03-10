import { useEffect, useState } from "react";
import "../styles/Exam.css";

function Exam({ username, setPage }) {
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(300);
  const [chunkError, setChunkError] = useState("");
  const [metaLoading, setMetaLoading] = useState(true);
  const [deviceId, setDeviceId] = useState("");
  const [geo, setGeo] = useState(null);

  const getOrCreateDeviceId = () => {
    const key = "exam_device_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  };

  const b64ToBytes = (b64) => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  const wipeBytes = (buf) => {
    if (!buf) return;
    buf.fill(0);
  };

  const deriveBindingKey = async (regNo, devId, latitude, longitude, timeWindow, saltBytes) => {
    const geoCell = `${Number(latitude).toFixed(3)},${Number(longitude).toFixed(3)}`;
    const prefix = `${regNo}|${devId}|${geoCell}|${timeWindow}|`;
    const prefixBytes = new TextEncoder().encode(prefix);
    const material = new Uint8Array(prefixBytes.length + saltBytes.length);
    material.set(prefixBytes, 0);
    material.set(saltBytes, prefixBytes.length);
    const digest = await window.crypto.subtle.digest("SHA-256", material);
    material.fill(0);
    return new Uint8Array(digest);
  };

  const decryptChunk = async (chunkEnvelope) => {
    const nowMs = Date.now();
    if (nowMs > chunkEnvelope.expires_at_ms) {
      throw new Error("Chunk key expired");
    }

    if (!geo) {
      throw new Error("Missing geolocation");
    }

    const saltBytes = b64ToBytes(chunkEnvelope.binding_salt_b64);
    const keyNonceBytes = b64ToBytes(chunkEnvelope.key_nonce_b64);
    const wrappedKeyBytes = b64ToBytes(chunkEnvelope.wrapped_key_b64);
    const nonceBytes = b64ToBytes(chunkEnvelope.nonce_b64);
    const cipherBytes = b64ToBytes(chunkEnvelope.ciphertext_b64);

    try {
      const bindingKeyBytes = await deriveBindingKey(
        username,
        deviceId,
        geo.lat,
        geo.lon,
        chunkEnvelope.time_window,
        saltBytes
      );
      const bindingKey = await window.crypto.subtle.importKey(
        "raw",
        bindingKeyBytes,
        "AES-GCM",
        false,
        ["decrypt"]
      );
      const unwrappedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: keyNonceBytes },
        bindingKey,
        wrappedKeyBytes
      );
      const chunkKeyBytes = new Uint8Array(unwrappedBuffer);
      const chunkKey = await window.crypto.subtle.importKey(
        "raw",
        chunkKeyBytes,
        "AES-GCM",
        false,
        ["decrypt"]
      );

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonceBytes },
        chunkKey,
        cipherBytes
      );
      const plaintext = new TextDecoder().decode(decryptedBuffer);
      wipeBytes(bindingKeyBytes);
      wipeBytes(chunkKeyBytes);
      // The decrypted text is the raw base64 string of the image.
      // We prepend the data URI scheme to render it directly in an <img> tag.
      return `data:image/png;base64,${plaintext}`;
    } finally {
      wipeBytes(saltBytes);
      wipeBytes(keyNonceBytes);
      wipeBytes(wrappedKeyBytes);
      wipeBytes(nonceBytes);
      wipeBytes(cipherBytes);
    }
  };

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  useEffect(() => {
    setChunkError("");
    if (!("geolocation" in navigator)) {
      setChunkError("Geolocation is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
  (pos) => {
    console.log("CLIENT GEO:", pos.coords.latitude, pos.coords.longitude);

    setGeo({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
    });

    setChunkError("");
  },
      (err) => {
        if (err.code === 1) {
          setChunkError("Location permission denied. Allow location and retry.");
          return;
        }
        if (err.code === 2) {
          setChunkError("Location unavailable. Turn on GPS/location services and retry.");
          return;
        }
        if (err.code === 3) {
          setChunkError("Location request timed out. Retry in an open-sky/network-stable area.");
          return;
        }
        setChunkError(
          "Location access failed. Use localhost/https and ensure browser + OS location access are enabled."
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 120000 }
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch("http://localhost:5000/questions/meta", { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || "Failed to load exam metadata");
        }
        return data;
      })
      .then(data => {
        setTotalQuestions(data.total || 0);
        setChunkError("");
      })
      .catch((err) => {
        if (err?.name === "AbortError") {
          setChunkError("Backend not reachable (meta timeout). Check backend server on port 5000.");
          return;
        }
        setChunkError(err?.message || "Failed to load exam metadata");
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setMetaLoading(false);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (totalQuestions === 0 || !deviceId || !geo) return;

    let cancelled = false;
    setActiveQuestion(null);
    setChunkError("");

    fetch(`http://localhost:5000/questions/chunk/${current}`, {
      headers: {
        "X-Registration-No": username,
        "X-Device-Id": deviceId,
        "X-Geo-Lat": String(geo.lat),
        "X-Geo-Lon": String(geo.lon),
      },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || "Failed to load chunk");
        }
        return data;
      })
      .then(chunk => {
        return decryptChunk(chunk);
      })
      .then(question => {
        if (!cancelled) setActiveQuestion(question);
      })
      .catch((err) => {
        if (!cancelled) {
          setChunkError(err?.message || "Unable to decrypt active question chunk.");
        }
      });

    return () => {
      cancelled = true;
      setActiveQuestion(null);
    };
  }, [current, totalQuestions, deviceId, geo, username]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
  if (prev <= 1) {
    clearInterval(timer);
    setPage("submitted");
    return 0;
  }
  return prev - 1;
});
    }, 1000);
    return () => clearInterval(timer);
  }, []);
useEffect(() => {
  const handleVisibility = () => {
    if (document.hidden) {
      alert("Tab switching detected. This action is recorded.");
    }
  };

  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}, []);
useEffect(() => {

  const blockCopy = (e) => e.preventDefault();

  document.addEventListener("copy", blockCopy);
  document.addEventListener("cut", blockCopy);
  document.addEventListener("contextmenu", blockCopy);

  return () => {
    document.removeEventListener("copy", blockCopy);
    document.removeEventListener("cut", blockCopy);
    document.removeEventListener("contextmenu", blockCopy);
  };

}, []);
  const handleAnswer = (option) => {
    setAnswers({ ...answers, [current]: option });
  };

  const formatTime = () => {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (chunkError) return <p>{chunkError}</p>;
  if (metaLoading) return <p>Loading...</p>;
  if (totalQuestions === 0) return <p>Loading...</p>;
  if (!activeQuestion) return <p>Decrypting active chunk...</p>;

  return (
    <div className="exam-layout">

      {/* LEFT SECTION */}
      <div className="exam-main">

        <div className="exam-topbar">
          <div className="reg-number">
            Registration No: <strong>{username}</strong>
          </div>
          <div className="timer">
            ⏱ {formatTime()}
          </div>
        </div>

        <div className="question-box">
          <h3>
            Question {current + 1}
          </h3>
          <img src={activeQuestion} alt={`Secure Question ${current + 1}`} style={{ maxWidth: '100%', height: 'auto', border: '1px solid #ccc' }} />
        </div>

        <div className="options-box">
          {['A', 'B', 'C', 'D', 'E'].map(opt => (
            <label key={opt} className="option-item">
              <input
                type="radio"
                checked={answers[current] === opt}
                onChange={() => handleAnswer(opt)}
              />
              Option {opt}
            </label>
          ))}
        </div>

        <div className="navigation">
          <button
            disabled={current === 0}
            onClick={() => setCurrent(current - 1)}
          >
            Prev
          </button>

          {current < totalQuestions - 1 ? (
            <button onClick={() => setCurrent(current + 1)}>
              Next
            </button>
          ) : (
            <button className="submit" onClick={() => setPage("submitted")}>
              Submit
            </button>
          )}
        </div>
      </div>

      {/* RIGHT PALETTE */}
      <div className="question-palette">
        <h4>Questions</h4>
        <div className="palette-grid">
          {Array.from({ length: totalQuestions }).map((_, index) => (
            <div
              key={index}
              className={`palette-item ${
                answers[index] ? "attempted" : ""
              }`}
              onClick={() => setCurrent(index)}
            >
              {index + 1}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default Exam;
