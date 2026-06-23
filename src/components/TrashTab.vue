<script setup>
import { ref, onMounted, onActivated } from 'vue'

const API_BASE = 'http://127.0.0.1:8000'
const trashBills = ref([])

// 批量操作状态
const batchMode = ref('all') // 'all' 或 'range'
const startDate = ref('')
const endDate = ref('')
const isProcessing = ref(false)

const fetchTrashBills = async () => {
    try {
        const token = localStorage.getItem('jwt_token')
        // 🌟 核心修复：将 /bill/list/trash 改回正确的 /bill/trash
        const response = await fetch(`${API_BASE}/bill/trash`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        const resData = await response.json()
        if (resData.code === 200) {
            // 兼容性极强的数据提取
            trashBills.value = Array.isArray(resData.data) ? resData.data : (resData.data?.list || [])
        }
    } catch (error) {
        console.error('获取回收站账单失败:', error)
    }
}

// 恢复单条
const restoreBill = async (id) => {
    if (!confirm('确定要恢复这条账单吗？')) return
    try {
        const token = localStorage.getItem('jwt_token')
        const response = await fetch(`${API_BASE}/bill/restore/${id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        })
        if (response.ok) {
            fetchTrashBills()
        }
    } catch (error) {
        console.error('恢复失败:', error)
    }
}

// 彻底删除单条
const deletePermanently = async (id) => {
    if (!confirm('彻底删除后将无法恢复，确认删除吗？')) return
    try {
        const token = localStorage.getItem('jwt_token')
        const response = await fetch(`${API_BASE}/bill/hard_delete/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        })
        if (response.ok) {
            fetchTrashBills()
        }
    } catch (error) {
        console.error('删除失败:', error)
    }
}

// 一键批量恢复
const handleBulkRestore = async () => {
    if (batchMode.value === 'range' && (!startDate.value || !endDate.value)) {
        return alert("请选择完整的起始和结束日期！")
    }
    if (!confirm(`确定要恢复${batchMode.value === 'all' ? '回收站里的所有' : '选定日期范围内的'}账单吗？`)) return

    isProcessing.value = true
    try {
        const token = localStorage.getItem('jwt_token')
        let url = `${API_BASE}/bill/bulk_restore?restore_all=${batchMode.value === 'all'}`
        if (batchMode.value === 'range') {
            url += `&start_date=${startDate.value}&end_date=${endDate.value}`
        }

        const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }})
        const resData = await response.json()
        
        if (response.ok && resData.code === 200) {
            alert(resData.msg)
            fetchTrashBills()
        } else {
            alert(resData.detail || "恢复失败")
        }
    } catch (error) {
        alert("网络异常，批量恢复失败")
    } finally {
        isProcessing.value = false
    }
}

// 一键彻底清空
const handleBulkHardDelete = async () => {
    if (batchMode.value === 'range' && (!startDate.value || !endDate.value)) {
        return alert("请选择完整的起始和结束日期！")
    }
    if (!confirm(`⚠️ 危险操作：确定要彻底销毁${batchMode.value === 'all' ? '回收站里的所有' : '选定日期范围内的'}账单吗？一旦删除将永久消失！`)) return

    isProcessing.value = true
    try {
        const token = localStorage.getItem('jwt_token')
        let url = `${API_BASE}/bill/bulk_hard_delete?delete_all=${batchMode.value === 'all'}`
        if (batchMode.value === 'range') {
            url += `&start_date=${startDate.value}&end_date=${endDate.value}`
        }

        const response = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }})
        const resData = await response.json()
        
        if (response.ok && resData.code === 200) {
            alert(resData.msg)
            fetchTrashBills()
        } else {
            alert(resData.detail || "删除失败")
        }
    } catch (error) {
        alert("网络异常，批量删除失败")
    } finally {
        isProcessing.value = false
    }
}

// 页面首次挂载时拉取数据
onMounted(() => {
    fetchTrashBills()
})

// 使用 <KeepAlive> 的情况下，每次切回该页面都会触发 onActivated
onActivated(() => {
    fetchTrashBills()
})
</script>

<template>
    <div class="p-8 h-full overflow-y-auto">
        <h1 class="text-2xl font-bold mb-6 text-slate-800 dark:text-white flex items-center justify-between">
            <span>🗑️ 回收站 <span class="text-sm font-normal text-slate-400 ml-2">({{ trashBills.length }} 条记录)</span></span>
        </h1>

        <div v-if="trashBills.length > 0" class="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm mb-6 flex flex-col xl:flex-row gap-5 items-start xl:items-end border border-slate-100 dark:border-slate-700 fade-up">
            
            <div class="flex-1 space-y-3 w-full">
                <label class="text-sm font-bold text-slate-700 dark:text-slate-300">⚙️ 批量操作范围</label>
                <div class="flex flex-wrap items-center gap-4">
                    <label class="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 transition-colors">
                        <input type="radio" v-model="batchMode" value="all" class="text-indigo-600 focus:ring-indigo-500 w-4 h-4">
                        <span class="text-sm text-slate-700 dark:text-slate-300">全部账单</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 transition-colors">
                        <input type="radio" v-model="batchMode" value="range" class="text-indigo-600 focus:ring-indigo-500 w-4 h-4">
                        <span class="text-sm text-slate-700 dark:text-slate-300">指定日期范围</span>
                    </label>

                    <div v-if="batchMode === 'range'" class="flex items-center gap-2 animate-fade-in">
                        <input type="date" v-model="startDate" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-sm rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500">
                        <span class="text-slate-400 text-sm">至</span>
                        <input type="date" v-model="endDate" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-sm rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>
                </div>
            </div>

            <div class="flex gap-3 w-full xl:w-auto">
                <button @click="handleBulkRestore" :disabled="isProcessing" class="flex-1 xl:flex-none bg-slate-900 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    一键恢复
                </button>
                <button @click="handleBulkHardDelete" :disabled="isProcessing" class="flex-1 xl:flex-none bg-white dark:bg-slate-800 text-red-500 hover:text-red-600 border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-900/50 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm active:scale-95">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    彻底销毁
                </button>
            </div>
        </div>

        <div v-if="trashBills.length === 0" class="text-center text-slate-500 mt-20">
            回收站是空的
        </div>

        <div v-else class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden fade-up" style="animation-delay: 0.1s;">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm">
                        <th class="p-4 font-medium">日期</th>
                        <th class="p-4 font-medium">类型</th>
                        <th class="p-4 font-medium">分类</th>
                        <th class="p-4 font-medium">金额</th>
                        <th class="p-4 font-medium">备注</th>
                        <th class="p-4 font-medium text-right">操作</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="bill in trashBills" :key="bill.id" class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm">
                        <td class="p-4 text-slate-600 dark:text-slate-300">{{ bill.date }}</td>
                        <td class="p-3 md:p-4 whitespace-nowrap">
    <span class="inline-flex items-center justify-center w-10 md:w-12 py-1 rounded-md text-[11px] md:text-xs font-bold tracking-widest"
          :class="bill.type === 'income' ? 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100/80 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'">
        {{ bill.type === 'income' ? '收入' : '支出' }}
    </span>
</td>
                        <td class="p-4 text-slate-700 dark:text-slate-300">{{ bill.category }}</td>
                        <td class="p-4 font-bold" :class="bill.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-slate-800 dark:text-white'">
                            {{ bill.type === 'income' ? '+' : '-' }}¥{{ bill.amount }}
                        </td>
                        <td class="p-4 text-slate-500 dark:text-slate-400 max-w-[200px] truncate" :title="bill.remark">{{ bill.remark || '-' }}</td>
                        <td class="p-3 md:p-4">
    <div class="flex items-center justify-end gap-1 md:gap-2">
        
        <button @click="restoreBill(bill.id)" 
                class="text-xs md:text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            恢复
        </button>
        
        <button @click="permanentlyDeleteBill(bill.id)" 
                class="text-xs md:text-sm font-medium text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            <span class="hidden sm:inline">彻底</span>删除
        </button>

    </div>
</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<style scoped>
.fade-up {
    animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
    animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}
</style>