import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          deep: '#172F35',      // Deep Teal (primary dominant)
          fabric: '#28616C',    // Fabric Teal (accent, active states)
          charcoal: '#252629',  // Charcoal (headings, dark elements)
          ivory: '#F7F7F4',     // Ivory White (backgrounds, surfaces)
          surface: '#FFFFFF',   // Pure Card White
          muted: '#E8E8E2',     // Neutral border
          accent: '#397885',    // Lighter fabric teal
          light: '#F0F5F6',     // Soft teal tint
          dark: '#0E1E22',      // Deepest teal shadow
          50: '#F0F5F6',
          100: '#DDE9EC',
          200: '#BDD5DB',
          500: '#28616C',
          600: '#1F4F58',
          700: '#172F35',
          800: '#12252A',
          900: '#0E1E22',
        },
        khata: {
          green: '#1E7E55',     // Got / Received / Credit
          red: '#C53030',       // Gave / Payable / Debit
          amber: '#D97706',     // Partial / Pending
          blue: '#2B6CB0',      // Info / Lot
          slate: '#252629',     // Charcoal
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(23, 47, 53, 0.05), 0 1px 2px -1px rgba(23, 47, 53, 0.05)',
        card: '0 4px 6px -1px rgba(23, 47, 53, 0.07), 0 2px 4px -2px rgba(23, 47, 53, 0.07)',
        elevated: '0 10px 15px -3px rgba(23, 47, 53, 0.1), 0 4px 6px -4px rgba(23, 47, 53, 0.05)',
      },
    },
  },
  plugins: [],
};

export default config;
