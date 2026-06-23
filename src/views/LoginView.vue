<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchWithAuth } from '../api'

// Vue Router 用于页面跳转
const router = useRouter()

// 响应式状态变量 (替代原生 JS 的全局变量)
const isLoginMode = ref(true)
const username = ref('')
const password = ref('')
const errorMessage = ref('')

// 切换登录/注册模式
const toggleAuthMode = () => {
    isLoginMode.value = !isLoginMode.value
    errorMessage.value = ''
    username.value = ''
    password.value = ''
}

// 核心提交逻辑
const handleAuth = async () => {
    if (!username.value || !password.value) {
        errorMessage.value = "请填写账号和密码"
        return
    }

    const endpoint = isLoginMode.value ? '/user/login' : '/user/register'
    try {
        const res = await fetchWithAuth(endpoint, { 
            method: 'POST', 
            body: JSON.stringify({ username: username.value, password: password.value }) 
        })
        
        if (res.code === 200) {
            if (isLoginMode.value) {
                localStorage.setItem('jwt_token', res.data.token)
                router.push('/') // 登录成功，跳转到首页看板
            } else {
                alert("注册成功！请直接登录。")
                toggleAuthMode()
            }
        } else {
            errorMessage.value = res.detail || res.msg
        }
    } catch (err) {
        errorMessage.value = "网络连接失败，请检查后端状态。"
    }
}
</script>

<template>
    <div class="fixed inset-0 login-bg flex items-center justify-center z-50">
        <div class="glass-panel p-12 rounded-[2rem] shadow-apple border border-slate-100 w-[420px] text-center fade-up">
            <div class="text-5xl mb-6">✦</div>
            <h2 class="text-3xl font-bold mb-8 text-slate-900 tracking-tight">
                {{ isLoginMode ? 'AI Wealth' : 'Create Account' }}
            </h2>
            
            <div class="space-y-4 mb-8">
                <input v-model="username" @keyup.enter="handleAuth" type="text" placeholder="Username" class="w-full px-5 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-slate-200 transition-all font-medium text-sm">
                <input v-model="password" @keyup.enter="handleAuth" type="password" placeholder="Password" class="w-full px-5 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-slate-200 transition-all font-medium text-sm">
            </div>
            
            <button @click="handleAuth" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3.5 rounded-xl transition-all text-sm">
                {{ isLoginMode ? '登 录' : '注 册' }}
            </button>
            
            <p v-if="errorMessage" class="text-red-500 text-xs mt-4">{{ errorMessage }}</p>
            
            <p class="mt-6 text-slate-400 text-xs font-medium">
                <span>{{ isLoginMode ? 'New to AI Wealth?' : 'Already have an account?' }}</span> 
                <button @click="toggleAuthMode" class="text-slate-900 hover:underline ml-1">
                    {{ isLoginMode ? 'Create account' : 'Log in' }}
                </button>
            </p>
        </div>
    </div>
</template>

<style scoped>
/* 这个组件专属的背景动画，scoped 保证它不会污染全局 */
.login-bg { 
    background: linear-gradient(-45deg, #f3f4f6, #e5e7eb, #d1d5db, #f3f4f6); 
    background-size: 400% 400%; 
    animation: gradientBG 15s ease infinite; 
}
@keyframes gradientBG { 
    0% { background-position: 0% 50%; } 
    50% { background-position: 100% 50%; } 
    100% { background-position: 0% 50%; } 
}
.glass-panel { 
    background: rgba(255, 255, 255, 0.85); 
    backdrop-filter: blur(20px); 
    -webkit-backdrop-filter: blur(20px); 
}
</style>