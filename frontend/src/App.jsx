import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Exam from './pages/Exam';
import TeacherDashboard from './pages/TeacherDashboard';
import AddQuestion from './pages/AddQuestion';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/exam" element={<Exam />} />
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/add" element={<AddQuestion />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;