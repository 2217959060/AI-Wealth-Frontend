<script setup>
import { ref, nextTick, onMounted } from 'vue' // 👈 引入 onMounted
import { marked } from 'marked' 
import AiChart from './AiChart.vue'

const API_BASE = 'http://127.0.0.1:8000'
const defaultWelcome = '我已经连接了全局账本数据库。关于收支分析、预算吐槽，放马过来吧。'
const messages = ref([{
    role: 'ai',
    content: defaultWelcome,
    toolTrace: [],
    guards: [],
    memoryTrace: null,
    memoryExpanded: false,
    toolsExpanded: false,
}])
const inputVal = ref('')
const isGenerating = ref(false)
const chatBoxRef = ref(null)

const TOOL_LABELS = {
    query_bills: '查明细/日汇总',
    aggregate_stats: '汇总统计',
    get_financial_data: '查询财务数据',
}

const GUARD_LABELS = {
    chart_validation_passed: '图表数字已核对',
    empty_or_fail_gate_stripped_echarts: '已拦截空数据图表',
    empty_gate_fallback_text: '空结果已降级为纯文字',
    chart_parse_failed_stripped: '图表解析失败已移除',
}

const toolLabel = (name) => TOOL_LABELS[name] || name
const guardLabel = (g) => {
    if (GUARD_LABELS[g]) return GUARD_LABELS[g]
    if (String(g).startsWith('chart_validation_failed')) return '图表数字未通过对账（已处理）'
    return g
}
const toolStatusText = (step) => {
    if (!step?.ok) return '失败'
    if (step.empty) return '无记录'
    return '成功'
}
const hasMemoryMeta = (msg) => !!(msg.memoryTrace && (msg.memoryTrace.query_hits || msg.memoryTrace.fixed_hits || msg.memoryTrace.error))
const hasToolsMeta = (msg) => !!(msg.toolTrace?.length || msg.guards?.length)
const memorySummary = (msg) => {
    const q = (msg.memoryTrace?.query_hits || []).length
    const f = (msg.memoryTrace?.fixed_hits || []).length
    return `问题相关 ${q} · 固定侧写 ${f}`
}
const toolsSummary = (msg) => {
    const n = msg.toolTrace?.length || 0
    const passed = (msg.guards || []).some((g) => g === 'chart_validation_passed')
    if (n && passed) return `已查询账单（${n} 步）· 图表校验通过`
    if (n) return `已查询账单数据（${n} 步）`
    if ((msg.guards || []).length) return '安全校验已执行'
    return '分析依据'
}
const toggleMemory = (msg) => { msg.memoryExpanded = !msg.memoryExpanded }
const toggleTools = (msg) => { msg.toolsExpanded = !msg.toolsExpanded }

// 长效习惯侧写提炼（profile 注入，不是问答 RAG）
const isExtracting = ref(false)
const extractMemory = async () => {
    if (isExtracting.value) return
    isExtracting.value = true
    try {
        const token = localStorage.getItem('jwt_token')
        const response = await fetch(`${API_BASE}/ai/memory/extract`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        })
        const resData = await response.json()
        
        if (resData.code === 200) {
            // 用管家的口吻把提炼结果播报出来
            const insightsText = resData.data.insights.map(i => `- ${i}`).join('\n')
            messages.value.push({ 
                role: 'ai', 
                content: `🧠 **长效记忆已更新！我刚偷看了你的账本，发现了以下致命习惯：**\n\n${insightsText}\n\n以后你再乱花钱，我就拿这些怼你！`,
                toolTrace: [],
                guards: [],
                memoryTrace: null,
                memoryExpanded: false,
                toolsExpanded: false,
            })
            scrollToBottom()
        }
    } catch (e) {
        alert("记忆提炼失败，请检查后端状态。")
    } finally {
        isExtracting.value = false
    }
}

// 🌟 新增：页面加载时拉取历史记录
const loadHistory = async () => {
    try {
        const token = localStorage.getItem('jwt_token')
        if (!token) return
        
        const response = await fetch(`${API_BASE}/ai/chat/history?chat_type=finance`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        const resData = await response.json()
        
        if (resData.code === 200 && resData.data.history && resData.data.history.length > 0) {
            messages.value = [
                {
                    role: 'ai',
                    content: defaultWelcome,
                    toolTrace: [],
                    guards: [],
                    memoryTrace: null,
                    memoryExpanded: false,
                    toolsExpanded: false,
                },
                ...resData.data.history.map((m) => ({
                    ...m,
                    toolTrace: [],
                    guards: [],
                    memoryTrace: null,
                    memoryExpanded: false,
                    toolsExpanded: false,
                })),
            ]
            scrollToBottom()
        }
    } catch (e) {
        console.error("加载历史记录失败", e)
    }
}

// 挂载时执行
onMounted(() => {
    loadHistory()
})

// 快捷提示词配置
const promptPills = [
    "📊 分析本月收支",
    "🤔 狠狠吐槽我的消费习惯",
    "💰 帮我制定下月的存钱计划"
]

// 点击提示词自动发送
const sendPrompt = (text) => {
    inputVal.value = text
    sendMessage()
}

// 🌟 升级版：真正的清空当前会话记忆（前端清屏 + 后端删库）
const clearChat = async () => {
    if(confirm("确定要开启新对话，并清除管家刚才的短期记忆吗？")) {
        // 1. 先把前端界面清空
        messages.value = [{
            role: 'ai',
            content: defaultWelcome,
            toolTrace: [],
            guards: [],
            memoryTrace: null,
            memoryExpanded: false,
            toolsExpanded: false,
        }]
        
        // 2. 通知后端把 Redis 里的数据删掉
        try {
            const token = localStorage.getItem('jwt_token')
            if (!token) return
            
            await fetch(`${API_BASE}/ai/chat/history?chat_type=finance`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
        } catch (e) {
            console.error("清空后端记忆失败", e)
        }
    }
}

const scrollToBottom = async () => {
    await nextTick()
    if (chatBoxRef.value) chatBoxRef.value.scrollTop = chatBoxRef.value.scrollHeight
}

// 终极解析引擎：带有 JSON 容错与自愈能力
const parseMessage = (content, isGeneratingAI) => {
    const blocks = []
    const parts = content.split('```echarts')
    
    if (parts[0]) blocks.push({ type: 'text', content: parts[0] })

    for (let i = 1; i < parts.length; i++) {
        const part = parts[i]
        const endIdx = part.indexOf('```')
        
        let jsonStr = ''
        let tailText = ''

        if (endIdx !== -1) {
            jsonStr = part.slice(0, endIdx).trim()
            tailText = part.slice(endIdx + 3)
        } else if (!isGeneratingAI) {
            jsonStr = part.trim()
        } else {
            blocks.push({ type: 'generating-chart' })
            continue
        }

        if (jsonStr) {
            try {
                const sanitizedJson = jsonStr.replace(/,\s*([\]}])/g, '$1')
                const jsonObj = JSON.parse(sanitizedJson)
                
                if (!jsonObj.series || !Array.isArray(jsonObj.series)) {
                    throw new Error("缺少 series 数据")
                }
                blocks.push({ type: 'chart', options: jsonObj })
            } catch(e) {
                blocks.push({ type: 'text', content: '```json\n' + jsonStr + '\n```\n*(注：图表数据解析异常)*' }) 
            }
        }
        
        if (tailText) blocks.push({ type: 'text', content: tailText })
    }
    return blocks
}

const sendMessage = async () => {
    const text = inputVal.value.trim()
    if (!text || isGenerating.value) return

    messages.value.push({ role: 'user', content: text })
    inputVal.value = ''
    isGenerating.value = true
    scrollToBottom()

    messages.value.push({
        role: 'ai',
        content: '',
        toolTrace: [],
        guards: [],
        memoryTrace: null,
        memoryExpanded: false,
        toolsExpanded: false,
    })
    const aiMsgIndex = messages.value.length - 1

    try {
        const token = localStorage.getItem('jwt_token')
        const response = await fetch(`${API_BASE}/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text: text, tone: "毒舌" })
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
                        if (dataObj.memory_trace) {
                            messages.value[aiMsgIndex].memoryTrace = dataObj.memory_trace
                            messages.value[aiMsgIndex].memoryExpanded = false
                        }
                        if (dataObj.tool_trace) {
                            messages.value[aiMsgIndex].toolTrace = dataObj.tool_trace
                            messages.value[aiMsgIndex].toolsExpanded = false
                        }
                        if (dataObj.guards) {
                            messages.value[aiMsgIndex].guards = dataObj.guards
                            messages.value[aiMsgIndex].toolsExpanded = false
                        }
                        if (dataObj.text) {
                            messages.value[aiMsgIndex].content += dataObj.text
                        }
                        scrollToBottom()
                    } catch (e) {}
                }
            }
        }
    } catch (err) {
        messages.value[aiMsgIndex].content = "❌ 网络错误，流式接收失败。"
    } finally {
        isGenerating.value = false
    }
}
</script>

<template>
    <div class="flex flex-col h-full relative">
        <header class="h-16 flex items-center px-8 glass-nav z-20 absolute top-0 w-full">
            <div class="flex items-center gap-3">
                <span class="bg-slate-200 text-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">🤖</span>
                <h1 class="text-sm font-bold text-slate-800">Finance Copilot</h1>
            </div>
            
            <div class="ml-auto flex items-center gap-3">
                <button @click="extractMemory" :disabled="isExtracting" class="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 border border-indigo-200 bg-indigo-50 px-3 py-1.5 rounded-full shadow-sm transition-all hover:shadow-md disabled:opacity-50">
                    <span v-if="!isExtracting">🧠 同步习惯</span>
                    <span v-else class="flex items-center gap-1">
                        <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        提炼中...
                    </span>
                </button>

                <button @click="clearChat" class="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 border border-slate-200 bg-white/50 px-3 py-1.5 rounded-full shadow-sm transition-all hover:shadow-md">
                    <span>+</span> New Chat
                </button>
            </div>
        </header>
        
        <div ref="chatBoxRef" class="flex-1 overflow-y-auto px-8 pt-24 pb-32 space-y-6">
            <div v-for="(msg, index) in messages" :key="index" class="flex gap-4 fade-up max-w-3xl mx-auto w-full" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
                <div v-if="msg.role !== 'user'" class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm shrink-0 mt-1">🤖</div>
                
                <div :class="msg.role === 'user' ? 'bg-slate-900 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'" class="px-5 py-3.5 rounded-2xl shadow-sm text-[15px] max-w-[85%] leading-relaxed">
                    <div v-if="msg.role === 'user'" class="whitespace-pre-wrap">{{ msg.content }}</div>
                    <div v-else class="w-full space-y-3">
                        <div
                            v-if="hasMemoryMeta(msg) || hasToolsMeta(msg)"
                            class="space-y-1.5"
                        >
                            <!-- 习惯侧写：默认折叠 -->
                            <div
                                v-if="hasMemoryMeta(msg)"
                                class="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
                            >
                                <button
                                    type="button"
                                    class="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-slate-100/80 transition-colors"
                                    :aria-expanded="!!msg.memoryExpanded"
                                    @click="toggleMemory(msg)"
                                >
                                    <span class="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                                        🧠 已召回习惯侧写（{{ memorySummary(msg) }}）
                                    </span>
                                    <span
                                        class="text-slate-500 text-[10px] leading-none select-none transition-transform duration-200"
                                        :class="msg.memoryExpanded ? 'rotate-180' : ''"
                                        aria-hidden="true"
                                    >▾</span>
                                    <span class="text-[10px] text-slate-400 font-medium truncate">
                                        {{ msg.memoryExpanded ? '点击收起' : '点击查看' }}
                                    </span>
                                </button>
                                <div
                                    v-show="msg.memoryExpanded"
                                    class="px-3 pb-2.5 space-y-1.5 border-t border-slate-200 text-[11px] text-slate-600"
                                >
                                    <div v-if="(msg.memoryTrace.query_hits || []).length">
                                        <div class="font-semibold text-slate-700 mb-1">问题相关</div>
                                        <div
                                            v-for="(h, hi) in msg.memoryTrace.query_hits"
                                            :key="'q'+hi"
                                            class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 mb-1"
                                        >{{ h }}</div>
                                    </div>
                                    <div v-if="(msg.memoryTrace.fixed_hits || []).length">
                                        <div class="font-semibold text-slate-700 mb-1">固定侧写</div>
                                        <div
                                            v-for="(h, hi) in msg.memoryTrace.fixed_hits"
                                            :key="'f'+hi"
                                            class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 mb-1"
                                        >{{ h }}</div>
                                    </div>
                                    <div v-if="msg.memoryTrace.error" class="text-rose-600">
                                        {{ msg.memoryTrace.error }}
                                    </div>
                                </div>
                            </div>

                            <!-- 工具 + 闸门：默认折叠，中文摘要 -->
                            <div
                                v-if="hasToolsMeta(msg)"
                                class="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
                            >
                                <button
                                    type="button"
                                    class="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-slate-100/80 transition-colors"
                                    :aria-expanded="!!msg.toolsExpanded"
                                    @click="toggleTools(msg)"
                                >
                                    <span class="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                                        🧭 {{ toolsSummary(msg) }}
                                    </span>
                                    <span
                                        class="text-slate-500 text-[10px] leading-none select-none transition-transform duration-200"
                                        :class="msg.toolsExpanded ? 'rotate-180' : ''"
                                        aria-hidden="true"
                                    >▾</span>
                                    <span class="text-[10px] text-slate-400 font-medium truncate">
                                        {{ msg.toolsExpanded ? '点击收起' : '点击查看详情' }}
                                    </span>
                                </button>
                                <div
                                    v-show="msg.toolsExpanded"
                                    class="px-3 pb-2.5 space-y-2 border-t border-slate-200"
                                >
                                    <div
                                        v-for="(step, sIdx) in (msg.toolTrace || [])"
                                        :key="sIdx"
                                        class="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                                    >
                                        <div class="font-semibold text-slate-700">
                                            第 {{ step.round }} 步 · {{ toolLabel(step.tool) }}
                                            <span
                                                class="ml-1"
                                                :class="step.ok ? 'text-emerald-600' : 'text-rose-600'"
                                            >· {{ toolStatusText(step) }}</span>
                                        </div>
                                        <div class="text-[10px] text-slate-400 font-mono mt-0.5">
                                            tool: {{ step.tool }}
                                        </div>
                                    </div>
                                    <div
                                        v-if="msg.guards && msg.guards.length"
                                        class="flex flex-wrap gap-1.5"
                                    >
                                        <span
                                            v-for="(g, gIdx) in msg.guards"
                                            :key="gIdx"
                                            class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100"
                                            :title="g"
                                        >
                                            🛡️ {{ guardLabel(g) }}
                                        </span>
                                    </div>
                                    <div
                                        v-if="msg.guards && msg.guards.length"
                                        class="text-[10px] text-slate-400 font-mono"
                                    >
                                        raw: {{ msg.guards.join(', ') }}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <template v-for="(block, bIdx) in parseMessage(msg.content, isGenerating && index === messages.length - 1)" :key="bIdx">
                            <div v-if="block.type === 'text'" class="markdown-body inline-block w-full">
                                <span v-html="marked.parse(block.content)"></span>
                            </div>
                            <AiChart v-else-if="block.type === 'chart'" :options="block.options" class="fade-up" />

                            <div v-else-if="block.type === 'generating-chart'" class="w-full h-64 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center my-4 fade-up">
                                <div class="flex flex-col items-center gap-3 text-indigo-400">
                                    <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <span class="text-xs font-bold tracking-widest animate-pulse">正在生成动态数据报表...</span>
                                </div>
                            </div>
                        </template>
                        
                        <span v-if="isGenerating && index === messages.length - 1 && msg.role === 'ai'" class="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-1 align-middle"></span>
                    </div>
                </div>
            </div>

            <div v-if="messages.length === 1" class="mt-8 flex flex-wrap gap-3 justify-center max-w-2xl mx-auto fade-up" style="animation-delay: 0.2s">
                <button v-for="pill in promptPills" :key="pill" @click="sendPrompt(pill)" class="bg-white/80 border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm px-5 py-2.5 rounded-full text-sm font-medium transition-all transform hover:-translate-y-0.5">
                    {{ pill }}
                </button>
            </div>
        </div>

        <div class="absolute bottom-0 left-0 right-0 p-6 glass-bottom z-20">
            <div class="max-w-3xl mx-auto bg-white rounded-[2rem] shadow-apple border border-slate-200 p-2 pl-6 flex items-center focus-within:border-slate-300 focus-within:ring-4 focus-within:ring-slate-100 transition-all">
                <input v-model="inputVal" @keyup.enter="sendMessage" type="text" class="flex-1 bg-transparent border-none outline-none text-base placeholder-slate-400" placeholder="Ask Copilot...">
                <button @click="sendMessage" :disabled="isGenerating" class="bg-slate-900 hover:bg-black text-white rounded-full w-10 h-10 flex items-center justify-center transition-transform hover:scale-105 shrink-0 ml-2 shadow-sm disabled:opacity-50">↑</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 🌟 给 Markdown 渲染后的 HTML 元素添加基础样式（Tailwind 默认会抹除这些样式） */
:deep(.markdown-body p) { margin-bottom: 0.5rem; display: inline-block; }
:deep(.markdown-body p:last-child) { margin-bottom: 0; }
:deep(.markdown-body strong) { font-weight: 700; color: #2a1f0f; }
:deep(.markdown-body ul) { list-style-type: disc; margin-left: 1.5rem; margin-bottom: 0.5rem; }
:deep(.markdown-body ol) { list-style-type: decimal; margin-left: 1.5rem; margin-bottom: 0.5rem; }
:deep(.markdown-body li) { margin-bottom: 0.25rem; }
:deep(.markdown-body code) { background-color: #f1f5f9; padding: 0.15rem 0.3rem; border-radius: 0.25rem; font-family: monospace; font-size: 0.9em; color: #db2777; }
/* 强制 Markdown 里的代码块和长文本自动换行，防止撑爆容器 */
:deep(.markdown-body pre) {
    white-space: pre-wrap !important;
    word-break: break-all !important;
    overflow-x: auto;
    max-width: 100%;
}
:deep(.markdown-body code) {
    white-space: pre-wrap !important;
    word-break: break-all !important;
}
</style>