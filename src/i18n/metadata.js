// Called by the route hook whenever the route or selected language changes.
export function applyPageMetadata(document, language, title, description) {
    document.documentElement.lang = language;
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
    }
    meta.content = description;
}
