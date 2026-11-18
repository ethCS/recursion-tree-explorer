import { useCallback, useEffect, useState } from 'react';

/** A boolean setting remembered per browser. Storage can be unavailable, so every access is guarded. */
export function useLocalSetting(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = useState<boolean>(() => {
    try {
      const s = localStorage.getItem(key);
      return s === null ? initial : s === '1';
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (nv: boolean) => {
      setV(nv);
      try {
        localStorage.setItem(key, nv ? '1' : '0');
      } catch {
        /* storage unavailable: setting lasts for this visit only */
      }
    },
    [key],
  );
  return [v, set];
}

const RM = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  const [v, setV] = useState(() => window.matchMedia?.(RM).matches ?? false);
  useEffect(() => {
    const m = window.matchMedia?.(RM);
    if (!m) return;
    const on = () => setV(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return v;
}

export type Theme = 'system' | 'light' | 'dark';

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem('rte.theme');
      return t === 'light' || t === 'dark' ? t : 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('rte.theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const cycle = useCallback(() => setTheme((t) => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system')), []);
  return [theme, cycle];
}
