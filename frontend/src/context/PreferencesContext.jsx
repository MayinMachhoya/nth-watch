import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from './AuthContext';
import { useAuth } from './AuthContext';

const PreferencesContext = createContext(null);

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
};

export const PreferencesProvider = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setPreferences(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await apiFetch('/api/users/preferences', {}, token);
      setPreferences(res.data);
    } catch (err) {
      console.error('Failed to fetch preferences', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreferences = async (newPrefs) => {
    try {
      const payload = { ...preferences, ...newPrefs };
      const res = await apiFetch('/api/users/preferences', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, token);
      setPreferences(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to update preferences', err);
      throw err;
    }
  };

  const isOnboardingComplete = preferences?.onboarding_complete === true;

  return (
    <PreferencesContext.Provider value={{ preferences, loading, updatePreferences, isOnboardingComplete, fetchPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
};
