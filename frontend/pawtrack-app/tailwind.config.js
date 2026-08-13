/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],

  // ───────────────────────────────────────────────────────────────────────────
  // SAFELIST
  //
  // Tailwind solo genera las clases que encuentra escritas literalmente en el
  // codigo. Las que se arman dentro de [ngClass] a veces no las alcanza el
  // escaner: en desarrollo aparecen tarde (por eso "vuelves al boton y ya se
  // ve bien"), y en el build de produccion simplemente no existen.
  //
  // Aqui van las clases que se aplican de forma condicional en los chips de
  // filtro, los badges de estado y las tarjetas de caso.
  // ───────────────────────────────────────────────────────────────────────────
  safelist: [
    // Texto y sombras de los chips activos
    'text-white',
    'shadow-md',
    'shadow-lg',

    // Fondos solidos — chips de filtro y badges de estado
    'bg-emerald-600', 'bg-emerald-500',
    'bg-red-600', 'bg-red-500',
    'bg-blue-700', 'bg-blue-600',
    'bg-slate-600',
    'bg-amber-500',
    'bg-orange-500',

    // Fondos suaves
    'bg-emerald-50', 'bg-red-50', 'bg-blue-50',
    'bg-amber-50', 'bg-slate-50', 'bg-slate-100',

    // Colores de texto
    'text-emerald-600', 'text-emerald-700',
    'text-red-600', 'text-red-700',
    'text-blue-600', 'text-blue-700',
    'text-amber-700',
    'text-slate-400', 'text-slate-500', 'text-slate-600',

    // Bordes
    'border-emerald-200', 'border-emerald-300', 'border-emerald-600',
    'border-red-200', 'border-red-300',
    'border-blue-100', 'border-blue-200', 'border-blue-700',
    'border-amber-200',
    'border-slate-200', 'border-slate-300',

    // Utilidades aplicadas condicionalmente
    'grayscale',
    'rotate-180',
  ],

  darkMode: 'class',

  theme: {
    extend: {
      colors: {
        "surface-container-lowest": "#ffffff",
        "primary": "#0058be",
        "surface-container-highest": "#d3e4fe",
        "inverse-primary": "#adc6ff",
        "background": "#f8f9ff",
        "on-background": "#0b1c30",
        "surface-container": "#e5eeff",
        "on-primary": "#ffffff",
        "secondary-container": "#6cf8bb",
        "on-error-container": "#93000a",
        "surface-container-low": "#eff4ff",
        "outline-variant": "#c2c6d6",
        "on-secondary-container": "#00714d",
        "inverse-surface": "#213145",
        "on-surface-variant": "#424754",
        "inverse-on-surface": "#eaf1ff",
        "error": "#ba1a1a",
        "on-surface": "#0b1c30",
        "surface-variant": "#d3e4fe",
        "surface-container-high": "#dce9ff",
      },
      fontFamily: {
        "label-md": ["Montserrat"],
        "body-sm": ["Montserrat"],
        "headline-md": ["Montserrat"],
        "headline-lg-mobile": ["Montserrat"],
        "button-text": ["Montserrat"],
        "title-lg": ["Montserrat"],
      },
      fontSize: {
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "600" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "headline-lg-mobile": ["28px", { lineHeight: "36px", fontWeight: "700" }],
        "button-text": ["16px", { lineHeight: "20px", fontWeight: "600" }],
        "title-lg": ["20px", { lineHeight: "28px", fontWeight: "600" }],
      },
      spacing: {
        "margin-mobile": "16px",
        "margin-desktop": "48px",
        "md": "16px",
        "lg": "24px",
        "xl": "32px",
        "sm": "8px",
        "gutter": "16px",
      },
    },
  },

  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}