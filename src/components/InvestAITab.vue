<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { marked } from 'marked'

const API_BASE = 'http://127.0.0.1:8000'
const defaultWelcome = '您好，我是您的智能理财顾问。我已为您全面盘点本月资产与收支流向，并深度融合了最新的市场权威财务模型与资产配置策略。\n\n本月想优先为您量身定制指数基金定投规划，还是共同评估并测算您的财务自由（FIRE）进度？'

const messages = ref([
    { role: 'ai', content: defaultWelcome }
])
const inputVal = ref('')
const isGenerating = ref(false)
const chatBoxRef = ref(null)

// 📊 HUD 实时数据面板响应式变量
const hudData = ref({
    income: 0.0,
    expense: 0.0,
    balance: 0.0,
    savingsRate: 0.0
})

// 自动化数据链路
const fetchHudData = async () => {
    try {
        const token = localStorage.getItem('jwt_token')
        const currentMonth = new Date().toISOString().slice(0, 7)
        
        const response = await fetch(`${API_BASE}/bill/filter`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        const resData = await response.json()
        if (resData.code === 200 && resData.data.list) {
            let inc = 0, exp = 0
            resData.data.list.forEach(b => {
                if (b.date.startsWith(currentMonth)) {
                    if (b.type === 'income') inc += parseFloat(b.amount)
                    else exp += parseFloat(b.amount)
                }
            })
            hudData.value.income = inc
            hudData.value.expense = exp
            hudData.value.balance = inc - exp
            hudData.value.savingsRate = inc > 0 ? ((inc - exp) / inc * 100) : 0.0
        }
    } catch (e) {
        console.error("数据大屏同步失败", e)
    }
}

onMounted(() => {
    fetchHudData()
})

const promptPills = [
    "📈 帮我制定一份指数基金定投计划",
    "🚑 帮我找出账单里的“拿铁因子”漏洞",
    "⏳ 帮我用 4% 法则推算财务自由年限"
]

const scrollToBottom = async () => {
    await nextTick()
    if (chatBoxRef.value) chatBoxRef.value.scrollTop = chatBoxRef.value.scrollHeight
}

const sendPrompt = (text) => {
    inputVal.value = text
    sendMessage()
}

const sendMessage = async () => {
    const text = inputVal.value.trim()
    if (!text || isGenerating.value) return

    messages.value.push({ role: 'user', content: text })
    inputVal.value = ''
    isGenerating.value = true
    scrollToBottom()

    messages.value.push({ role: 'ai', content: '' })
    const aiMsgIndex = messages.value.length - 1

    try {
        const token = localStorage.getItem('jwt_token')
        const response = await fetch(`${API_BASE}/ai/invest/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text: text })
        })

        if (!response.ok) throw new Error("请求失败")

        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunkStr = decoder.decode(value, { stream: true })
            const lines = chunkStr.split('\n')
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6)
                    if (dataStr === '[DONE]') break
                    try {
                        const dataObj = JSON.parse(dataStr)
                        messages.value[aiMsgIndex].content += dataObj.text
                        scrollToBottom()
                    } catch (e) {}
                }
            }
        }
        fetchHudData()
    } catch (err) {
        messages.value[aiMsgIndex].content = "❌ 财富顾问连接失败，请检查网络。"
    } finally {
        isGenerating.value = false
    }
}

const renderMarkdown = (text) => {
    let html = marked.parse(text)
    html = html.replace(/《(.*?)》/g, 
        '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100/80 shadow-sm mx-0.5 font-sans"># $1</span>'
    )
    html = html.replace(/\[(\d+)\]/g, 
        '<sup class="inline-flex items-center justify-center text-[10px] w-3.5 h-3.5 bg-slate-900 text-white rounded-full font-bold shadow-sm ml-0.5 transform -translate-y-1"><span>$1</span></sup>'
    )
    return html
}

const clearChat = () => {
    if(confirm("确定要重新开启一轮资产评估吗？")) {
        messages.value = [{ role: 'ai', content: defaultWelcome }]
    }
}
</script>

<template>
    <div class="flex flex-col h-full bg-slate-50/40 relative font-sans overflow-hidden">
        
            <header class="h-16 md:h-20 shrink-0 flex items-center px-4 md:px-10 border-b border-slate-200/60 bg-white/80 backdrop-blur-md z-20 justify-between">
                <div class="flex items-center gap-2 md:gap-3 shrink-0">
                    <span class="text-lg md:text-xl">📈</span>
                    <h1 class="text-sm md:text-base font-black tracking-tight text-slate-800 whitespace-nowrap">理财投顾</h1>
                </div>

                <div class="flex items-center gap-1.5 md:gap-4 overflow-hidden">
                    <div class="bg-slate-100/70 border border-slate-200/40 px-2.5 md:px-5 py-1 md:py-2 rounded-lg md:rounded-xl text-right min-w-[100px] md:min-w-[160px] shadow-sm">
                        <div class="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider scale-90 md:scale-100 origin-right">当月净结余</div>
                        <div class="text-xs md:text-base font-black tracking-tight mt-0.5 truncate" :class="hudData.balance >= 0 ? 'text-slate-800' : 'text-rose-500'">
                            ¥ {{ hudData.balance.toFixed(2) }}
                    </div>
                 </div>

                <div class="border px-2.5 md:px-5 py-1 md:py-2 rounded-lg md:rounded-xl shadow-sm min-w-[85px] md:min-w-[160px] text-right transition-all duration-300"
                     :class="hudData.savingsRate >= 50 ? 'border-emerald-200 bg-emerald-50/40' : (hudData.savingsRate < 30 ? 'border-rose-200 bg-rose-50/40' : 'bg-slate-100/70 border-slate-200/40')">
                    <div class="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider scale-90 md:scale-100 origin-right">当前储蓄率</div>
                    <div class="text-xs md:text-base font-black tracking-tight text-slate-800 mt-0.5 truncate">
                        {{ hudData.savingsRate.toFixed(1) }}%
                    </div>
                </div>

                <button @click="clearChat" class="p-1.5 md:p-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 rounded-lg md:rounded-xl shadow-sm transition-all shrink-0">
                    <svg class="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        </header>
        
        <div ref="chatBoxRef" class="flex-1 overflow-y-auto px-10 py-8 space-y-6 scroll-smooth">
            <div v-for="(msg, index) in messages" :key="index" class="flex gap-4 fade-up max-w-4xl mx-auto w-full" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
                
                <div v-if="msg.role !== 'user'" class="w-8 h-8 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 shadow-sm flex items-center justify-center text-sm shrink-0 mt-0.5 select-none">
                    🪙
                </div>
                
                <div :class="msg.role === 'user' ? 'bg-slate-900 text-white rounded-tr-sm' : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-sm'" 
                     class="px-5 py-3.5 rounded-2xl shadow-sm text-[14px] max-w-[80%] leading-relaxed tracking-wide">
                    <div v-if="msg.role === 'user'" class="whitespace-pre-wrap font-medium">{{ msg.content }}</div>
                    <div v-else class="w-full markdown-body">
                        <span v-html="renderMarkdown(msg.content)"></span>
                        <span v-if="isGenerating && index === messages.length - 1 && msg.role === 'ai'" class="inline-block w-1.5 h-3.5 bg-indigo-500 animate-pulse ml-1 align-middle"></span>
                    </div>
                </div>
            </div>
        </div>

        <div class="p-6 shrink-0 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent pt-10">
            <div class="max-w-4xl mx-auto flex flex-col gap-3">
                <div v-if="messages.length === 1" class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide fade-up">
                    <button v-for="pill in promptPills" :key="pill" @click="sendPrompt(pill)" 
                            class="shrink-0 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 px-5 py-3 rounded-xl text-sm font-bold shadow-sm transition-all transform hover:-translate-y-0.5 select-none">
                        {{ pill }}
                    </button>
                </div>

                <div class="bg-white rounded-2xl shadow-md border border-slate-200 p-2 pl-4 flex items-center focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-100 transition-all">
                    <input v-model="inputVal" @keyup.enter="sendMessage" type="text" 
                           class="flex-1 bg-transparent border-none outline-none text-[14px] placeholder-slate-400 font-semibold" 
                           placeholder="输入您的资产配置或理财规划疑问...">
                    <button @click="sendMessage" :disabled="isGenerating" 
                            class="bg-slate-900 hover:bg-black text-white rounded-xl px-5 py-2.5 flex items-center justify-center transition-all shrink-0 ml-2 shadow-sm disabled:opacity-50 font-bold text-xs">
                        <span v-if="!isGenerating">咨询顾问</span>
                        <svg v-else class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
:deep(.markdown-body p) { margin-bottom: 0.5rem; display: block; }
:deep(.markdown-body p:last-child) { margin-bottom: 0; }
:deep(.markdown-body strong) { font-weight: 800; color: #0f172a; }
:deep(.markdown-body ul) { list-style-type: disc; margin-left: 1.25rem; margin-bottom: 0.5rem; }
:deep(.markdown-body li) { margin-bottom: 0.25rem; }
.scrollbar-hide::-webkit-scrollbar { display: none; }
</style>