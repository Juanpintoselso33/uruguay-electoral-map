import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import AppModern from './AppModern.vue'
// Legacy Leaflet version (not in use - see AppLegacy.vue for details)
// import AppLegacy from './AppLegacy.vue'

const app = createApp(AppModern)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
