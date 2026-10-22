export const inquiryServices = ['construction','surveying','design','furniture','doorsWindows'];
export const inquiryStatuses = ['new','in_progress','completed','rejected'];
export function normalizeInquiry(input) {
    const text = key => typeof input?.[key] === 'string' ? input[key].trim() : '';
    return { fullName:text('fullName'),phone:text('phone').replace(/[\s().-]/g,''),email:text('email').toLowerCase(),service:text('service'),location:text('location'),description:text('description'),language:text('language'),privacyConsent:input?.privacyConsent === true };
}
export const catalogInquiryServices = [...inquiryServices,'realEstate'];
export function inquiryErrors(value,services=inquiryServices) {
    const errors = {};
    // PostgreSQL UTF-8 length(text) counts code points, not UTF-16 units or
    // visual grapheme clusters. Do not normalize or rewrite submitted text.
    const length = (key,min,max) => {
        if (typeof value[key] !== 'string') { errors[key]='inquiry.invalidField';return; }
        const characters=Array.from(value[key]);
        if (characters.length<min || characters.length>max || characters.some(char => {
            const code=char.codePointAt(0);
            return code===127 || (code<32 && ![9,10,13].includes(code)) || (code>=0xd800 && code<=0xdfff);
        })) errors[key]='inquiry.invalidField';
    };
    length('fullName',2,120); length('location',2,300); length('description',10,5000);
    if (!/^\+?[0-9]{7,15}$/.test(value.phone)) errors.phone='inquiry.invalidPhone';
    if (value.email && (Array.from(value.email).length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))) errors.email='form.invalidEmail';
    if (!services.includes(value.service)) errors.service='inquiry.invalidField';
    if (!['hy','en','ru'].includes(value.language)) errors.language='inquiry.invalidField';
    if (value.privacyConsent!==true) errors.privacyConsent='inquiry.consentRequired';
    return errors;
}
export const inquiryUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
