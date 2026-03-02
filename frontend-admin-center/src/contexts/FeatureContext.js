import React, { createContext, useContext, useState, useEffect } from 'react';

const FeatureContext = createContext({
  features: {
    enableCustomerSignup: true,
    enableLogin: true,
    enableAnalysis: true,
    enableSubscriptions: true,
    enableCustomRoles: true,
    enableActivityLogs: true,
  },
  loaded: false,
});

export const FeatureProvider = ({ children }) => {
  const [features, setFeatures] = useState({
    enableCustomerSignup: true,
    enableLogin: true,
    enableAnalysis: true,
    enableSubscriptions: true,
    enableCustomRoles: true,
    enableActivityLogs: true,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        if (!token) { setLoaded(true); return; }

        const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const res = await fetch(`${API}/api/v1/admin/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.settings?.features) {
          setFeatures((prev) => ({ ...prev, ...data.settings.features }));
        }
      } catch {
        // Use defaults silently on error
      } finally {
        setLoaded(true);
      }
    };
    fetchFeatures();
  }, []);

  return (
    <FeatureContext.Provider value={{ features, loaded }}>
      {children}
    </FeatureContext.Provider>
  );
};

export const useFeatures = () => useContext(FeatureContext);
