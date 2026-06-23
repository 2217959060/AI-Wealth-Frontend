<script setup>
import { ref, computed, watch } from 'vue'
import { fetchWithAuth } from '../api'
import { useModalStore } from '../stores/modal'

const modalStore = useModalStore()

const type = ref('expense')
const date = ref('')
const amount = ref('')
const category = ref('')
const remark = ref('')
const dbCategories = ref({ expense: [], income: [] })

// 计算属性：根据当前选择的 type，自动计算下拉框该显示什么分类
const currentCategoryList = computed(() => {
    const cats = dbCategories.value[type.value]
    if (cats && cats.length > 0) return cats.map(c => c.name)
    // 兜底默认分类
    return type.value === 'expense' ? ['餐饮', '交通', '购物', '娱乐'] : ['工资', '兼职']
})

// 当弹窗打开时，拉取分类数据并回显修改数据
watch(() => modalStore.isManualModalOpen, async (isOpen) => {
    if (isOpen) {
        // 1. 拉取最新的分类
        try {
            const res = await fetchWithAuth('/category/list')
            if (res.code === 200) {
                dbCategories.value.expense = res.data.filter(c => c.type === 'expense')
                dbCategories.value.income = res.data.filter(c => c.type === 'income')
            }
        } catch (err) { console.error(err) }

        // 2. 如果存在 editBillData，说明是修改模式，立刻回显数据
        if (modalStore.editBillData) {
            const b = modalStore.editBillData
            type.value = b.type
            date.value = b.date
            amount.value = b.amount
            remark.value = b.remark
            category.value = b.category
        } else {
            // 否则是新增模式，恢复默认值
            type.value = 'expense'
            date.value = new Date().toISOString().slice(0, 10)
            amount.value = ''
            remark.value = ''
            category.value = currentCategoryList.value[0]
        }
    }
})

const submitBill = async () => {
    if (!date.value || !amount.value || amount.value <= 0) {
        alert("请填写正确的日期和金额")
        return
    }

    const isEdit = !!modalStore.editBillData
    const url = isEdit ? `/bill/update/${modalStore.editBillData.id}` : `/bill/add`
    const method = isEdit ? 'PUT' : 'POST'

    try {
        const res = await fetchWithAuth(url, {
            method: method,
            body: JSON.stringify({ type: type.value, category: category.value, amount: parseFloat(amount.value), remark: remark.value, date: date.value })
        })
        
        if (res.code === 200) {
            modalStore.closeManualModal()
            modalStore.triggerRefresh() // 提交成功，触发大屏刷新
        } else {
            alert(res.msg)
        }
    } catch (err) { alert("保存失败") }
}
</script>

<template>
    <div v-if="modalStore.isManualModalOpen" class="fixed inset-0 bg-slate-900/20 flex items-center justify-center z-[60] backdrop-blur-sm transition-opacity">
        <div class="bg-white p-8 rounded-[2rem] shadow-apple border border-slate-100 w-[450px] fade-up">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-slate-800">{{ modalStore.editBillData ? '修改账单' : '手动录入账单' }}</h3>
                <button @click="modalStore.closeManualModal" class="text-slate-400 hover:text-slate-800 text-2xl leading-none transition-colors">&times;</button>
            </div>
            
            <div class="space-y-4">
                <div class="flex gap-4">
                    <label class="flex-1 flex items-center justify-center gap-2 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50">
                        <input type="radio" v-model="type" value="expense" class="accent-slate-900"> <span class="text-sm font-medium">支出</span>
                    </label>
                    <label class="flex-1 flex items-center justify-center gap-2 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50">
                        <input type="radio" v-model="type" value="income" class="accent-slate-900"> <span class="text-sm font-medium">收入</span>
                    </label>
                </div>
                
                <div class="flex gap-4">
                    <div class="flex-1"><label class="text-xs font-semibold text-slate-500 mb-1 block">日期</label><input type="date" v-model="date" class="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-slate-200 text-sm"></div>
                    <div class="flex-1"><label class="text-xs font-semibold text-slate-500 mb-1 block">金额</label><input type="number" v-model="amount" placeholder="0.00" class="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-slate-200 text-sm"></div>
                </div>
                
                <div>
                    <label class="text-xs font-semibold text-slate-500 mb-1 block">分类 (自动同步后端配置)</label>
                    <select v-model="category" class="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-slate-200 text-sm cursor-pointer">
                        <option v-for="cat in currentCategoryList" :key="cat" :value="cat">{{ cat }}</option>
                        <option value="其他">其他</option>
                    </select>
                </div>
                
                <div>
                    <label class="text-xs font-semibold text-slate-500 mb-1 block">备注</label>
                    <input type="text" v-model="remark" @keyup.enter="submitBill" placeholder="写点什么..." class="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-slate-200 text-sm">
                </div>
            </div>
            
            <button @click="submitBill" class="mt-8 w-full bg-slate-900 text-white font-medium py-3.5 rounded-xl hover:bg-slate-800 transition-all text-sm">保存账单</button>
        </div>
    </div>
</template>