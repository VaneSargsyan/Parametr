import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources, supportedLanguages } from './resources';
import { normalizeLanguage, readLanguage, saveLanguage } from './language';

i18n.use(initReactI18next).init({
    resources,
    lng: readLanguage(),
    fallbackLng: 'hy',
    supportedLngs: supportedLanguages,
    interpolation: { escapeValue: false }, // React escapes rendered text.
    initAsync: false,
    react: { useSuspense: false },
});

function syncLanguage(language) {
    const selected = normalizeLanguage(language);
    if (typeof document !== 'undefined') document.documentElement.lang = selected;
    saveLanguage(selected);
}
i18n.on('languageChanged', syncLanguage);
syncLanguage(i18n.resolvedLanguage);

export default i18n;
