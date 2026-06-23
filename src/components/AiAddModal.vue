<script setup>
import { ref } from 'vue'
import { fetchWithAuth } from '../api'
import { useModalStore } from '../stores/modal'

const modalStore = useModalStore()
const inputVal = ref('')
const aiThoughts = ref('')
const status = ref('idle') // idle | processing | success

const submitAiBill = async () => {
    if (!inputVal.value.trim() || status.value === 'processing') return
    status.value = 'processing'
    
    try {
        const res = await fetchWithAuth('/bill/ai_add', { 
            method: 'POST', 
            body: JSON.stringify({ text: inputVal.value }) 
        })
        
        if (res.code === 200) {
            aiThoughts.value = res.data.ai_thoughts
            status.value = 'success'
            
            // 2秒后自动关闭弹窗，并通知大屏刷新数据！
            setTimeout(() => {
                modalStore.closeAiModal()
                modalStore.triggerRefresh() 
                
                // 恢复默认状态
                inputVal.value = ''
                aiThoughts.value = ''
                status.value = 'idle'
            }, 2000)
        } else throw new Error(res.msg)
    } catch (err) {
        alert("AI 推算失败，请重试：" + err.message)
        status.value = 'idle'
    }
}
</script>

<template>
    <div v-if="modalStore.isAiModalOpen" class="fixed inset-0 bg-slate-900/20 flex items-center justify-center z-[60] backdrop-blur-sm transition-opacity">
        <div class="bg-white p-8 rounded-[2rem] shadow-apple border border-slate-100 w-[550px] fade-up">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold flex items-center gap-2 text-slate-800">✨ 魔法速记</h3>
                <button @click="modalStore.closeAiModal" class="text-slate-400 hover:text-slate-800 text-2xl leading-none transition-colors">&times;</button>
            </div>
            
            <textarea v-model="inputVal" rows="4" class="w-full bg-slate-50/50 border border-slate-200 rounded-xl p-5 outline-none focus:bg-white focus:ring-2 focus:ring-slate-200 text-base transition-all resize-none" placeholder="描述你的花销... 例如：昨天打车花了45"></textarea>
            
            <div v-if="aiThoughts" class="mt-4 p-4 bg-slate-50 text-slate-600 text-xs rounded-xl font-mono border border-slate-200">
                <b>⚡ Thought Process:</b><br><span v-html="aiThoughts.replace(/\n/g, '<br>')"></span>
            </div>
            
            <button @click="submitAiBill" :disabled="status !== 'idle'" 
                :class="status === 'success' ? 'bg-emerald-500' : 'bg-slate-900 hover:bg-slate-800'"
                class="mt-6 w-full text-white font-medium py-3.5 rounded-xl transition-all text-sm disabled:opacity-80">
                <span v-if="status === 'idle'">提交分析</span>
                <span v-else-if="status === 'processing'">Processing...</span>
                <span v-else>✅ 记账成功</span>
            </button>
        </div>
    </div>
</template>