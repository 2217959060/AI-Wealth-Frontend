import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: true } // 👈 标记这个页面需要登录才能进
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    }
  ]
})

// 全局路由守卫 (前端的保安)
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('jwt_token');
  
  if (to.meta.requiresAuth && !token) {
    next('/login'); // 想去需要登录的页面，但没 token，踹回登录页
  } else if (to.path === '/login' && token) {
    next('/'); // 已经登录了还去登录页，直接送去首页
  } else {
    next(); // 正常放行
  }
})

export default router