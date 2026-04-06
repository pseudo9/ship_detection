/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary colors
        primary: {
          DEFAULT: '#00d4ff',
          50: '#e6f9ff',
          100: '#ccf3ff',
          200: '#99e7ff',
          300: '#66dbff',
          400: '#33cfff',
          500: '#00d4ff',
          600: '#00a3cc',
          700: '#007a99',
          800: '#005266',
          900: '#002933',
        },
        secondary: {
          DEFAULT: '#00ff88',
          50: '#e6fff5',
          100: '#ccffeb',
          200: '#99ffd6',
          300: '#66ffc2',
          400: '#33ffad',
          500: '#00ff88',
          600: '#00cc6d',
          700: '#009952',
          800: '#006636',
          900: '#00331b',
        },
        // Dark theme colors
        dark: {
          50: '#2a4a6f',
          100: '#1a2642',
          200: '#0d1b2a',
          300: '#0a1628',
          400: '#080f1a',
          500: '#06090e',
        },
        // Status colors
        success: '#00ff88',
        warning: '#ffc107',
        error: '#ff6b6b',
        info: '#00d4ff',
        // Additional UI colors
        radar: {
          coverage: 'rgba(0, 212, 255, 0.3)',
          active: '#00ff88',
          inactive: '#666666',
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.85rem',
        'base': '0.95rem',
        'lg': '1rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        '4xl': '2.5rem',
        '5xl': '3rem',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(0, 212, 255, 0.5)',
        'glow-sm': '0 0 10px rgba(0, 212, 255, 0.3)',
        'glow-lg': '0 0 30px rgba(0, 212, 255, 0.7)',
        'secondary-glow': '0 0 20px rgba(0, 255, 136, 0.5)',
        'card': '0 4px 12px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-slow': 'bounce 2s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'radar-sweep': 'radarSweep 4s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'dark-gradient': 'linear-gradient(135deg, #0a1628 0%, #1a2642 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(13, 27, 42, 0.8) 0%, rgba(26, 38, 66, 0.6) 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
      gridTemplateColumns: {
        'dashboard': '300px 1fr 320px',
        'auto-fill': 'repeat(auto-fill, minmax(250px, 1fr))',
        'auto-fit': 'repeat(auto-fit, minmax(250px, 1fr))',
      },
      gridTemplateRows: {
        'dashboard': 'auto 1fr auto',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      },
      scale: {
        '102': '1.02',
        '103': '1.03',
      },
    },
  },
  plugins: [
    // Custom plugin for utilities
    function({ addUtilities }) {
      const newUtilities = {
        '.scrollbar-hide': {
          /* IE and Edge */
          '-ms-overflow-style': 'none',
          /* Firefox */
          'scrollbar-width': 'none',
          /* Safari and Chrome */
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        },
        '.scrollbar-default': {
          /* IE and Edge */
          '-ms-overflow-style': 'auto',
          /* Firefox */
          'scrollbar-width': 'auto',
          /* Safari and Chrome */
          '&::-webkit-scrollbar': {
            display: 'block'
          }
        },
        '.text-glow': {
          'text-shadow': '0 0 10px rgba(0, 212, 255, 0.8)',
        },
        '.text-glow-secondary': {
          'text-shadow': '0 0 10px rgba(0, 255, 136, 0.8)',
        },
        '.glass': {
          'background': 'rgba(13, 27, 42, 0.8)',
          'backdrop-filter': 'blur(10px)',
          'border': '1px solid rgba(42, 74, 111, 0.5)',
        },
        '.glass-light': {
          'background': 'rgba(26, 38, 66, 0.6)',
          'backdrop-filter': 'blur(8px)',
          'border': '1px solid rgba(42, 74, 111, 0.3)',
        },
      }
      addUtilities(newUtilities)
    }
  ],
}