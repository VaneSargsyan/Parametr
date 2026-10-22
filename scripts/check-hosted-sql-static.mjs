// Static structure checks only: does not load a database engine or execute SQL.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql = fs.readFileSync('supabase/tests/projects_security_hosted.sql','utf8');
// Preserve dollar-quoted DO bodies as single tokens; split only real outer statements.
const tokens = sql.match(/--[^\n]*|\/\*[\s\S]*?\*\/|\$([A-Za-z_][A-Za-z_0-9]*)?\$[\s\S]*?\$\1\$|'(?:''|[^'])*'|"(?:""|[^"])*"|[^'"$;/-]+|[\s\S]/g) ?? [];
const statements=[]; let current='';
for (const token of tokens) {
    if (token.startsWith('--') || token.startsWith('/*')) continue;
    if (token===';') { if (current.trim()) statements.push(current.trim()); current=''; }
    else current+=token;
}
assert.equal(current.trim(),'','Final statement must end with semicolon');
assert.equal(statements[0].toLowerCase(),'begin');
const rollbackPositions=statements.flatMap((s,i)=>/^rollback$/i.test(s)?[i]:[]);
assert.equal(rollbackPositions.length,2,'Fixture and verification transactions must roll back');
const [fixtureEnd,verificationEnd]=rollbackPositions;
assert.equal(verificationEnd,statements.length-1);
assert.equal(statements[fixtureEnd+1].toLowerCase(),'begin transaction read only');
assert(statements.slice(fixtureEnd+2,verificationEnd).every(s=>/^(set local|do\s+\$|select\s)/i.test(s)),'Verification transaction must contain only settings/read-only assertions/result');
assert(statements[verificationEnd-1].includes('as security_test_result'),'Explicit PASS row required');
assert(!statements.some(s=>/^(commit|end(?:\s+transaction)?|prepare transaction)\b/i.test(s)),'No commit/transaction preparation');
assert(!/(?:insert\s+into|update|delete\s+from|alter\s+table|truncate(?:\s+table)?)\s+storage\./i.test(sql),'No Storage mutations');
const disabled=statements.findIndex(s=>/^alter table public.projects disable trigger validate_project$/i.test(s));
const enabled=statements.findIndex(s=>/^alter table public.projects enable trigger validate_project$/i.test(s));
const granted=statements.findIndex(s=>/^grant execute on function private.queue_project_file\(\) to authenticated$/i.test(s));
const revoked=statements.findIndex(s=>/^revoke execute on function private.queue_project_file\(\) from authenticated$/i.test(s));
assert(disabled>0 && disabled<enabled && enabled<fixtureEnd);
assert(granted>0 && granted<revoked && revoked<fixtureEnd);
assert(statements.filter(s=>/^set\s+(?:local\s+)?role\b/i.test(s)).every(s=>/^set local role (anon|authenticated|service_role)$/i.test(s)),'Only transaction-local intended roles');
assert(sql.includes("exception when insufficient_privilege then null") && sql.includes("exception when foreign_key_violation then null"));
console.log(`PASS: ${statements.length} outer statements; two rollback-only transactions; protected trigger/ACL change ordering; local roles; explicit PASS result; no Storage mutations.`);
console.log('Static checks only. No SQL parsed by PostgreSQL or executed; no hosted behavior verified.');
