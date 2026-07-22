/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#09090f",
        panel: "#11111a",
        panelSoft: "#1a1b27",
        accent: "#8B5CF6"
      },
      boxShadow: {
        accent: "0 0 30px rgba(139, 92, 246, 0.42)"
      },
      borderRadius: {
        xl2: "1rem"
      },
      backdropBlur: {
        xs: "2px"
      },
      keyframes: {
        ticker: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(-100%)" }
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        ticker: "ticker 18s linear infinite",
        fadeInUp: "fadeInUp 0.5s ease-out"
      }
    }
  },
  plugins: []
};
