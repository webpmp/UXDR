import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { GlobalSearch } from './pages/GlobalSearch';
import { UserManagement } from './pages/UserManagement';
import { ProjectsList } from './pages/ProjectsList';
import { ProjectNew } from './pages/ProjectNew';
import { ProjectDetails } from './pages/ProjectDetails';
import { ReviewBoard } from './pages/ReviewBoard';
import { CalendarPage } from './pages/CalendarPage';
import { ExternalSurvey } from './pages/ExternalSurvey';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/survey/:reviewId" element={<ExternalSurvey />} />
            <Route path="/" element={<Layout />}>
               <Route index element={<Dashboard />} />
               <Route path="search" element={<GlobalSearch />} />
               <Route path="users" element={<UserManagement />} />
               <Route path="calendar" element={<CalendarPage />} />
               <Route path="projects" element={<ProjectsList />} />
               <Route path="projects/new" element={<ProjectNew />} />
               <Route path="projects/:id" element={<ProjectDetails />} />
               <Route path="projects/:id/reviews/:reviewId" element={<ReviewBoard />} />
               {/* Other routes will be added here */}
               <Route path="*" element={<div className="p-8 font-mono">404 Not Found</div>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
