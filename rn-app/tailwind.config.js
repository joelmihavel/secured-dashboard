/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Black Scale (Dark Theme Primary)
        black: {
          700: '#131313',
          600: '#1A1A1A',
          500: '#202020',
          400: '#4D4D4D',
          300: '#797979',
          200: '#A6A6A6',
        },
        // Neutral Scale
        neutral: {
          100: '#EEEEEE',
          200: '#DDDDDD',
          300: '#CBCBCB',
          500: '#A9A9A9',
          600: '#878787',
          800: '#444444',
          900: '#222222',
        },
        // Brand Colors (Orange Accent)
        brand: {
          400: '#FFAE8A',
          500: '#FF9A6D',
          600: '#CC7B57',
        },
        // Semantic Colors
        success: {
          DEFAULT: '#70BF73',
          approved: '#06C270',
        },
        error: '#FF8080',
        warning: '#FFD580',
      },
      fontFamily: {
        'jakarta': ['PlusJakartaSans-Regular'],
        'jakarta-medium': ['PlusJakartaSans-Medium'],
        'jakarta-semibold': ['PlusJakartaSans-SemiBold'],
        'jakarta-bold': ['PlusJakartaSans-Bold'],
        'inter': ['Inter-Regular'],
        'inter-medium': ['Inter-Medium'],
        'inter-semibold': ['Inter-SemiBold'],
      },
      fontSize: {
        'h1': ['48px', { lineHeight: '64px', letterSpacing: '-2px' }],
        'h2': ['40px', { lineHeight: '52px', letterSpacing: '-1.5px' }],
        'h3': ['32px', { lineHeight: '44px', letterSpacing: '-1px' }],
        'h4': ['28px', { lineHeight: '40px', letterSpacing: '-1px' }],
        'h5': ['24px', { lineHeight: '32px', letterSpacing: '-0.5px' }],
        'h6': ['20px', { lineHeight: '28px' }],
        'body-lg': ['20px', { lineHeight: '32px' }],
        'body-md': ['16px', { lineHeight: '24px' }],
        'body-md2': ['14px', { lineHeight: '20px' }],
        'body-sm': ['12px', { lineHeight: '20px' }],
        'otp': ['28px', { lineHeight: '36px', letterSpacing: '8px' }],
      },
      spacing: {
        'xxxs': '2px',
        'xxs': '4px',
        'xs': '8px',
        'sm': '12px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        'xxl': '40px',
        'xxxl': '48px',
        'huge': '64px',
      },
      borderRadius: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        'xxl': '40px',
        'pill': '200px',
      },
    },
  },
  plugins: [],
};
