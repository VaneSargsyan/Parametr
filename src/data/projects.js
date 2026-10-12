import { contentFields } from '../i18n/content';

const records = [
  {
    "id": 1,
    "slug": "private-house-construction",
    "image": "/Images/Construction.avif",
    "gallery": [
      "/Images/Construction.avif"
    ],
    "categoryId": "construction"
  },
  {
    "id": 2,
    "slug": "land-survey",
    "image": "/Images/Geodesy.jpeg",
    "gallery": [
      "/Images/Geodesy.jpeg"
    ],
    "categoryId": "surveying"
  },
  {
    "id": 3,
    "slug": "modern-kitchen",
    "image": "/Images/Furniture.jpeg",
    "gallery": [
      "/Images/Furniture.jpeg"
    ],
    "categoryId": "furniture"
  },
  {
    "id": 4,
    "slug": "residential-house-design",
    "image": "/Images/Naxagic.jpeg",
    "gallery": [
      "/Images/Naxagic.jpeg"
    ],
    "categoryId": "design"
  },
  {
    "id": 5,
    "slug": "pvc-doors-windows",
    "image": "/Images/DoorWindow.jpeg",
    "gallery": [
      "/Images/DoorWindow.jpeg"
    ],
    "categoryId": "doorsWindows"
  }
];

export const projects = records.map(project => ({
    ...project,
    ...contentFields('projects', project.slug, ['title', 'description', 'longDescription', 'features']),
}));
