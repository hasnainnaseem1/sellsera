import React, { createContext, useContext, useState, useEffect } from 'react';
import config from '../config';

const defaultSite = {
  googleSSO: { enabled: false, clientId: '' },
  enableCustomerSignup: true,
  enableLogin: true,
  enableAnalysis: true,
  enableSubscriptions: true,
  maintenance: { enabled: false, message: '' },
};

const SiteContext = createContext({ siteConfig: defaultSite, loaded: false });

export const SiteProvider = ({ children }) => {
  const [siteConfig, setSiteConfig] = useState(defaultSite);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${config.apiUrl}/api/v1/public/site`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.site) {
          setSiteConfig({ ...defaultSite, ...data.site });
        }
      })
      .catch(() => {
        // Use defaults silently on network error
      })
      .finally(() => setLoaded(true));
  }, []);

  return (
    <SiteContext.Provider value={{ siteConfig, loaded }}>
      {children}
    </SiteContext.Provider>
  );
};

export const useSite = () => useContext(SiteContext);
