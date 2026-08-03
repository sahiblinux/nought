import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { LearnerProvider } from './contexts/LearnerContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Nav from './components/Nav';
import Toasts from './components/Toasts';
import Home from './pages/Home';
import Track from './pages/Track';
import LessonPage from './pages/LessonPage';
import Playground from './pages/Playground';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <LearnerProvider>
            <ScrollToTop />
            <div className="min-h-screen flex flex-col">
              <Nav />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/learn/:lang" element={<Track />} />
                  <Route path="/learn/:lang/:slug" element={<LessonPage />} />
                  <Route path="/playground" element={<Playground />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <Toasts />
            </div>
          </LearnerProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
