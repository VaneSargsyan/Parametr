import { contentFields } from '../i18n/content';

const records = [
  {
    "id": "surveying",
    "iconPath": "M4 20 12 4l8 16H4Zm8-16v16M7 14h10"
  },
  {
    "id": "construction",
    "iconPath": "M4 21V6h16v15M8 10h2m4 0h2M8 14h2m4 0h2M10 21v-3h4v3"
  },
  {
    "id": "design",
    "iconPath": "M4 20h16M6 17 17 6l3 3L9 20H6v-3Zm9-9 3 3"
  },
  {
    "id": "furniture",
    "iconPath": "M5 12V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M3 10v8h18v-8M3 14h18M5 18v3m14-3v3"
  },
  {
    "id": "doorsWindows",
    "iconPath": "M3 3h18v18H3V3Zm9 0v18M3 12h18"
  },
  {
    "id": "realEstate",
    "iconPath": "M3 11 12 3l9 8M5 10v11h14V10M10 21v-7h4v7"
  }
];

export const services = records.map(service => ({ ...service, ...contentFields('services', service.id, ['title', 'description']) }));
