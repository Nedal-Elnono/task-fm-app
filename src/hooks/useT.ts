import { useStore } from '../store/useStore';
import { translations } from '../i18n';

export function useT() {
  const language = useStore((s) => s.settings.language);
  const labelOverrides = useStore((s) => s.settings.labelOverrides);
  const base = translations[language as keyof typeof translations] ?? translations.en;
  const overrides = labelOverrides?.[language as 'en' | 'ar'] ?? {};
  if (Object.keys(overrides).length === 0) return base;
  return { ...base, ...overrides } as typeof base;
}
