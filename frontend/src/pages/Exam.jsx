import { useEffect, useState } from "react";
import "../styles/Exam.css";

function Exam({ username, setPage }) {
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(300);
  const [chunkError, setChunkError] = useState("");

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

  const decryptChunk = async (chunkEnvelope) => {
    const nowMs = Date.now();
    if (nowMs > chunkEnvelope.expires_at_ms) {
      throw new Error("Chunk key expired");
    }

    const keyBytes = b64ToBytes(chunkEnvelope.ephemeral_key_b64);
    const nonceBytes = b64ToBytes(chunkEnvelope.nonce_b64);
    const cipherBytes = b64ToBytes(chunkEnvelope.ciphertext_b64);

    try {
      const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        keyBytes,
        "AES-GCM",
        false,
        ["decrypt"]
      );

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonceBytes },
        cryptoKey,
        cipherBytes
      );
      const plaintext = new TextDecoder().decode(decryptedBuffer);
      return JSON.parse(plaintext);
    } finally {
      wipeBytes(keyBytes);
      wipeBytes(nonceBytes);
      wipeBytes(cipherBytes);
    }
  };

  useEffect(() => {
    fetch("http://localhost:5001/questions/meta")
      .then(res => res.json())
      .then(data => {
        setTotalQuestions(data.total || 0);
      });
  }, []);

  useEffect(() => {
    if (totalQuestions === 0) return;

    let cancelled = false;
    setActiveQuestion(null);
    setChunkError("");

    fetch(`http://localhost:5001/questions/chunk/${current}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to load chunk");
        return res.json();
      })
      .then(decryptChunk)
      .then(question => {
        if (!cancelled) setActiveQuestion(question);
      })
      .catch(() => {
        if (!cancelled) setChunkError("Unable to decrypt active question chunk.");
      });

    return () => {
      cancelled = true;
      setActiveQuestion(null);
    };
  }, [current, totalQuestions]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) clearInterval(timer);
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAnswer = (option) => {
    setAnswers({ ...answers, [current]: option });
  };

  const formatTime = () => {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (totalQuestions === 0) return <p>Loading...</p>;
  if (chunkError) return <p>{chunkError}</p>;
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
          <p>{activeQuestion.q}</p>
        </div>

        <div className="options-box">
          {activeQuestion.options.map(opt => (
            <label key={opt} className="option-item">
              <input
                type="radio"
                checked={answers[current] === opt}
                onChange={() => handleAnswer(opt)}
              />
              {opt}
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
