import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "#040816",
        panel: "rgba(255,255,255,0.06)",
        line: "rgba(255,255,255,0.10)"
      },
      boxShadow: {
        glass: "0 20px 60px rgba(0,0,0,0.35)"
      },
      backgroundImage: {
        "observex-grid":
          "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
