/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: "#2563eb",
                "background-light": "#f8fafc",
                "background-dark": "#0f172a",
                "card-dark": "#1e293b",
                "input-dark": "#1e293b",
            },
            fontFamily: {
                display: ["Inter", "sans-serif"],
            },
            borderRadius: {
                DEFAULT: "0.75rem",
            },
        }
    },
    plugins: [],
}
