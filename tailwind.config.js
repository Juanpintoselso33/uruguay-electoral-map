/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'electoral': {
          'primary': '#333333',
          'secondary': '#555555',
          'accent': '#0366d6',
          'background': '#f5f5f5',
          'surface': '#ffffff',
          'error': '#dc3545',
          'warning': '#ffc107',
          'success': '#28a745',
        },
        'party': {
          'fa': '#0066cc',       // Frente Amplio - Blue
          'pn': '#ffffff',       // Partido Nacional - White (with border)
          'pc': '#dc3545',       // Partido Colorado - Red
          'pi': '#6f42c1',       // Partido Independiente - Purple
          'ca': '#28a745',       // Cabildo Abierto - Green
        },
        'heatmap': {
          'low': '#ffffb2',
          'medium-low': '#fecc5c',
          'medium': '#fd8d3c',
          'medium-high': '#f03b20',
          'high': '#bd0026',
        }
      },
      fontFamily: {
        'sans': ['Arial', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      zIndex: {
        '1000': '1000',
        '1001': '1001',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-in-out',
        'slide-down': 'slideDown 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
    },
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [],
}
