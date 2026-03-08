function Submitted({ username }) {
  return (
    <div style={{
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#f0f2f5"
    }}>
      <div style={{
        background: "white",
        padding: "40px",
        borderRadius: "10px",
        textAlign: "center",
        boxShadow: "0 8px 20px rgba(0,0,0,0.1)"
      }}>
        <h2 style={{ color: "#43a047" }}>
          Answers Submitted Successfully
        </h2>

        <p>Registration Number: {username}</p>

        <p>Your responses have been recorded.</p>
      </div>
    </div>
  );
}

export default Submitted;