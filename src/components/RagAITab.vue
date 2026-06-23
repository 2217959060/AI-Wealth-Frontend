<script setup>
import { ref, nextTick, onMounted } from 'vue' // 👈 引入 onMounted
import { marked } from 'marked'

const API_BASE = 'http://127.0.0.1:8000'
const defaultWelcome = '已载入《保险条款.pdf》。遇到理赔纠纷或条款疑惑，请直接描述你的情况。'
const messages = ref([{ role: 'ai', content: defaultWelcome }])
const inputVal = ref('')
const isGenerating = ref(false)
const chatBoxRef = ref(null)

// 🌟 新增：页面加载时拉取历史记录 (注意这里 chat_type 是 rag)
const loadHistory = async () => {
  try {
    const token = localStorage.getItem('jwt_token')
    if (!token) return

    const response = await fetch(`${API_BASE}/ai/chat/history?chat_type=rag`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const resData = await response.json()

    if (resData.code === 200 && resData.data.history && resData.data.history.length > 0) {
      messages.value = [{ role: 'ai', content: defaultWelcome }, ...resData.data.history]
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

// 🌟 升级版：真正的清空当前会话记忆（前端清屏 + 后端删库）
const clearChat = async () => {
  if (confirm('确定要开启新对话，并清除管家刚才的短期记忆吗？')) {
    // 1. 先把前端界面清空
    messages.value = [{ role: 'ai', content: defaultWelcome }]

    // 2. 通知后端把 Redis 里的数据删掉
    try {
      const token = localStorage.getItem('jwt_token')
      if (!token) return

      await fetch(`${API_BASE}/ai/chat/history?chat_type=finance`, {
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

  messages.value.push({ role: 'ai', content: '' })
  const aiMsgIndex = messages.value.length - 1

  try {
    const token = localStorage.getItem('jwt_token')
    const response = await fetch(`${API_BASE}/ai/ask_policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: text }),
    })

    if (!response.ok) throw new Error('请求失败')

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
  } catch (err) {
    messages.value[aiMsgIndex].content = '❌ 网络错误，流式接收失败。'
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
        <h1 class="text-sm font-bold text-slate-800">Claims Advisor</h1>
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
          <div v-else class="markdown-body inline">
            <span v-html="marked.parse(msg.content)"></span>
            <span
              v-if="isGenerating && index === messages.length - 1 && msg.role === 'ai'"
              class="inline-block w-2 h-4 bg-purple-500 animate-pulse ml-1 align-middle"
            ></span>
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
          placeholder="检索保险知识库..."
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
