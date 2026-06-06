import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CanvasSettings } from '../components/CanvasSettings';

function renderSettings() {
  return render(
    <CanvasSettings
      isOpen
      onClose={() => undefined}
      language="zho"
      setLanguage={() => undefined}
      themeMode="dark"
      resolvedTheme="dark"
      setThemeMode={() => undefined}
      wheelAction="zoom"
      setWheelAction={() => undefined}
    />,
  );
}

describe('CanvasSettings UI', () => {
  it('renders theme and interaction sections without API configuration', () => {
    renderSettings();

    expect(screen.getByText('界面主题')).toBeTruthy();
    expect(screen.getByText('语言与交互')).toBeTruthy();
    expect(screen.queryByText('API 配置')).toBeNull();
    expect(screen.queryByText('模型偏好')).toBeNull();
    expect(screen.queryByText(/添加供应商/i)).toBeNull();
  });
});
