import { applyPageMetadata } from '../i18n/metadata';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function usePageMetadata(title, description) {
    const { t, i18n } = useTranslation();
    const pageTitle = title || t('seo.title');
    const pageDescription = description || t('seo.description');
    useEffect(() => {
        applyPageMetadata(document, i18n.resolvedLanguage || 'hy', pageTitle, pageDescription);
    }, [pageTitle, pageDescription, i18n.resolvedLanguage]);
}
