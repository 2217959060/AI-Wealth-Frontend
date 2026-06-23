<script setup>
import { ref, onUnmounted, nextTick } from 'vue'

const API_BASE = 'http://127.0.0.1:8000'
const WS_BASE = 'ws://127.0.0.1:8000' // 如果你部署到线上，这里要换成 wss://

const isDragging = ref(false)
const selectedFile = ref(null)
const isUploading = ref(false)
const progressSteps = ref([]) // 记录后台推过来的实时进度
const fileInput = ref(null)
const logsContainer = ref(null)

let ws = null

// 触发隐藏的文件选择框
const triggerSelect = () => {
    if (!isUploading.value) fileInput.value.click()
}

// 拖拽事件处理
const handleDragOver = (e) => { e.preventDefault(); isDragging.value = true }
const handleDragLeave = (e) => { e.preventDefault(); isDragging.value = false }
const handleDrop = (e) => {
    e.preventDefault()
    isDragging.value = false
    if (isUploading.value) return
    const files = e.dataTransfer.files
    if (files.length > 0) checkAndSetFile(files[0])
}

// 点击选择文件处理
const handleFileSelect = (e) => {
    const files = e.target.files
    if (files.length > 0) checkAndSetFile(files[0])
}

// 校验文件格式（限制为 PDF 或 CSV）
const checkAndSetFile = (file) => {
    const validTypes = ['application/pdf', 'text/csv', 'application/vnd.ms-excel']
    const ext = file.name.split('.').pop().toLowerCase()
    if (validTypes.includes(file.type) || ['pdf', 'csv'].includes(ext)) {
        selectedFile.value = file
    } else {
        alert("目前仅支持微信/支付宝导出的 PDF 或 CSV 格式账单！")
    }
}

// 自动滚动日志到底部
const scrollToBottom = async () => {
    await nextTick()
    if (logsContainer.value) {
        logsContainer.value.scrollTop = logsContainer.value.scrollHeight
    }
}

// 🚀 核心：开始上传并建立 WebSocket 监听
const startUpload = async () => {
    if (!selectedFile.value) return
    isUploading.value = true
    progressSteps.value = [] // 清空之前的日志

    // 生成一个随机的客户端ID，用于让后台准确定位到我们
    const clientId = `client_${Date.now()}_${Math.floor(Math.random() * 1000)}`

    // 1. 建立 WebSocket 连接
    ws = new WebSocket(`${WS_BASE}/ws/progress/${clientId}`)
    
    ws.onopen = async () => {
        progressSteps.value.push({ status: 'pending', msg: "🔗 WebSocket 通信通道已建立..." })
        
        // 2. 通道建好后，开始用 HTTP 发送庞大的文件实体
        const formData = new FormData()
        formData.append('file', selectedFile.value)

        try {
            const token = localStorage.getItem('jwt_token')
            const response = await fetch(`${API_BASE}/bill/upload?client_id=${clientId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            })
            
            const resData = await response.json()
            if (resData.code !== 200) {
                progressSteps.value.push({ status: 'error', msg: "❌ 文件上传失败：" + resData.msg })
                ws.close()
                isUploading.value = false
            }
        } catch (e) {
            progressSteps.value.push({ status: 'error', msg: "❌ 网络异常，文件上传失败！" })
            ws.close()
            isUploading.value = false
        }
    }

    // 3. 倾听后台发来的进度汇报
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        // 根据步骤状态设置 UI 颜色
        let status = 'processing'
        if (data.step === 5) status = 'success'
        if (data.step === -1) status = 'error'

        progressSteps.value.push({ status, msg: data.msg })
        scrollToBottom()

        // 如果是最后一步或出错，关闭连接，释放状态
        if (data.step === 5 || data.step === -1) {
            ws.close()
            isUploading.value = false
            if (data.step === 5) {
                // 成功后清空选中的文件，准备下一次导入
                setTimeout(() => { selectedFile.value = null }, 3000)
            }
        }
    }

    ws.onerror = () => {
        progressSteps.value.push({ status: 'error', msg: "❌ WebSocket 连接异常断开！" })
        isUploading.value = false
    }
}

// 组件卸载时安全关闭 WebSocket
onUnmounted(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close()
    }
})
</script>

<template>
    <div class="h-full overflow-y-auto p-8 bg-[#fafafa] dark:bg-slate-900">
        <div class="max-w-3xl mx-auto space-y-8">
            <div>
                <h1 class="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span class="text-indigo-500">📥</span> 自动化账单导入
                </h1>
                <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm">
                    支持拖拽上传 <b>微信支付</b> 或 <b>支付宝</b> 导出的 CSV / PDF 交易明细。<br/>
                    系统将利用大模型进行全自动清洗、智能分类及入库。
                </p>
            </div>

            <div 
                @dragover="handleDragOver" 
                @dragleave="handleDragLeave" 
                @drop="handleDrop"
                @click="triggerSelect"
                :class="[
                    isDragging ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400',
                    isUploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
                ]"
                class="border-2 border-dashed rounded-3xl p-12 transition-all duration-300 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-800 shadow-sm hover:shadow-md group"
            >
                <input type="file" ref="fileInput" class="hidden" accept=".csv, .pdf" @change="handleFileSelect">
                
                <div class="w-20 h-20 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <svg class="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                </div>
                
                <h3 v-if="!selectedFile" class="text-lg font-bold text-slate-700 dark:text-white mb-2">点击选择文件，或拖拽到这里</h3>
                <h3 v-else class="text-lg font-bold text-indigo-600 mb-2">{{ selectedFile.name }}</h3>
                
                <p class="text-sm text-slate-400">目前支持 .csv 与 .pdf 格式</p>

                <button 
                    v-if="selectedFile && !isUploading"
                    @click.stop="startUpload"
                    class="mt-6 bg-slate-900 dark:bg-indigo-600 text-white px-8 py-3 rounded-full font-bold shadow-apple hover:shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    开始智能分析并入库
                </button>
            </div>

            <div v-if="progressSteps.length > 0" class="bg-slate-900 rounded-3xl p-6 shadow-2xl overflow-hidden relative fade-up">
                <div class="flex items-center justify-between mb-4 pb-4 border-b border-slate-700/50">
                    <h3 class="text-white font-bold flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                        后端处理进度
                    </h3>
                    <span v-if="isUploading" class="text-xs font-mono text-indigo-400 flex items-center gap-1">
                        <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        后台引擎运转中...
                    </span>
                    <span v-else class="text-xs font-mono text-green-400">任务结束</span>
                </div>
                
                <div ref="logsContainer" class="space-y-4 max-h-[300px] overflow-y-auto pr-2 font-mono text-sm">
                    <div 
                        v-for="(step, idx) in progressSteps" 
                        :key="idx" 
                        class="flex items-start gap-3 fade-up"
                        :style="`animation-delay: ${idx * 0.1}s`"
                    >
                        <div class="mt-0.5 shrink-0">
                            <span v-if="step.status === 'success'" class="text-green-400">✅</span>
                            <span v-else-if="step.status === 'error'" class="text-red-400">❌</span>
                            <span v-else class="text-indigo-400 opacity-70">⏳</span>
                        </div>
                        
                        <div :class="{
                            'text-green-400 font-bold': step.status === 'success',
                            'text-red-400 font-bold': step.status === 'error',
                            'text-slate-300': step.status === 'processing',
                            'text-slate-500': step.status === 'pending'
                        }">
                            {{ step.msg }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 滚动条美化 */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #475569; }
</style>