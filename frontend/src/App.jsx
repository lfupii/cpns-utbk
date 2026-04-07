import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import Home from './pages/Home';
import Payment from './pages/Payment';
import Test from './pages/Test';
import Results from './pages/Results';
import Profile from './pages/Profile';
import ActivePackages from './pages/ActivePackages';
import TestHistory from './pages/TestHistory';
import AdminPanel from './pages/AdminPanel';
import Contact from './pages/Contact';
import TermsConditions from './pages/TermsConditions';
import RefundPolicy from './pages/RefundPolicy';
import MidtransReview from './pages/MidtransReview';
import PrivacyPolicy from './pages/PrivacyPolicy';
import './index.css';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return isAdmin ? children : <Navigate to="/" />;
}

function MotionEffects() {
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    const updatePointer = (event) => {
      root.style.setProperty('--pointer-x', `${event.clientX}px`);
      root.style.setProperty('--pointer-y', `${event.clientY}px`);
    };
    const pressPointer = () => root.classList.add('pointer-pressed');
    const releasePointer = () => root.classList.remove('pointer-pressed');

    updatePointer({
      clientX: window.innerWidth / 2,
      clientY: window.innerHeight / 3,
    });

    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('pointerdown', pressPointer, { passive: true });
    window.addEventListener('pointerup', releasePointer, { passive: true });

    return () => {
      window.removeEventListener('pointermove', updatePointer);
      window.removeEventListener('pointerdown', pressPointer);
      window.removeEventListener('pointerup', releasePointer);
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  return null;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  return (
    <>
      <MotionEffects />
      <div key={location.pathname} className="route-stage">
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<TermsConditions />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/midtrans-review" element={<MidtransReview />} />
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/" /> : <Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route
            path="/payment/:packageId"
            element={
              <ProtectedRoute>
                <Payment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/test/:packageId"
            element={
              <ProtectedRoute>
                <Test />
              </ProtectedRoute>
            }
          />
          <Route
            path="/results/:attemptId"
            element={
              <ProtectedRoute>
                <Results />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/active-packages"
            element={
              <ProtectedRoute>
                <ActivePackages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/test-history"
            element={
              <ProtectedRoute>
                <TestHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            }
          />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
