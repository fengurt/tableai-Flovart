import React, { useState, useEffect } from 'react';
import { creditsApi, type TopupTier } from '../services/creditsApi';

interface TopupPanelProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number | null;
  resolvedTheme: 'light' | 'dark';
  onTopupComplete: () => void;
}

const TIER_LABELS: Record<string, { price: string; bonus: string }> = {
  tier_10:  { price: '¥10',  bonus: '' },
  tier_50:  { price: '¥50',  bonus: '+10%' },
  tier_100: { price: '¥100', bonus: '+20%' },
};

export const TopupPanel: React.FC<TopupPanelProps> = ({
  isOpen,
  onClose,
  balance,
  resolvedTheme,
  onTopupComplete,
}) => {
  const [tiers, setTiers] = useState<TopupTier[]>([]);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    creditsApi.getTiers().then(setTiers).catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const isDark = resolvedTheme === 'dark';

  const handleTopup = async () => {
    if (!selectedTier || ordering) return;
    setOrdering(true);
    try {
      const result = await creditsApi.createTopup(selectedTier);
      // TODO: 对接支付渠道后，这里跳转支付页面
      // 当前直接提示订单已创建
      alert(`订单已创建：${result.orderId}\n积分：${result.credits}\n待接入支付渠道`);
      onTopupComplete();
      onClose();
    } catch {
      alert('创建订单失败');
    } finally {
      setOrdering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="isl-shell w-full max-w-100 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-[var(--isl-ink)]">充值积分</h3>
            <p className="mt-1 text-sm text-[var(--isl-ink-soft)]">
              当前余额：<span className="font-bold text-[var(--isl-mint-deep)]">{balance ?? '—'}</span> 积分
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
              isDark ? 'border-[#2A3140] text-[#98A2B3] hover:bg-[#1B2029]' : 'border-[#E4E7EC] text-[#667085] hover:bg-[#F9FAFB]'
            }`}
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {tiers.map((tier) => {
            const label = TIER_LABELS[tier.id];
            const active = selectedTier === tier.id;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => setSelectedTier(tier.id)}
                className={`flex w-full items-center justify-between rounded-2xl border-[1.5px] p-4 text-left transition ${
                  active
                    ? 'border-[var(--isl-mint)] bg-[var(--isl-mint-bg)]'
                    : 'border-[var(--isl-border)] bg-[var(--isl-surface-2)] hover:border-[var(--isl-border-strong)]'
                }`}
              >
                <div>
                  <div className="text-lg font-bold text-[var(--isl-ink)]">
                    {label?.price || `¥${tier.priceCents / 100}`}
                  </div>
                  <div className="mt-0.5 text-sm text-[var(--isl-ink-soft)]">
                    {tier.credits.toLocaleString()} 积分
                    {label?.bonus && (
                      <span className="ml-2 rounded-full bg-[var(--isl-mint-bg)] px-2 py-0.5 text-xs font-bold text-[var(--isl-mint-deep)]">
                        {label.bonus}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-[var(--isl-ink-soft)]">
                  ≈ {Math.floor(tier.credits / 50)} 张图
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleTopup}
          disabled={!selectedTier || ordering}
          className="isl-go mt-6 w-full px-4 py-3 text-sm disabled:opacity-50"
        >
          {ordering ? '创建中...' : '确认充值'}
        </button>
      </div>
    </div>
  );
};
