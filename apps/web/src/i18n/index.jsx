import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import vi from './vi.js';
import en from './en.js';

const DICTS = { vi, en };
const STORAGE_KEY = 'carmate_lang';

const I18nContext = createContext({
  lang: 'vi',
  setLang: () => {},
  t: (k) => k
});

const getByPath = (obj, path) =>
  path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);

const interpolate = (str, params) => {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{${k}}`));
};

const detectInitialLang = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'vi' || saved === 'en') return saved;
  } catch {}

  // Trí tuệ Ambient: Tự động nhận diện theo ngôn ngữ máy/trình duyệt của người dùng
  try {
    if (typeof navigator !== 'undefined') {
      const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
      if (browserLang.startsWith('en')) {
        return 'en';
      }
    }
  } catch {}

  return 'vi';
};

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLang);

  const setLang = useCallback((next) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key, params) => {
      const primary = getByPath(DICTS[lang], key);
      const fallback = getByPath(DICTS.vi, key);
      const value = primary !== undefined ? primary : fallback;
      if (value === undefined) return key;
      if (typeof value === 'string') return interpolate(value, params);
      return value; // arrays / objects (e.g. lists of bullet points)
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

/** Dịch các giá trị dữ liệu quen thuộc (ngày, chiều đi) nếu có trong dictionary, ngược lại trả về nguyên bản. */
export const useDataLabel = () => {
  const { t, lang } = useI18n();
  return {
    date: (raw) => {
      if (!raw) return t('common.today');
      const map = t('data.dates');
      return (map && map[raw]) || raw;
    },
    direction: (dir) => (dir === 'sg_to_province' ? t('common.toProvince') : t('common.toSaigon')),
    lang
  };
};
