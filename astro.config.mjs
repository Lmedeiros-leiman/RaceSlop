import { defineConfig } from 'astro/config';

// GitHub Pages project site: replace `username` with your GitHub user/org.
// The official withastro/action overrides site/base at deploy time if needed,
// these defaults keep `npm run build` working locally and on Pages.
export default defineConfig({
  site: 'https://username.github.io',
  base: '/RaceSlop/',
  output: 'static',
});
