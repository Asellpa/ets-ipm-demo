import { defineConfig } from 'vite';
const proxy={'/api':{target:'http://127.0.0.1:5174',changeOrigin:false}};
export default defineConfig({server:{proxy},preview:{proxy}});
