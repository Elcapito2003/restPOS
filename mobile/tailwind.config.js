/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Marca restPOS
        brand: {
          50: '#EFF6FF',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        // Backgrounds del tema oscuro
        bg: {
          base: '#0B1220',     // fondo principal
          card: '#111827',     // cards
          elevated: '#1F2937', // hover/modal
          border: '#1E293B',   // bordes sutiles
        },
        // Texto
        ink: {
          primary: '#F8FAFC',
          secondary: '#CBD5E1',
          muted: '#64748B',
          subtle: '#475569',
        },
        // Estados de mesas
        table: {
          free: '#22C55E',
          occupied: '#EF4444',
          reserved: '#F59E0B',
          blocked: '#64748B',
        },
        // Semánticos
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter_400Regular', 'System'],
        medium: ['Inter_500Medium', 'System'],
        semibold: ['Inter_600SemiBold', 'System'],
        bold: ['Inter_700Bold', 'System'],
      },
    },
  },
  plugins: [],
};
