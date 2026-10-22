import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createInstance } from 'i18next';
import { readLanguage, saveLanguage, languageStorageKey } from '../src/i18n/language.js';
import { applyPageMetadata } from '../src/i18n/metadata.js';
import { validateContact } from '../src/components/Contact/validation.js';

const languages = ['hy', 'en', 'ru'];
const dictionaries = Object.fromEntries(languages.map(language => [language, JSON.parse(fs.readFileSync(new URL(`../src/i18n/locales/${language}.json`, import.meta.url), 'utf8'))]));
function flatten(value, prefix = '') {
    return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return typeof item === 'object' ? Object.entries(flatten(item, path)) : [[path, item]];
    }));
}
const flat = Object.fromEntries(languages.map(language => [language, flatten(dictionaries[language])]));
const keys = Object.keys(flat.hy).sort();
for (const language of languages) {
    assert.deepEqual(Object.keys(flat[language]).sort(), keys, `${language}: translation structure mismatch`);
    for (const key of keys) {
        assert.equal(typeof flat[language][key], 'string');
        assert(flat[language][key].trim(), `${language}: empty ${key}`);
        const variables = text => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map(match => match[1]).sort();
        assert.deepEqual(variables(flat[language][key]), variables(flat.hy[key]), `${language}: interpolation mismatch ${key}`);
    }
}
function sourceFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sourceFiles(`${dir}/${entry.name}`) : /\.(jsx|js)$/.test(entry.name) ? [`${dir}/${entry.name}`] : []);
}
for (const file of sourceFiles('src')) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bt\(['"]([^'"]+)['"]/g)) assert(keys.includes(match[1]), `Missing key ${match[1]} in ${file}`);
}

// Metadata updates reuse one description tag across route/language transitions.
const tags = [];
const documentStub = {
    documentElement: {},
    head: { appendChild: node => tags.push(node) },
    createElement: () => ({}),
    querySelector: () => tags.find(node => node.name === 'description'),
};
for (const language of languages) {
    const dictionary = dictionaries[language];
    for (const [title, description] of [
        [dictionary.seo.title, dictionary.seo.description],
        ...Object.values(dictionary.content.projects).map(project => [`${project.title} | ${dictionary.brand.name}`, project.description]),
        [dictionary.project.notFound, dictionary.project.notFoundDescription],
        [dictionary.errors.title, dictionary.errors.description],
    ]) {
        applyPageMetadata(documentStub, language, title, description);
        assert.equal(documentStub.documentElement.lang, language);
        assert.equal(documentStub.title, title);
        assert.equal(tags.length, 1);
        assert.equal(tags[0].content, description);
    }
}

// Storage tests simulate a refresh by creating a new i18next instance from saved state.
const stored = new Map();
globalThis.window = {
    localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
    navigator: { language: 'ru-RU' },
    matchMedia: () => ({ matches: true }),
};
assert.equal(readLanguage(), 'hy', 'First visit must ignore browser language');
for (const language of languages) {
    saveLanguage(language);
    const refreshed = createInstance();
    await refreshed.init({ lng: readLanguage(), fallbackLng: 'hy', resources: Object.fromEntries(languages.map(lang => [lang, { translation: dictionaries[lang] }])) });
    assert.equal(refreshed.resolvedLanguage, language);
}
stored.set(languageStorageKey, 'invalid');
assert.equal(readLanguage(), 'hy');
const workingStorage = globalThis.window.localStorage;
Object.defineProperty(globalThis.window, 'localStorage', { configurable: true, get() { throw new Error('Blocked storage'); } });
assert.equal(readLanguage(), 'hy');
assert.doesNotThrow(() => saveLanguage('ru'));
Object.defineProperty(globalThis.window, 'localStorage', { configurable: true, value: workingStorage });
stored.clear();

assert.deepEqual(validateContact({ fullName: ' ', phone: '' }), { fullName: 'form.required', phone: 'form.required' });
assert.deepEqual(validateContact({ fullName: 'Test', phone: '+374 55 10 60 70', email: '' }), {});
assert.equal(validateContact({ fullName: 'Test', phone: '055106070', email: 'invalid' }).email, 'form.invalidEmail');

// Vite transforms the actual JSX and CSS modules; no extra testing dependency is needed.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', define: { 'import.meta.env.VITE_PROJECTS_SOURCE': '"local"', 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '""', 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '""' } });
try {
    const { default: i18n } = await server.ssrLoadModule('/src/i18n/index.js');
    const { MainLayout } = await server.ssrLoadModule('/src/Layouts/MainLayout.jsx');
    const { default: ProjectDetails } = await server.ssrLoadModule('/src/pages/ProjectDetails/ProjectDetails.jsx');
    const { default: ErrorPage } = await server.ssrLoadModule('/src/pages/ErrorPage/ErrorPage.jsx');
    const { projects } = await server.ssrLoadModule('/src/data/projects.js');
    const { categories } = await server.ssrLoadModule('/src/data/categories.js');
    const { services } = await server.ssrLoadModule('/src/data/services.js');
    const { localized } = await server.ssrLoadModule('/src/i18n/content.js');
    assert.equal(i18n.resolvedLanguage, 'hy');
    assert.equal(projects.length, 5);
    assert.equal(services.length, 6);
    assert.equal(new Set(projects.map(project => project.slug)).size, 5);
    for (const category of categories) assert(projects.some(project => project.categoryId === category.id));
    for (const project of projects) for (const image of [project.image, ...project.gallery]) assert(fs.existsSync(`public${image}`), image);
    assert.equal(localized(projects[0].title, 'invalid'), projects[0].title.hy);
    const actualT = i18n.t.bind(i18n);
    i18n.t = (key, options) => {
        for (const candidate of Array.isArray(key) ? key : [key]) assert(i18n.exists(candidate, { lng: i18n.resolvedLanguage, fallbackLng: false }), `Missing runtime key: ${candidate}`);
        return actualT(key, options);
    };
    const paths = ['/', ...projects.map(project => `/projects/${project.slug}`), '/projects/missing-project', '/missing-page'];
    let renderCount = 0;
    for (const language of languages) {
        await i18n.changeLanguage(language);
        assert.equal(readLanguage(), language, 'Runtime language selection must persist');
        for (const path of paths) {
            const router = createMemoryRouter([
                { path: '/', element: React.createElement(MainLayout) },
                { path: '/projects/:slug', element: React.createElement(ProjectDetails) },
                { path: '*', element: React.createElement(ErrorPage) },
            ], { initialEntries: [path] });
            try {
                const html = renderToStaticMarkup(React.createElement(RouterProvider, { router }));
                assert(!html.includes('[object Object]'));
                assert(!html.includes('{{'));
                for (const code of languages) {
                    const pressed = code === language;
                    assert(html.includes(`aria-label="${{ hy: 'Հայերեն', en: 'English', ru: 'Русский' }[code]}"`));
                    assert(new RegExp(`aria-pressed="${pressed}"[^>]*>${code.toUpperCase()}</button>`).test(html));
                }
                const visible = html.replace(/<[^>]+>/g, '');
                if (language !== 'hy') assert(!/[Ա-Ֆա-ֆ]/.test(visible), `${path} has untranslated Armenian text in ${language}`);
                if (path === '/') {
                    assert.equal((html.match(/href="\/projects\//g) || []).length, 5);
                    assert.equal((html.match(/<article/g) || []).length, 6);
                    assert(html.includes(dictionaries[language].contact.notice));
                    assert(html.includes('noValidate=""'));
                    for (const category of categories) assert(html.includes(localized(category.title, language)));
                } else {
                    const project = projects.find(item => path === `/projects/${item.slug}`);
                    if (project) {
                        assert(html.includes(localized(project.title, language)));
                        assert(html.includes(localized(project.longDescription, language)));
                        for (const image of project.gallery) assert(html.includes(`href="${image}"`));
                    } else assert(html.includes(path.startsWith('/projects/') ? dictionaries[language].project.notFound : dictionaries[language].errors.title));
                }
                renderCount++;
            } finally { router.dispose(); }
        }
    }
    console.log(`PASS: ${keys.length} translation leaves per language; key/interpolation parity; ${renderCount} route/language renders; switcher markup; galleries; category data; persistence/blocked storage; validation.`);
    console.log('These checks do not replace desktop/mobile browser interaction and layout testing.');
} finally {
    await server.close();
    delete globalThis.window;
}
