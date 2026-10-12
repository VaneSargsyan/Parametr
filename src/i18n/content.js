import { resources, supportedLanguages } from './resources';
import { normalizeLanguage } from './language';

// Entity fields match the future content contract: title.hy, title.en, title.ru.
export function contentFields(collection, id, fields = ['title']) {
    return Object.fromEntries(fields.map(field => [field, Object.fromEntries(supportedLanguages.map(language => {
        const entity = resources[language].translation.content[collection][id];
        return [language, collection === 'categories' ? entity : entity[field]];
    }))]));
}

export function localized(field, language) {
    return field?.[normalizeLanguage(language)] ?? field?.hy ?? '';
}
