export const maxImageBytes = 5 * 1024 * 1024;
export const imageTypes = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function validateImage(file) {
    if (!file || !imageTypes[file.type] || file.size < 16 || file.size > maxImageBytes) throw new Error('pm.invalidImage');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const same = (at, values) => values.every((value, index) => bytes[at + index] === value);
    const ascii = (at, text) => same(at, [...text].map(char => char.charCodeAt(0)));
    const jpeg = same(0, [255, 216, 255]) && same(bytes.length - 2, [255, 217]);
    const png = same(0, [137,80,78,71,13,10,26,10]) && ascii(12, 'IHDR') && ascii(bytes.length - 8, 'IEND');
    const webp = ascii(0, 'RIFF') && ascii(8, 'WEBP') && new DataView(bytes.buffer).getUint32(4, true) + 8 === bytes.length;
    if (!(file.type === 'image/jpeg' && jpeg || file.type === 'image/png' && png || file.type === 'image/webp' && webp)) throw new Error('pm.invalidImage');
    const view = new DataView(bytes.buffer);
    let width = 0, height = 0;
    if (png && bytes.length >= 33) { width = view.getUint32(16); height = view.getUint32(20); }
    if (jpeg) {
        let position = 2;
        while (position + 9 < bytes.length) {
            if (bytes[position] !== 255) break;
            const marker = bytes[position+1];
            if (marker === 218 || marker === 217) break;
            const length = view.getUint16(position+2);
            if (length < 2 || position + 2 + length > bytes.length) break;
            if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) { height = view.getUint16(position+5); width = view.getUint16(position+7); break; }
            position += 2 + length;
        }
    }
    if (webp && ascii(12,'VP8X') && bytes.length >= 30) {
        width = 1 + bytes[24] + (bytes[25]<<8) + (bytes[26]<<16);
        height = 1 + bytes[27] + (bytes[28]<<8) + (bytes[29]<<16);
    } else if (webp && ascii(12,'VP8 ') && bytes.length >= 30 && same(23,[157,1,42])) {
        width = view.getUint16(26,true) & 16383; height = view.getUint16(28,true) & 16383;
    } else if (webp && ascii(12,'VP8L') && bytes.length >= 25 && bytes[20] === 47) {
        const bits = view.getUint32(21,true); width = (bits & 16383) + 1; height = ((bits >>> 14) & 16383) + 1;
    }
    if (!width || !height || width > 8192 || height > 8192 || width * height > 24000000) throw new Error('pm.invalidImage');
    return { bytes, extension: imageTypes[file.type], contentType: file.type };
}
