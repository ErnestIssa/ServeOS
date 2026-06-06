/** Public marketing assets — icons live under /icons, product screenshots under /imgs. */
export function iconPath(file: string): string {
  return `/icons/${file}`;
}

export function imgPath(file: string): string {
  return `/imgs/${file}`;
}
