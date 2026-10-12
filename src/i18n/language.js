export const languageStorageKey = 'parametr.language';
export const normalizeLanguage = language => ['hy', 'en', 'ru'].includes(language) ? language : 'hy';

export function readLanguage() {
    try { return normalizeLanguage(window.localStorage.getItem(languageStorageKey)); }
    catch { return 'hy'; }
}

export function saveLanguage(language) {
    try { window.localStorage.setItem(languageStorageKey, normalizeLanguage(language)); }
    catch { /* Language selection still works when storage is blocked. */ }
}
