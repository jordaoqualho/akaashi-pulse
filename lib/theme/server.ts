import { DEFAULT_THEME, THEME_COOKIE, type Theme } from './shared';

export { THEME_COOKIE, DEFAULT_THEME, type Theme };

export async function getServerTheme(): Promise<Theme> {
  // AKAASHI OS and Pulse share a fixed light work surface.
  return DEFAULT_THEME;
}
