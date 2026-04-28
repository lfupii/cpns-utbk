import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import Home from './pages/Home';
import Payment from './pages/Payment';
import Learning from './pages/Learning';
import Test from './pages/Test';
import Results from './pages/Results';
import ResultsReview from './pages/ResultsReview';
import MiniTestReview from './pages/MiniTestReview';
import Profile from './pages/Profile';
import ActivePackages from './pages/ActivePackages';
import TestHistory from './pages/TestHistory';
import AdminPanel from './pages/AdminPanel';
import AdminLearningMaterialEditor from './pages/AdminLearningMaterialEditor';
import AdminQuestionEditor from './pages/AdminQuestionEditor';
import AdminMiniTestQuestionEditor from './pages/AdminMiniTestQuestionEditor';
import Contact from './pages/Contact';
import TermsConditions from './pages/TermsConditions';
import { ThemeProvider } from './ThemeContext';
import apiClient from './api';
import {
  clearActiveMiniTestSession,
  clearActiveTryoutSession,
  getActiveMiniTestSession,
  getActiveTryoutSession,
} from './utils/activeAssessmentSession';
import './index.css';

function ProtectedRoute({ children }) {
  const { isAuthenticated, authReady } = useAuth();
  if (!authReady) {
    return null;
  }
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, authReady } = useAuth();
  if (!authReady) {
    return null;
  }
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

function ActiveAssessmentRedirector() {
  const { isAuthenticated, authReady } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authReady || !isAuthenticated) {
      return;
    }

    const currentPath = location.pathname;
    if (
      currentPath.startsWith('/test/')
      || currentPath.startsWith('/results/')
      || currentPath.startsWith('/admin')
    ) {
      return;
    }

    let ignore = false;

    const resumeActiveAssessment = async () => {
      const tryoutSession = getActiveTryoutSession();
      if (tryoutSession?.packageId) {
        try {
          const response = await apiClient.get(`/test/check-access?package_id=${Number(tryoutSession.packageId)}`);
          const ongoingAttemptId = Number(response.data?.data?.ongoing_attempt_id || 0);

          if (!ignore && ongoingAttemptId > 0) {
            if (currentPath !== `/test/${Number(tryoutSession.packageId)}`) {
              navigate(`/test/${Number(tryoutSession.packageId)}`, { replace: true });
            }
            return;
          }

          clearActiveTryoutSession();
        } catch (error) {
          if (!ignore && error?.response?.status !== 401) {
            clearActiveTryoutSession();
          }
        }
      }

      const miniTestSession = getActiveMiniTestSession();
      if (!miniTestSession?.packageId || !miniTestSession?.sectionCode || ignore) {
        return;
      }

      const learningPath = `/learning/${Number(miniTestSession.packageId)}`;
      if (currentPath !== learningPath) {
        navigate(learningPath, { replace: true });
      }
    };

    resumeActiveAssessment();

    return () => {
      ignore = true;
    };
  }, [authReady, isAuthenticated, location.pathname, navigate]);

  return null;
}

function AppRoutes() {
  const { isAuthenticated, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return null;
  }

  return (
    <>
      <MotionEffects />
      <ActiveAssessmentRedirector />
      <div key={location.pathname} className="route-stage">
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<TermsConditions />} />
          <Route path="/refund-policy" element={<Navigate to="/terms#refund-policy" replace />} />
          <Route path="/privacy-policy" element={<Navigate to="/terms#privacy-policy" replace />} />
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
            path="/learning/:packageId"
            element={<Learning />}
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
            path="/results/:attemptId/review"
            element={
              <ProtectedRoute>
                <ResultsReview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learning/:packageId/review/:sectionCode"
            element={
              <ProtectedRoute>
                <MiniTestReview />
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
          <Route
            path="/admin/learning-material/:packageId/:sectionCode"
            element={
              <AdminRoute>
                <AdminLearningMaterialEditor />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/question-editor/:packageId/:questionId"
            element={
              <AdminRoute>
                <AdminQuestionEditor />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/mini-test-question-editor/:packageId/:sectionCode/:questionId"
            element={
              <AdminRoute>
                <AdminMiniTestQuestionEditor />
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
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
