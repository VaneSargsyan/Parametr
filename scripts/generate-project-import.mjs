import fs from 'node:fs';
const source = fs.readFileSync('src/data/projects.js','utf8');
const records = JSON.parse(source.match(/const records = (\[[\s\S]*?\]);/)[1]);
const translations = Object.fromEntries(['hy','en','ru'].map(language => [language,JSON.parse(fs.readFileSync(`src/i18n/locales/${language}.json`,'utf8')).content.projects]));
const literal = value => `'${value.replaceAll("'","''")}'`;
const array = (values,type='text') => `array[${values.map(literal).join(',')}]::${type}[]`;
const uuid = (prefix,value) => `${prefix}-0000-4000-8000-${value.toString(16).padStart(12,'0')}`;
const publish = process.argv.includes('--publish');
let sql = '-- Generated offline from existing project records. Review before manual execution.\n-- Default imports are drafts. Existing rows are skipped, never updated.\nbegin;\n';
for (const record of records) {
    const id = uuid('40000000',record.id);
    const paths = [...new Set([record.image,...record.gallery])];
    const imageIds = paths.map((_,index)=>uuid('50000000',record.id*100+index));
    const columns = ['id','legacy_id','slug','category'];
    const values = [literal(id),String(record.id),literal(record.slug),literal(record.categoryId)];
    for (const language of ['hy','en','ru']) {
        const text = translations[language][record.slug];
        for (const [column,field] of [['title','title'],['description','description'],['long_description','longDescription'],['features','features']]) {
            columns.push(`${column}_${language}`); values.push(field==='features' ? array(text[field]) : literal(text[field]));
        }
    }
    sql += `\ndo $$\ndeclare imported uuid;\nbegin\n insert into public.projects (${columns.join(',')}) values (${values.join(',')}) on conflict do nothing returning id into imported;\n if imported is null then raise notice 'Skipping existing project: ${record.slug}'; return; end if;\n`;
    paths.forEach((path,index)=>{ sql+=` insert into public.project_images(id,project_id,legacy_path) values(${literal(imageIds[index])},${literal(id)},${literal(path)});\n`; });
    sql+=` update public.projects set cover_image_id=${literal(imageIds[paths.indexOf(record.image)])},gallery_image_ids=${array(record.gallery.map(path=>imageIds[paths.indexOf(path)]),'uuid')},status=${literal(publish?'published':'draft')} where id=imported;\nend $$;\n`;
}
sql+='commit;\n';
fs.mkdirSync('supabase/import',{ recursive:true });
fs.writeFileSync('supabase/import/legacy_projects.sql',sql);
console.log(`Generated ${records.length} ${publish?'published':'draft'} projects without contacting Supabase. Review supabase/import/legacy_projects.sql before running it manually.`);
