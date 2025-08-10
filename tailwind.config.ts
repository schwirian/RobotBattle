import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        arena: {
          bg: '#0a0f1e',
          grid: '#1b2745',
        },
      },
      boxShadow: {
        hit: '0 0 20px 4px rgba(255,180,0,0.6)',
      },
    },
  },
  plugins: [],
} satisfies Config
