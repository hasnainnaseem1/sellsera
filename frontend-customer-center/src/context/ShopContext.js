import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import etsyApi from '../api/etsyApi';

const ShopContext = createContext(null);

export const useShop = () => {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be inside ShopProvider');
  return ctx;
};

const ACTIVE_SHOP_KEY = 'sellsera_active_shop';

export const ShopProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [shops, setShops] = useState([]);
  const [shopLimit, setShopLimit] = useState(1);
  const [shopLimitUnlimited, setShopLimitUnlimited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeShopId, setActiveShopId] = useState(() => {
    try { return localStorage.getItem(ACTIVE_SHOP_KEY) || null; } catch { return null; }
  });

  const hasShop = !!user?.etsyConnected;

  const fetchShops = useCallback(async () => {
    if (!token || !hasShop) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await etsyApi.getShopInfo();
      if (res.success && res.data) {
        const list = res.data.shops
          || (res.data.shop ? [{ id: res.data.shop.shopId, ...res.data.shop }] : []);
        setShops(list);
        setShopLimit(res.data.shopLimit ?? 1);
        setShopLimitUnlimited(res.data.shopLimitUnlimited || false);

        // Auto-select first shop if none active or active shop was removed
        if (list.length > 0) {
          const ids = list.map(s => s.id);
          if (!activeShopId || !ids.includes(activeShopId)) {
            selectShop(list[0].id);
          }
        } else {
          selectShop(null);
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [token, hasShop]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchShops(); }, [fetchShops]);

  const selectShop = (id) => {
    setActiveShopId(id);
    try {
      if (id) localStorage.setItem(ACTIVE_SHOP_KEY, id);
      else localStorage.removeItem(ACTIVE_SHOP_KEY);
    } catch { /* ignore */ }
  };

  const activeShop = shops.find(s => s.id === activeShopId) || shops[0] || null;

  return (
    <ShopContext.Provider value={{
      shops,
      activeShop,
      activeShopId: activeShop?.id || null,
      shopLimit,
      shopLimitUnlimited,
      loading,
      selectShop,
      refresh: fetchShops,
    }}>
      {children}
    </ShopContext.Provider>
  );
};

export default ShopContext;
