export interface RecentPhoto {
  id: string;
  src: string;
  alt: string;
  /** CSS object-position, e.g. "center 30%"; defaults to "center". */
  objectPosition?: string;
}
