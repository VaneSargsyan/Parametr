import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../../i18n/resources';
import styles from './LanguageSwitcher.module.css';
const names = { hy: 'Հայերեն', en: 'English', ru: 'Русский' };

export const LanguageSwitcher = ({ tone = 'dark' }) => {
    const { t, i18n } = useTranslation();
    return (
        <div className={styles.switcher} data-tone={tone} role="group" aria-label={t('language.label')}>
            {supportedLanguages.map(language => (
                <button key={language} type="button" lang={language}
                    aria-label={names[language]} title={names[language]}
                    aria-pressed={i18n.resolvedLanguage === language}
                    onClick={() => i18n.changeLanguage(language)}>{language.toUpperCase()}</button>
            ))}
        </div>
    );
};
