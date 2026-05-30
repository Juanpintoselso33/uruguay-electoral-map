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
          'fa': '#A569BD',       // Frente Amplio - Violeta claro
          'pn': '#55B5E5',       // Partido Nacional - Celeste (NOT white!)
          'pc': '#E52828',       // Partido Colorado - Rojo
          'pi': '#7B2CBF',       // Partido Independiente - Morado oscuro
          'ca': '#2D7D3E',       // Cabildo Abierto - Verde
          'ap': '#C0392B',       // Asamblea Popular - Rojo oscuro
          'ar': '#1ABC9C',       // Avanzar Republicano - Turquesa
          'by': '#F39C12',       // Basta Ya - Naranja dorado
          'cr': '#3498DB',       // Coalición Republicana - Azul
          'coa': '#27AE60',      // Constitucional Ambientalista - Verde claro
          'dev': '#8E44AD',      // Devolución - Púrpura
          'is': '#D35400',       // Identidad Soberana - Naranja oscuro
          'ind': '#95A5A6',      // Independiente - Gris
          'lib': '#F1C40F',      // Libertario - Amarillo
          'peri': '#E74C3C',     // P.E.R.I. - Coral
          'pa': '#9B59B6',       // Partido de la Armonía - Lila
          'pal': '#16A085',      // Patria Alternativa - Verde azulado
          'pcn': '#2980B9',      // Por Los Cambios Necesarios - Azul medio
          'pva': '#2ECC71',      // Verde Animalista - Verde brillante
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
