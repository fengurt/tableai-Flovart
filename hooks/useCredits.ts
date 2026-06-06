import { useState, useEffect, useCallback } from 'react';
import { creditsApi, type CreditBalance } from '../services/creditsApi';

export function useCredits() {
  const [balance, setBalance] = useState<number | null>(null);
  const [costPerImage, setCostPerImage] = useState(50);
  const [loading, setLoading] = useState(true);
  const [showTopup, setShowTopup] = useState(false);

  const refreshBalance = useCallback(async () => {
    try {
      const data: CreditBalance = await creditsApi.getBalance();
      setBalance(data.balance);
      setCostPerImage(data.costPerImage);
    } catch {
      // 后端不可用时不阻塞前端
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

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
    } catch {
      // 静默失败，可重试
    }
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
