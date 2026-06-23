<script setup>
import { ref, onMounted } from 'vue'
import { fetchWithAuth } from '../api'

const expenseCategories = ref([])
const incomeCategories = ref([])
const newCatType = ref('expense')
const newCatName = ref('')

const loadCategories = async () => {
    try {
        const res = await fetchWithAuth('/category/list')
        if (res.code === 200) {
            expenseCategories.value = res.data.filter(c => c.type === 'expense')
            incomeCategories.value = res.data.filter(c => c.type === 'income')
        }
    } catch (err) { console.error(err) }
}

const addCategory = async () => {
    if (!newCatName.value.trim()) return
    try {
        const res = await fetchWithAuth('/category/add', {
            method: 'POST',
            body: JSON.stringify({ type: newCatType.value, name: newCatName.value.trim() })
        })
        if (res.code === 200) {
            newCatName.value = ''
            loadCategories() // 添加成功后重新拉取列表
        } else {
            alert(res.msg || res.detail)
        }
    } catch (err) { console.error(err) }
}

const deleteCategory = async (id) => {
    if (!confirm("确定删除此分类吗？（已有账单的分类无法删除）")) return
    try {
        const res = await fetchWithAuth(`/category/delete/${id}`, { method: 'DELETE' })
        if (res.code === 200) loadCategories()
        else alert(res.msg || res.detail)
    } catch (err) { console.error(err) }
}

// 组件挂载时自动拉取数据
onMounted(() => {
    loadCategories()
})
</script>

<template>
    <div class="p-10 overflow-y-auto h-full pb-24">
        <div class="max-w-4xl mx-auto">
            <div class="mb-8 fade-up">
                <h2 class="text-2xl font-bold text-slate-900 tracking-tight">分类管理</h2>
                <p class="text-slate-500 text-sm mt-1">自定义你的专属账单分类</p>
            </div>

            <div class="bg-white p-6 rounded-2xl shadow-apple border border-slate-100 mb-8 fade-up" style="animation-delay: 0.1s">
                <h3 class="text-sm font-bold text-slate-800 mb-4">新增自定义分类</h3>
                <div class="flex gap-4">
                    <select v-model="newCatType" class="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm font-medium w-32 focus:border-slate-400 cursor-pointer">
                        <option value="expense">支出</option>
                        <option value="income">收入</option>
                    </select>
                    <input v-model="newCatName" @keyup.enter="addCategory" type="text" placeholder="输入新分类名称 (如：数码产品)" class="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-slate-200 text-sm">
                    <button @click="addCategory" class="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg font-medium transition-colors text-sm">添 加</button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 fade-up" style="animation-delay: 0.2s">
                <div class="bg-white p-6 rounded-2xl shadow-apple border border-slate-100">
                    <h3 class="text-sm font-bold text-[#e11d48] mb-4 border-b border-slate-100 pb-2">支出分类</h3>
                    <div class="flex flex-wrap gap-2">
                        <div v-for="cat in expenseCategories" :key="cat.id" class="flex items-center gap-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 group transition-colors hover:bg-rose-50 hover:border-rose-200">
                            {{ cat.name }} 
                            <button @click="deleteCategory(cat.id)" class="ml-1 text-slate-400 group-hover:text-rose-500 font-bold">&times;</button>
                        </div>
                        <span v-if="expenseCategories.length === 0" class="text-slate-400 text-sm">暂无分类</span>
                    </div>
                </div>
                
                <div class="bg-white p-6 rounded-2xl shadow-apple border border-slate-100">
                    <h3 class="text-sm font-bold text-[#059669] mb-4 border-b border-slate-100 pb-2">收入分类</h3>
                    <div class="flex flex-wrap gap-2">
                        <div v-for="cat in incomeCategories" :key="cat.id" class="flex items-center gap-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 group transition-colors hover:bg-emerald-50 hover:border-emerald-200">
                            {{ cat.name }} 
                            <button @click="deleteCategory(cat.id)" class="ml-1 text-slate-400 group-hover:text-emerald-500 font-bold">&times;</button>
                        </div>
                        <span v-if="incomeCategories.length === 0" class="text-slate-400 text-sm">暂无分类</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>