<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import DashboardTab from '../components/DashboardTab.vue' 
import FinanceAITab from '../components/FinanceAITab.vue' 
import RagAITab from '../components/RagAITab.vue'
import CategoryTab from '../components/CategoryTab.vue' 
import TrashTab from '../components/TrashTab.vue'
import ImportTab from '../components/ImportTab.vue'
import InvestAITab from '../components/InvestAITab.vue'
import { useModalStore } from '../stores/modal'
import AiAddModal from '../components/AiAddModal.vue'
import ManualAddModal from '../components/ManualAddModal.vue'

const modalStore = useModalStore()
const router = useRouter()

// 1. 响应式状态管理
const currentTab = ref('dashboard') // 默认显示财务大屏
const isMobileMenuOpen = ref(false) // 控制移动端侧边栏

// 2. 退出登录逻辑
const logout = () => {
    localStorage.removeItem('jwt_token')
    router.push('/login')
}

// 3. 菜单切换逻辑
const switchTab = (tabName) => {
    currentTab.value = tabName
    isMobileMenuOpen.value = false // 手机端点击菜单后，自动收起侧边栏
}
</script>

<template>
    <div class="h-screen flex overflow-hidden bg-[#fafafa] dark:bg-slate-950 selection:bg-blue-100 selection:text-blue-900 transition-colors duration-300">
        
        <div 
            v-if="isMobileMenuOpen" 
            @click="isMobileMenuOpen = false" 
            class="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
        ></div>

        <aside 
            class="fixed inset-y-0 left-0 z-50 w-64 bg-[#fafafa] dark:bg-slate-900 flex flex-col border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0"
            :class="isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'"
        >
            <div class="p-6 text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white tracking-tight mt-2 transition-colors duration-300">
                <span>✦</span> AI Wealth
            </div>
            
            <div class="px-4 pb-2 mt-4 space-y-3">
                <button @click="modalStore.openAiModal()" class="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-medium py-2.5 rounded-lg flex justify-center items-center gap-2 transition-all text-sm shadow-sm">
                    <span>✨</span> 魔法速记
                </button>
                <button @click="modalStore.openManualModal()" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200 font-medium py-2.5 rounded-lg flex justify-center items-center gap-2 transition-all text-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <span>📝</span> 手动录入
                </button>
            </div>

            <nav class="flex-1 px-3 space-y-1 mt-4">
                <button @click="switchTab('dashboard')" :class="currentTab === 'dashboard' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'" class="w-full text-left px-3 py-2 rounded-md transition-all font-medium flex items-center gap-3 text-sm">
                    <svg class="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg> 
                    财务大屏
                </button>
                <button @click="switchTab('import')" :class="currentTab === 'import' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'" class="w-full text-left px-3 py-2 rounded-md transition-all font-medium flex items-center gap-3 text-sm">
                    <svg class="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg> 
                    账单导入
                </button>
                <button @click="switchTab('finance-ai')" :class="currentTab === 'finance-ai' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'" class="w-full text-left px-3 py-2 rounded-md transition-all font-medium flex items-center gap-3 text-sm">
                    <svg class="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg> 
                    财富管家(AI)
                </button>
                <button @click="switchTab('rag-ai')" :class="currentTab === 'rag-ai' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'" class="w-full text-left px-3 py-2 rounded-md transition-all font-medium flex items-center gap-3 text-sm">
                    <svg class="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg> 
                    保险顾问(AI)
                </button>
                <button @click="switchTab('invest-ai')" :class="currentTab === 'invest-ai' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'" class="w-full text-left px-3 py-2 rounded-md transition-all font-medium flex items-center gap-3 text-sm">
                    <svg class="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg> 
                    理财投顾(AI)
                </button>
                <button @click="switchTab('category')" :class="currentTab === 'category' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'" class="w-full text-left px-3 py-2 rounded-md transition-all font-medium flex items-center gap-3 text-sm">
                    <svg class="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> 
                    分类设置
                </button>
                <button @click="switchTab('trash')" :class="currentTab === 'trash' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'" class="w-full text-left px-3 py-2 rounded-md transition-all font-medium flex items-center gap-3 text-sm">
                    <svg class="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> 
                    回收站
                </button>
            </nav>
            
            <div class="p-4">
                <button @click="logout" class="w-full px-3 py-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200 rounded-md transition-colors font-medium text-sm text-left flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg> 
                    Log out
                </button>
            </div>
        </aside>

        <main class="flex-1 flex flex-col h-screen relative bg-[#fafafa] dark:bg-slate-900 transition-colors duration-300">
            
            <button 
                @click="isMobileMenuOpen = true" 
                class="md:hidden fixed bottom-24 right-6 z-[45] w-14 h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full shadow-apple-hover flex items-center justify-center hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-95"
            >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>

            <KeepAlive>
                <DashboardTab v-if="currentTab === 'dashboard'" />
                <FinanceAITab v-else-if="currentTab === 'finance-ai'" />
                <RagAITab v-else-if="currentTab === 'rag-ai'" />
                <InvestAITab v-else-if="currentTab === 'invest-ai'" />
                <CategoryTab v-else-if="currentTab === 'category'" /> 
                <TrashTab v-else-if="currentTab === 'trash'" />
                <ImportTab v-else-if="currentTab === 'import'" />
            </KeepAlive>

            <AiAddModal />
            <ManualAddModal />
        </main>
    </div>
</template>