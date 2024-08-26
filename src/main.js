import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { createVuetify } from "vuetify";
import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import "@/styles/main.scss";

const vuetify = createVuetify();
const pinia = createPinia();

createApp(App).use(pinia).use(vuetify).mount("#app");
