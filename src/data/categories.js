import { contentFields } from '../i18n/content';

export const categories = ["construction", "surveying", "design", "furniture", "doorsWindows"].map(id => ({ id, ...contentFields('categories', id) }));
