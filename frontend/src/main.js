import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router.js'
import './styles.css'

if (__ROUTER_MODE__ === 'memory') router.push('/')
createApp(App).use(router).mount('#app')
