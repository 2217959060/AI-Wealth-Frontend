<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { marked } from 'marked'

const API_BASE = 'http://127.0.0.1:8000'
// 阶段 A：与后端真 RAG 对齐的诚实欢迎语（不再假装「已载入 PDF」营销话术）
const defaultWelcome =
  '理赔顾问已启用条款向量检索（RAG）。先检索本地条款再回答；无足够相关召回时则无法确定。'
const messages = ref([{ role: 'ai', content: defaultWelcome, sources: [], sourcesExpanded: false, guards: [] }])
const inputVal = ref('')
const isGenerating = ref(false)
const chatBoxRef = ref(null)

const toggleSources = (msg) => {
  if (!msg.sources || !msg.sources.length) return
  msg.sourcesExpanded = !msg.sourcesExpanded
}

const loadHistory = async () => {
  try {
    const token = localStorage.getItem('jwt_token')
    if (!token) return

    const response = await fetch(`${API_BASE}/ai/chat/history?chat_type=rag`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const resData = await response.json()

    if (resData.code === 200 && resData.data.history && resData.data.history.length > 0) {
      messages.value = [
        { role: 'ai', content: defaultWelcome, sources: [], sourcesExpanded: false, guards: [] },
        ...resData.data.history.map((m) => ({
          ...m,
          sources: m.sources || [],
          sourcesExpanded: false,
          guards: m.guards || [],
        })),
      ]
      scrollToBottom()
    }
  } catch (e) {
    console.error('加载历史记录失败', e)
  }
}

onMounted(() => {
  loadHistory()
})

const promptPills = [
  '📑 重疾险包含哪些高发疾病',
  '🏥 意外住院门诊费用怎么报销',
  '⏱️ 理赔申请有时效限制吗',
]

const sendPrompt = (text) => {
  inputVal.value = text
  sendMessage()
}

const clearChat = async () => {
  if (confirm('确定要开启新对话，并清除管家刚才的短期记忆吗？')) {
    messages.value = [{ role: 'ai', content: defaultWelcome, sources: [], sourcesExpanded: false, guards: [] }]

    try {
      const token = localStorage.getItem('jwt_token')
      if (!token) return

      await fetch(`${API_BASE}/ai/chat/history?chat_type=rag`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (e) {
      console.error('清空后端记忆失败', e)
    }
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (chatBoxRef.value) chatBoxRef.value.scrollTop = chatBoxRef.value.scrollHeight
}

const sendMessage = async () => {
  const text = inputVal.value.trim()
  if (!text || isGenerating.value) return

  messages.value.push({ role: 'user', content: text })
  inputVal.value = ''
  isGenerating.value = true
  scrollToBottom()

  messages.value.push({ role: 'ai', content: '', sources: [], sourcesExpanded: false, guards: [] })
  const aiMsgIndex = messages.value.length - 1

  try {
    const token = localStorage.getItem('jwt_token')
    const response = await fetch(`${API_BASE}/ai/ask_policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: text }),
    })

    if (!response.ok) {
      let detail = `请求失败 (HTTP ${response.status})`
      try {
        const errData = await response.json()
        detail = errData.msg || errData.detail || detail
      } catch (e) {}
      throw new Error(detail)
    }

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
            if (dataObj.sources) {
              messages.value[aiMsgIndex].sources = dataObj.sources
              // 默认折叠，便于先看结论
              messages.value[aiMsgIndex].sourcesExpanded = false
            }
            if (dataObj.guards) {
              messages.value[aiMsgIndex].guards = dataObj.guards
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
    const msg = err && err.message ? err.message : '网络错误，流式接收失败。'
    messages.value[aiMsgIndex].content = `❌ ${msg}`
  } finally {
    isGenerating.value = false
  }
}
</script>

<template>
  <div class="flex flex-col h-full relative">
    <header class="h-16 flex items-center px-8 glass-nav z-20 absolute top-0 w-full">
      <div class="flex items-center gap-3">
        <span
          class="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
          >🛡️</span
        >
        <div>
          <h1 class="text-sm font-bold text-slate-800">Claims Advisor</h1>
          <p class="text-[10px] text-slate-400 font-medium tracking-wide">条款 RAG · 可引用 sources</p>
        </div>
      </div>
      <button
        @click="clearChat"
        class="ml-auto flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 border border-slate-200 bg-white/50 px-3 py-1.5 rounded-full shadow-sm transition-all hover:shadow-md"
      >
        <span>+</span> New Chat
      </button>
    </header>

    <div ref="chatBoxRef" class="flex-1 overflow-y-auto px-8 pt-24 pb-32 space-y-6">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        class="flex gap-4 fade-up max-w-3xl mx-auto w-full"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          v-if="msg.role !== 'user'"
          class="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm shrink-0 mt-1"
        >
          🛡️
        </div>

        <div
          :class="
            msg.role === 'user'
              ? 'bg-slate-900 text-white rounded-tr-sm'
              : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
          "
          class="px-5 py-3.5 rounded-2xl shadow-sm text-[15px] max-w-[85%] leading-relaxed"
        >
          <div v-if="msg.role === 'user'" class="whitespace-pre-wrap">{{ msg.content }}</div>
          <div v-else class="space-y-3">
            <!-- 检索引用：默认折叠，整行可点，标题与三角紧挨 -->
            <div
              v-if="msg.sources && msg.sources.length"
              class="rounded-xl border border-purple-100 bg-purple-50/70 overflow-hidden"
            >
              <button
                type="button"
                class="w-full flex items-center gap-1.5 px-3 py-2.5 text-left hover:bg-purple-50 transition-colors"
                :aria-expanded="!!msg.sourcesExpanded"
                @click="toggleSources(msg)"
              >
                <span class="text-[11px] font-bold text-purple-700 tracking-wide whitespace-nowrap">
                  📚 检索引用 ({{ msg.sources.length }})
                </span>
                <span
                  class="text-purple-500 text-[10px] leading-none select-none transition-transform duration-200"
                  :class="msg.sourcesExpanded ? 'rotate-180' : ''"
                  aria-hidden="true"
                  >▾</span
                >
                <span class="text-[10px] text-purple-400/90 font-medium ml-1 truncate">
                  {{ msg.sourcesExpanded ? '点击收起' : '已召回条款片段 · 点击查看' }}
                </span>
              </button>

              <div
                v-show="msg.sourcesExpanded"
                class="px-3 pb-3 space-y-2 border-t border-purple-100/80"
              >
                <div
                  v-for="s in msg.sources"
                  :key="s.index"
                  class="text-xs text-slate-600 bg-white/90 border border-purple-100 rounded-lg px-3 py-2"
                >
                  <div class="font-semibold text-purple-800 mb-0.5">
                    [#{{ s.index }}]
                    <span v-if="s.page">p.{{ s.page }}</span>
                    <span v-if="s.score != null" class="text-slate-400 font-normal ml-1"
                      >score {{ s.score }}</span
                    >
                  </div>
                  <div class="leading-snug text-slate-600">{{ s.snippet }}</div>
                </div>
              </div>
            </div>

            <div
              v-if="msg.guards && msg.guards.length"
              class="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 font-medium"
            >
              安全闸门已拦截：{{
                msg.guards.includes('policy_hard_refuse_empty')
                  ? '无相关条款召回 · 代码层拒答'
                  : msg.guards.includes('policy_hard_refuse_filtered')
                    ? '召回距离过远已滤除 · 代码层拒答'
                    : msg.guards.join(', ')
              }}
            </div>

            <div class="markdown-body inline">
              <span v-html="marked.parse(msg.content || '')"></span>
              <span
                v-if="isGenerating && index === messages.length - 1 && msg.role === 'ai'"
                class="inline-block w-2 h-4 bg-purple-500 animate-pulse ml-1 align-middle"
              ></span>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="messages.length === 1"
        class="mt-8 flex flex-wrap sm:flex-nowrap gap-2 justify-center w-full max-w-3xl mx-auto fade-up"
        style="animation-delay: 0.2s"
      >
        <button
          v-for="pill in promptPills"
          :key="pill"
          @click="sendPrompt(pill)"
          class="whitespace-nowrap bg-white/80 border border-slate-200 text-slate-600 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 hover:shadow-sm px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all transform hover:-translate-y-0.5"
        >
          {{ pill }}
        </button>
      </div>
    </div>

    <div class="absolute bottom-0 left-0 right-0 p-6 glass-bottom z-20">
      <div
        class="max-w-3xl mx-auto bg-white rounded-[2rem] shadow-apple border border-slate-200 p-2 pl-6 flex items-center focus-within:border-slate-300 focus-within:ring-4 focus-within:ring-slate-100 transition-all"
      >
        <input
          v-model="inputVal"
          @keyup.enter="sendMessage"
          type="text"
          class="flex-1 bg-transparent border-none outline-none text-base placeholder-slate-400"
          placeholder="描述理赔场景，将检索本地条款后回答..."
        />
        <button
          @click="sendMessage"
          :disabled="isGenerating"
          class="bg-slate-900 hover:bg-black text-white rounded-full w-10 h-10 flex items-center justify-center transition-transform hover:scale-105 shrink-0 ml-2 shadow-sm disabled:opacity-50"
        >
          ↑
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.markdown-body p) {
  margin-bottom: 0.5rem;
  display: inline-block;
}
:deep(.markdown-body p:last-child) {
  margin-bottom: 0;
}
:deep(.markdown-body strong) {
  font-weight: 700;
  color: #0f172a;
}
:deep(.markdown-body ul) {
  list-style-type: disc;
  margin-left: 1.5rem;
  margin-bottom: 0.5rem;
}
:deep(.markdown-body ol) {
  list-style-type: decimal;
  margin-left: 1.5rem;
  margin-bottom: 0.5rem;
}
:deep(.markdown-body li) {
  margin-bottom: 0.25rem;
}
:deep(.markdown-body code) {
  background-color: #f3e8ff;
  padding: 0.15rem 0.3rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.9em;
  color: #7e22ce;
}
</style>
