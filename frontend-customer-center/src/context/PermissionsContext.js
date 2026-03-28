import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axiosInstance from '../api/axiosInstance';
import { useAuth } from './AuthContext';

const PermissionsContext = createContext(null);

export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be inside PermissionsProvider');
  return ctx;
};

export const PermissionsProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [features, setFeatures] = useState({});
  const [plan, setPlan] = useState({ name: 'Free', status: 'none' });
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const [subRes, usageRes] = await Promise.all([
        axiosInstance.get('/api/v1/customer/subscription'),
        axiosInstance.get('/api/v1/customer/subscription/usage'),
      ]);

      const sub = subRes.data?.subscription || {};
      const usageList = usageRes.data?.usage || [];

      setPlan({
        name:    sub.planName || user?.planSnapshot?.planName || 'Free',
        status:  sub.status || 'none',
        isActive: sub.isActive || false,
        trialEndsAt:    sub.trialEndsAt,
        expiresAt:      sub.expiresAt,
        monthlyResetDate: sub.monthlyResetDate || usageRes.data?.monthlyResetDate,
      });

      // Build feature map from subscription features + usage
      const featureMap = {};
      const subFeatures = subRes.data?.features || [];
      subFeatures.forEach(f => {
        featureMap[f.featureKey] = {
          enabled: true,
          limit:   f.limit,
          used:    0,
          remaining: f.limit,
          unlimited: f.limit === null || f.limit === undefined || f.limit === -1,
        };
      });

      // Merge usage data (including live limits)
      usageList.forEach(u => {
        if (featureMap[u.featureKey]) {
          featureMap[u.featureKey].used      = u.used || 0;
          featureMap[u.featureKey].remaining  = u.remaining;
          featureMap[u.featureKey].unlimited  = u.unlimited || false;
          // Update limit from usage response (has live plan data)
          if (u.limit !== undefined) {
            featureMap[u.featureKey].limit = u.limit;
          }
        }
      });

      setFeatures(featureMap);
    } catch (err) {
      // Subscription endpoint may 403 if not enabled — silently ignore
      console.warn('Permissions fetch failed:', err?.response?.status);
    } finally {
      setLoading(false);
    }
  }, [token, user?.planSnapshot?.planName]);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  /**
   * Get the access state for a specific feature.
   * Returns: { state: 'unlocked' | 'locked' | 'limit_reached', ...details }
   */
  const getFeatureAccess = useCallback((featureKey) => {
    const f = features[featureKey];
    if (!f || !f.enabled) {
      return { state: 'locked', featureKey, enabled: false, limit: null, used: 0, remaining: 0, unlimited: false };
    }
    if (!f.unlimited && f.limit !== null && f.limit !== undefined && f.remaining !== null && f.remaining <= 0) {
      return { state: 'limit_reached', featureKey, ...f };
    }
    return { state: 'unlocked', featureKey, ...f };
  }, [features]);

  /**
   * Check if any feature is above 80% usage
   */
  const hasQuotaWarning = Object.values(features).some(f => {
    if (f.unlimited || !f.limit) return false;
    return (f.used / f.limit) >= 0.8;
  });

  return (
    <PermissionsContext.Provider value={{
      features,
      plan,
      loading,
      getFeatureAccess,
      hasQuotaWarning,
      refresh: fetchPermissions,
    }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export default PermissionsContext;
