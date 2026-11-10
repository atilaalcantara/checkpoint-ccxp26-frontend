import demoPhotos from '../assets/demo-photos.json';
import type { RecentPhoto } from '../types/recent-photo';

/**
 * DEMO-ONLY placeholder content (free-license Unsplash stock photos — see
 * source-assets/demo/ and scripts/prepare-demo-photos.mjs). There is no
 * gallery backend yet, so these three entries exist purely to validate the
 * RecentPhotos "fan" composition against the approved prototype.
 *
 * Replace this export with the real ASP.NET Core response — an array of
 * exactly three `RecentPhoto` — once the gallery backend exists. Nothing
 * here represents a real visitor upload.
 */
export const DEMO_RECENT_PHOTOS: RecentPhoto[] = [
  { id: 'demo-1', src: demoPhotos['demo-photo-1'].avif, alt: 'Foto de demonstração — grupo de amigos sorrindo' },
  { id: 'demo-2', src: demoPhotos['demo-photo-2'].avif, alt: 'Foto de demonstração — grupo de amigas tirando selfie' },
  { id: 'demo-3', src: demoPhotos['demo-photo-3'].avif, alt: 'Foto de demonstração — grupo de pessoas reunidas' },
];
