// A transport error is NOT proof that Postgres rejected/rolled back an insert.
// Only a confirmed rejection + successful absence check permits deleting the file.
export function registrationRecovery(error, lookup, expected) {
    if (lookup.error) return 'preserve';
    const row = lookup.data;
    if (row) return row.id === expected.id && row.project_id === expected.projectId && row.storage_path === expected.path ? 'recover' : 'preserve';
    return ['23502','23503','23505','23514','42501'].includes(error?.code) ? 'remove' : 'preserve';
}
