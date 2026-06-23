/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // 👈 加上这句救命代码！强制开启 Class 模式
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}