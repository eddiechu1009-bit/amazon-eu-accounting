/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        amazon: {
          orange: '#FF9900',
          'orange-hover': '#E88B00',
          dark: '#232F3E',
          light: '#37475A',
          blue: '#146EB4',
          'blue-light': '#1A8FE3',
          success: '#067D62',
          warning: '#C7511F',
          danger: '#CC0C39',
        },
      },
    },
  },
  plugins: [],
}
