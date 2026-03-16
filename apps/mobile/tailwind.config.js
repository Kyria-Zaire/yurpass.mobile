/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        yurpass: {
          bg: '#0A0A0A',
          surface: '#111111',
          'surface-elevated': '#1A1A1A',
          accent: '#8B5CF6',
          gold: '#C9A84C',
          text: '#F5F5F5',
          'text-muted': '#6B6B6B',
          border: '#2A2A2A',
          error: '#EF4444',
          success: '#10B981',
        },
      },
      fontFamily: {
        heading: ['PlayfairDisplay'],
        body: ['Inter'],
        accent: ['CormorantGaramond'],
      },
    },
  },
  plugins: [],
}
