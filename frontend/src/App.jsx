import React from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PreferencesProvider, usePreferences } from './context/PreferencesContext'
import { UserInteractionsProvider } from './context/UserInteractionsContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import MainLayout from './components/layout/MainLayout'
import OnboardingModal from './components/OnboardingModal'
import Home from './pages/Home'
import FindYourMovie from './pages/FindYourMovie'
import Watchlist from './pages/Watchlist'
import Favourites from './pages/Favourites'
import Settings from './pages/Settings'
import MovieDetails from './pages/MovieDetails'
import PersonDetails from './pages/PersonDetails'
import Login from './pages/Login'
import Register from './pages/Register'
import SearchResults from './pages/SearchResults'

const AppRoutes = () => {
  const location = useLocation()
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isOnboardingComplete, loading: prefLoading } = usePreferences();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'

  // Auth pages render without MainLayout (full-screen)
  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    )
  }

  const showOnboarding = isAuthenticated && !authLoading && !prefLoading && !isOnboardingComplete;

  return (
    <>
      {showOnboarding && <OnboardingModal />}
      <MainLayout>
      <div className="max-w-page mx-auto w-full">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/find" element={
            <ProtectedRoute><FindYourMovie /></ProtectedRoute>
          } />
          <Route path="/movie/:tmdbId" element={
            <ProtectedRoute><MovieDetails /></ProtectedRoute>
          } />
          <Route path="/person/:personId" element={
            <ProtectedRoute><PersonDetails /></ProtectedRoute>
          } />
          <Route path="/search" element={
            <ProtectedRoute><SearchResults /></ProtectedRoute>
          } />
          <Route path="/watchlist" element={
            <ProtectedRoute><Watchlist /></ProtectedRoute>
          } />
          <Route path="/favourites" element={
            <ProtectedRoute><Favourites /></ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute><Settings /></ProtectedRoute>
          } />
        </Routes>
      </div>
    </MainLayout>
    </>
  )
}

const App = () => {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <PreferencesProvider>
            <UserInteractionsProvider>
              <AppRoutes />
            </UserInteractionsProvider>
          </PreferencesProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  )
}

export default App