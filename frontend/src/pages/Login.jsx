import { useState } from "react";
import "../styles/Login.css";

function Login({ setPage, setUsername }) {
  const [usernameInput, setUsernameInput] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const username = usernameInput.trim();
    const passwordInput = password.trim();

    const res = await fetch("http://localhost:5001/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password: passwordInput
      })
    });

    if (res.ok) {
      setUsername(username);
      setPage("exam");
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "Invalid credentials");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Student Login</h2>

        <input
          className="login-input"
          type="text"
          placeholder="Register Number"
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
        />

        <input
          className="login-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="login-button" onClick={handleLogin}>
          Login
        </button>
      </div>
    </div>
  );
}

export default Login;
