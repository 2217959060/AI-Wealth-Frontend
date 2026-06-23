import './assets/main.css' // 👈 必须在最上面引入我们写的 Tailwind CSS
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia()) // 挂载状态管理
app.use(router)        // 挂载路由导航

app.mount('#app')      // 启动引擎并挂载到页面上