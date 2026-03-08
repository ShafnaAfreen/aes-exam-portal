import { useState } from "react";
import Login from "./pages/Login";
import Exam from "./pages/Exam";
import Submitted from "./pages/Submitted";

function App() {
  const [page, setPage] = useState("login");
  const [username, setUsername] = useState("");

  return (
    <>
      {page === "login" && (
        <Login setPage={setPage} setUsername={setUsername} />
      )}

      {page === "exam" && (
        <Exam username={username} setPage={setPage} />
      )}

      {page === "submitted" && (
        <Submitted username={username} />
      )}
    </>
  );
}

export default App;