import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import AppModern from './AppModern.vue'
// import App from './App.vue' // Old version

const app = createApp(AppModern)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
