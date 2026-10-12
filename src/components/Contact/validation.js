// UI-only validation. The form remains disconnected; server validation comes later.
export function validateContact(values) {
    const errors = {};
    if (!values.fullName?.trim()) errors.fullName = 'form.required';
    if (!values.phone?.trim()) errors.phone = 'form.required';
    const email = values.email?.trim();
    if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) errors.email = 'form.invalidEmail';
    return errors;
}
