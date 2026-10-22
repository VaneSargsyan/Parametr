export const languages = ['hy','en','ru'];
export const categoryIds = ['construction','surveying','design','furniture','doorsWindows'];
export function emptyProject() {
    const row = { category: 'construction', slug: '', status: 'draft', cover_image_id: null, gallery_image_ids: [] };
    for (const language of languages) {
        for (const field of ['title','description','long_description','location']) row[`${field}_${language}`] = '';
        row[`features_${language}`] = [];
    }
    return row;
}
export function validateProject(row) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.slug) || row.slug.length > 120 || !categoryIds.includes(row.category) || !['draft','published'].includes(row.status) || !row.title_hy.trim()) return 'pm.invalid';
    for (const language of languages) {
        for (const [field,max] of [['title',200],['description',2000],['long_description',15000],['location',300]]) if (typeof row[`${field}_${language}`] !== 'string' || row[`${field}_${language}`].length > max) return 'pm.invalid';
        const features = row[`features_${language}`];
        if (!Array.isArray(features) || features.length > 20 || features.some(item => !item.trim() || item.length > 500)) return 'pm.invalid';
        if (row.status === 'published' && ['title','description','long_description'].some(field => !row[`${field}_${language}`].trim())) return 'pm.translationsRequired';
    }
    if (row.gallery_image_ids.length > 30 || new Set(row.gallery_image_ids).size !== row.gallery_image_ids.length) return 'pm.invalid';
    if (row.status === 'published' && (!row.cover_image_id || languages.some(language => row[`features_${language}`].length !== row.features_hy.length))) return 'pm.publishRequired';
    return null;
}
export function projectPayload(row) {
    const fields = ['slug','category','status','cover_image_id','gallery_image_ids', ...languages.flatMap(language => ['title','description','long_description','location','features'].map(field => `${field}_${language}`))];
    return Object.fromEntries(fields.map(field => [field, row[field]]));
}
export function toPublicProject(row, images) {
    const field = name => Object.fromEntries(languages.map(language => [language, row[`${name}_${language}`]]));
    return { id: row.id, legacyId: row.legacy_id, slug: row.slug, categoryId: row.category, title: field('title'), description: field('description'), longDescription: field('long_description'), location: field('location'), features: field('features'), image: images.get(row.cover_image_id)?.url || '', gallery: row.gallery_image_ids.map(id => images.get(id)?.url).filter(Boolean) };
}
export function moveImage(ids, index, direction) {
    const target = index + direction; if (target < 0 || target >= ids.length) return ids;
    const next = [...ids]; [next[index],next[target]] = [next[target],next[index]]; return next;
}
