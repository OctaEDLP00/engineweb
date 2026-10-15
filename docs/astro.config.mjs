// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

// https://astro.build/config
export default defineConfig({
  // Project site: https://octaedlp00.github.io/engineweb/
  site: 'https://octaedlp00.github.io/engineweb',
  base: '/engineweb',
  integrations: [
    starlight({
      title: 'EngineWeb',
      description:
        'Ultra-high-performance algorithms, data structures, and utilities for modern browser-based video games.',
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'English',
          lang: 'en',
        },
        es: {
          label: 'Español',
          lang: 'es',
        },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/OctaEDLP00/engineweb' },
      ],
      sidebar: [
        {
          label: 'Guide',
          translations: { es: 'Guía' },
          items: [
            {
              label: 'Getting Started',
              translations: { es: 'Primeros pasos' },
              slug: 'guides/getting-started',
            },
          ],
        },
        {
          label: 'Packages',
          translations: { es: 'Paquetes' },
          items: [{ autogenerate: { directory: 'packages' } }],
        },
      ],
    }),
  ],
})
