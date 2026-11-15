import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "favicon-32.png",
        "pwa-64x64.png",
        "apple-touch-icon.png",
        "logo.png",
        "simbolo.png",
        "lettering.png",
      ],
      devOptions: {
        enabled: true,
        type: "module",
      },
      manifest: {
        id: "/",
        name: "D'a Márcia Marmitaria — Gestão do Dia",
        short_name: "D'a Márcia",
        description: "Caixa, vendas, cozinha e entregas da marmitaria na palma da mão.",
        lang: "pt-BR",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "any",
        background_color: "#fdf8f3",
        theme_color: "#521011",
        categories: ["business", "food", "productivity", "finance"],
        shortcuts: [
          {
            name: "Pedidos do Dia",
            short_name: "Dia",
            url: "/dia",
            description: "Colar a mensagem do grupo e lançar pedidos",
            icons: [{ src: "/marca-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Tela da Cozinha",
            short_name: "Cozinha",
            url: "/cozinha",
            description: "Fila de montagem em letras grandes",
            icons: [{ src: "/marca-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Entregas do Dia",
            short_name: "Entregas",
            url: "/entregas",
            description: "Marcar entregas por motoboy",
            icons: [{ src: "/marca-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Caixa",
            short_name: "Caixa",
            url: "/caixa",
            description: "Entradas e saídas do caixa",
            icons: [{ src: "/marca-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Painel da TV",
            short_name: "TV",
            url: "/tv",
            description: "Painel em tempo real da cozinha",
            icons: [{ src: "/marca-192.png", sizes: "192x192", type: "image/png" }],
          },
        ],
        icons: [
          { src: "/pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "/marca-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/marca-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/marca-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/marca-1024.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    target: "es2022",
    cssTarget: "safari16",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("react-router")) return "router";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("motion")) return "motion";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("@radix-ui")) return "radix";
          return undefined;
        },
      },
    },
  },
});
