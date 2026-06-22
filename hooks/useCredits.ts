import { useState, useEffect, useCallback, useRef } from 'react';
import { useLogto } from '@logto/react';
import { creditsApi, setTokenProvider, type CreditBalance } from '../services/creditsApi';

export function useCredits() {
  const { isAuthenticated, getIdToken } = useLogto();
  const [balance, setBalance] = useState<number | null>(null);
  const [costPerImage, setCostPerImage] = useState(50);
  const [loading, setLoading] = useState(true);
  const [showTopup, setShowTopup] = useState(false);
  const initialized = useRef(false);

  // 登录后：设置 token provider → 立即拉余额
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    if (initialized.current) return;
    initialized.current = true;

    setTokenProvider(async () => {
      const token = await getIdToken();
      if (!token) throw new Error('No ID token available');
      return token;
    });

    creditsApi.getBalance()
      .then((data: CreditBalance) => {
        setBalance(data.balance);
        setCostPerImage(data.costPerImage);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated, getIdToken]);

  const refreshBalance = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data: CreditBalance = await creditsApi.getBalance();
      setBalance(data.balance);
      setCostPerImage(data.costPerImage);
    } catch {
      // 后端不可用时不阻塞前端
    }
  }, [isAuthenticated]);

  const deductForGeneration = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      const result = await creditsApi.deduct(taskId);
      if ('error' in result && result.error === 'INSUFFICIENT_CREDITS') {
        setBalance(result.balance);
        setShowTopup(true);
        return false;
      }
      setBalance(result.balance);
      return true;
    } catch {
      return false;
    }
  }, []);

  const refundGeneration = useCallback(async (taskId: string) => {
    try {
      const result = await creditsApi.refund(taskId);
      setBalance(result.balance);
    } catch {}
  }, []);

  return {
    balance,
    costPerImage,
    loading,
    showTopup,
    setShowTopup,
    refreshBalance,
    deductForGeneration,
    refundGeneration,
  };
}
