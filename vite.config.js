import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    base: '/vpf-pwa-web/',
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                about: resolve(__dirname, 'about.html'),
                schedule: resolve(__dirname, 'schedule.html'),
                partners: resolve(__dirname, 'partners.html'),
                program: resolve(__dirname, 'program.html'),
                map: resolve(__dirname, 'map.html'),
                location: resolve(__dirname, 'location.html'),
                contacts: resolve(__dirname, 'contacts.html'),
                help: resolve(__dirname, 'help.html'),
            }
        }
    }
})
