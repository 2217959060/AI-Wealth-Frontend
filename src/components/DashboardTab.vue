<script setup>
import { ref, onMounted, onUnmounted, onActivated, watch } from 'vue'
import * as echarts from 'echarts'
import { fetchWithAuth } from '../api'
import { useModalStore } from '../stores/modal'
import { useVirtualList } from '@vueuse/core'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable' 
import ExportWorker from '../workers/exportWorker.js?worker'

const isExportingExcel = ref(false) 
const modalStore = useModalStore()
const isLoading = ref(false) 

// ========== 批量删除相关 ==========
const showBatchDeleteModal = ref(false)
const deleteAll = ref(true)  // 默认删除全部
const startDate = ref('')
const endDate = ref('')

// 设置默认日期范围为本月1号至今天
const setDefaultDateRange = () => {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  startDate.value = firstDay.toISOString().slice(0, 10)
  endDate.value = now.toISOString().slice(0, 10)
}
// 打开弹窗时设置默认日期
const openBatchDeleteModal = () => {
  setDefaultDateRange()
  deleteAll.value = true
  showBatchDeleteModal.value = true
}

const closeBatchDeleteModal = () => {
  showBatchDeleteModal.value = false
}

const confirmBatchDelete = async () => {
  try {
    let url = '/bill/bulk_delete?'
    if (deleteAll.value) {
      url += 'delete_all=true'
    } else {
      if (!startDate.value || !endDate.value) {
        alert('请选择起始日期和结束日期')
        return
      }
      url += `start_date=${startDate.value}&end_date=${endDate.value}`
    }
    const res = await fetchWithAuth(url, { method: 'DELETE' })
    if (res.code === 200) {
      alert('✅ 批量删除成功！账单已移至回收站。')
      closeBatchDeleteModal()
      initDashboard() // 刷新列表
    } else {
      alert('❌ 删除失败：' + (res.msg || '未知错误'))
    }
  } catch (err) {
    console.error('批量删除失败:', err)
    alert('❌ 请求失败，请检查网络或后端状态。')
  }
}
// ========== 批量删除结束 ==========

const currentMonth = ref(new Date().toISOString().slice(0, 7))
const stats = ref({ weekIn: 0, weekOut: 0, monthBalance: 0, monthOut: 0 })
const bills = ref([])
const totalBills = ref(0)

const filterType = ref('')

const pieChartRef = ref(null)
const lineChartRef = ref(null)
let pieChartInstance = null
let lineChartInstance = null

const isDark = ref(
    localStorage.getItem('theme') === 'dark' || 
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
)

if (isDark.value) {
    document.documentElement.classList.add('dark')
} else {
    document.documentElement.classList.remove('dark')
}

const toggleDark = () => {
    isDark.value = !isDark.value
    if (isDark.value) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')  
    } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light') 
    }
}

watch(isDark, () => {
    renderCharts()
})

const exportExcel = async () => {
    if (isExportingExcel.value) return; 
    isExportingExcel.value = true;

    try {
        const res = await fetchWithAuth('/bill/export_all');
        const allData = res.data || [];

        if (allData.length === 0) {
            alert("当前没有可导出的数据！");
            isExportingExcel.value = false;
            return;
        }

        const worker = new ExportWorker();
        worker.postMessage({ data: allData, filterType: filterType.value });

        worker.onmessage = (e) => {
            const { status, buffer, filterType: ft, message } = e.data;
            if (status === 'success') {
                const dataBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `账单极速导出_${ft || '全量数据'}.xlsx`;
                link.click();
                URL.revokeObjectURL(url); 
            } else {
                alert("导出失败: " + message);
            }
            isExportingExcel.value = false;
            worker.terminate();
        };

        worker.onerror = (err) => {
            console.error("Worker 崩溃了:", err);
            alert("处理海量数据时发生异常。");
            isExportingExcel.value = false;
            worker.terminate();
        };

    } catch (err) {
        console.error("拉取数据失败:", err);
        alert("网络请求失败，无法获取导出数据");
        isExportingExcel.value = false;
    }
}

const exportPDF = async (e) => {
    const btn = e.target;
    const originalText = btn.innerText;
    btn.innerText = '生成中...';
    btn.disabled = true;

    try {
        const res = await fetchWithAuth(`/bill/list?page=1&size=9999`)
        const allData = res.data.list || []

        const doc = new jsPDF();
        const fontUrl = '/CustomChineseFont.ttf'; 
        const fontRes = await fetch(fontUrl);
        
        if (!fontRes.ok) {
            throw new Error("找不到本地字体文件");
        }
        const fontBuffer = await fontRes.arrayBuffer();
        
        let binary = '';
        const bytes = new Uint8Array(fontBuffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const fontBase64 = window.btoa(binary);

        doc.addFileToVFS('CustomChineseFont.ttf', fontBase64);
        doc.addFont('CustomChineseFont.ttf', 'CustomChineseFont', 'normal');
        doc.setFont('CustomChineseFont'); 

        doc.text("Bill Report - AI Wealth", 14, 15);
        
        autoTable(doc, {
            head: [['日期 / Date', '类型 / Type', '分类 / Category', '金额 / Amount']],
            body: allData.map(b => [
                b.date, 
                b.type === 'income' ? '收入' : '支出',
                b.category, 
                b.amount
            ]),
            startY: 20,
            styles: { 
                font: 'CustomChineseFont', 
                fontStyle: 'normal'        
            },
            headStyles: {
                fontStyle: 'normal',       
                fillColor: [15, 23, 42],   
                textColor: 255             
            }
        });
        
        doc.save(`账单导出_${filterType.value || '全量数据'}.pdf`);
    } catch (err) {
        console.error("PDF 导出错误:", err);
        alert("PDF 导出失败。");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

const fetchTopStats = async () => {
    try {
        const [weekRes, monthRes] = await Promise.all([
            fetchWithAuth('/bill/stat/week'),
            fetchWithAuth(`/bill/stat/total?month=${currentMonth.value}`)
        ])
        if (weekRes.code === 200) {
            stats.value.weekIn = weekRes.data.income
            stats.value.weekOut = weekRes.data.expense
        }
        if (monthRes.code === 200) {
            stats.value.monthBalance = monthRes.data.balance
            stats.value.monthOut = monthRes.data.expense
        }
    } catch (err) { console.error(err) }
}

const fetchBills = async () => {
    isLoading.value = true 
    try {
        const endpoint = filterType.value 
            ? `/bill/filter?type=${filterType.value}&size=1000` 
            : `/bill/list?page=1&size=1000` 
        const res = await fetchWithAuth(endpoint)
        
        bills.value = res.data.list || []
        totalBills.value = res.data.total
    } catch (err) { 
        console.error(err) 
    } finally {
        setTimeout(() => { isLoading.value = false }, 300) 
    }
}

const { list, containerProps, wrapperProps } = useVirtualList(bills, {
    itemHeight: 56,
})

const renderCharts = async () => {
    if (!currentMonth.value) return
    fetchTopStats() 
    
    try {
        const [pieRes, lineRes] = await Promise.all([
            fetchWithAuth(`/bill/stat/category?month=${currentMonth.value}&type=expense`),
            fetchWithAuth(`/bill/stat/trend?month=${currentMonth.value}`)
        ])

        if (!pieChartInstance) pieChartInstance = echarts.init(pieChartRef.value)
        if (!lineChartInstance) lineChartInstance = echarts.init(lineChartRef.value)
        
        pieChartInstance.clear()
        lineChartInstance.clear()

        const isDarkTheme = isDark.value
        const textColor = isDarkTheme ? '#cbd5e1' : '#0f172a'       
        const labelColor = isDarkTheme ? '#94a3b8' : '#64748b'      
        const axisLineColor = isDarkTheme ? '#334155' : '#e2e8f0'   
        const splitLineColor = isDarkTheme ? '#334155' : '#f1f5f9'  
        const tooltipBg = isDarkTheme ? '#1e293b' : '#fff'          
        const tooltipBorder = isDarkTheme ? '#475569' : '#e2e8f0'

        if (pieRes.code === 200 && pieRes.data.pie.length > 0) {
            pieChartInstance.setOption({
                tooltip: { trigger: 'item', backgroundColor: tooltipBg, borderColor: tooltipBorder, textStyle: {color: textColor} },
                legend: { bottom: '0%', itemWidth: 8, itemHeight: 8, icon: 'circle', textStyle: {color: labelColor, fontSize: 12} },
                color: isDarkTheme 
                    ? ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171'] 
                    : ['#0f172a', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
                series: [{ type: 'pie', center: ['50%', '42%'], radius: ['55%', '75%'], itemStyle: { borderRadius: 6, borderColor: isDarkTheme ? '#1e293b' : '#fff', borderWidth: 2 }, label: { show: false }, data: pieRes.data.pie }]
            })
        } else {
            pieChartInstance.setOption({ title: { text: 'No data', left: 'center', top: 'center', textStyle: { color: '#cbd5e1', fontSize: 12, fontWeight: 'normal' } } })
        }

        if (lineRes.code === 200 && Object.keys(lineRes.data.trend).length > 0) {
            const trendData = lineRes.data.trend; const dates = Object.keys(trendData).sort()
            lineChartInstance.setOption({
                tooltip: { trigger: 'axis', backgroundColor: tooltipBg, borderColor: tooltipBorder, textStyle: {color: textColor} },
                grid: { left: '0%', right: '0%', bottom: '5%', top: '10%', containLabel: true },
                xAxis: { type: 'category', boundaryGap: false, data: dates, splitLine:{show:false}, axisLabel:{color:labelColor, fontSize:10}, axisLine: {lineStyle: {color: axisLineColor}} },
                yAxis: { type: 'value', splitLine:{lineStyle:{type:'dashed', color:splitLineColor}}, axisLabel:{color:labelColor, fontSize:10} },
                series: [
                    { name: '收入', type: 'line', data: dates.map(d=>trendData[d].income), smooth: true, symbolSize:0, lineStyle: {width: 2, color: '#10b981'} },
                    { name: '支出', type: 'line', data: dates.map(d=>trendData[d].expense), smooth: true, symbolSize:0, lineStyle: {width: 2, color: isDarkTheme ? '#f87171' : '#0f172a'} }
                ]
            })
        } else {
            lineChartInstance.setOption({ title: { text: 'No data', left: 'center', top: 'center', textStyle: { color: '#cbd5e1', fontSize: 12, fontWeight: 'normal' } } })
        }
    } catch (err) { console.error(err) }
}

const deleteBill = async (id) => {
    if (!confirm("Move to trash?")) return
    try {
        await fetchWithAuth(`/bill/delete/${id}`, { method: 'DELETE' })
        initDashboard()
    } catch (err) { alert("删除失败") }
}

const changePage = (delta) => {
    if (filterType.value) return
    const maxPage = Math.ceil(totalBills.value / pageSize) || 1
    const newPage = currentPage.value + delta
    if (newPage >= 1 && newPage <= maxPage) fetchBills()
}

const jumpPage = (e) => {
    if (filterType.value) return
    const val = parseInt(e.target.value)
    const maxPage = Math.ceil(totalBills.value / pageSize) || 1
    if (val >= 1 && val <= maxPage) {
        fetchBills(val)
    } else {
        e.target.value = currentPage.value 
    }
}

const initDashboard = () => {
    fetchBills()
    renderCharts()
}

onMounted(() => {
    initDashboard()
    window.addEventListener('resize', () => {
        pieChartInstance?.resize()
        lineChartInstance?.resize()
    })
})

onActivated(() => {
    setTimeout(() => {
        if (lineChartInstance) lineChartInstance.resize()
        if (pieChartInstance) pieChartInstance.resize()
    }, 100) 
})

watch(() => modalStore.globalRefreshKey, () => {
    initDashboard()
})

</script>

<template>
    <div class="fade-up p-10 overflow-y-auto h-full pb-24 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800/80 transition-colors duration-300">
    <div>
        <h1 class="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
            Overview
        </h1>
        <p class="text-[13px] md:text-sm text-slate-500 dark:text-slate-400 mt-1 font-semibold tracking-wide">
            流动资产与实时看板
        </p>
    </div>

    <div class="flex items-center gap-2.5 mt-1 sm:mt-0">
        <button @click="modalStore.openManualModal()" 
                class="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-all active:scale-95">
            📝 手动录入
        </button>
                <input type="month" v-model="currentMonth" @change="renderCharts" class="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-sm outline-none font-medium text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer transition-colors">
                <button @click="initDashboard" class="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-1.5 rounded-md text-sm shadow-sm transition-colors">Sync</button>

                <button @click="toggleDark" class="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                    <svg v-if="!isDark" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                    <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </button>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-apple border border-slate-100 dark:border-slate-700 flex flex-col justify-center transition-colors duration-300">
                <p class="text-slate-500 dark:text-slate-400 font-medium mb-2 text-xs uppercase tracking-wider">本周收入</p>
                <p class="text-2xl font-bold text-slate-900 dark:text-white">¥ {{ parseFloat(stats.weekIn).toFixed(2) }}</p>
            </div>
            <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-apple border border-slate-100 dark:border-slate-700 flex flex-col justify-center transition-colors duration-300">
                <p class="text-slate-500 dark:text-slate-400 font-medium mb-2 text-xs uppercase tracking-wider">本周支出</p>
                <p class="text-2xl font-bold text-slate-900 dark:text-white">¥ {{ parseFloat(stats.weekOut).toFixed(2) }}</p>
            </div>
            <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-apple border border-slate-100 dark:border-slate-700 flex flex-col justify-center transition-colors duration-300">
                <p class="text-slate-500 dark:text-slate-400 font-medium mb-2 text-xs uppercase tracking-wider">本月结余</p>
                <p class="text-2xl font-bold text-slate-900 dark:text-white">¥ {{ parseFloat(stats.monthBalance).toFixed(2) }}</p>
            </div>
            <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-apple border border-slate-100 dark:border-slate-700 flex flex-col justify-center transition-colors duration-300">
                <p class="text-slate-500 dark:text-slate-400 font-medium mb-2 text-xs uppercase tracking-wider">本月总支</p>
                <p class="text-2xl font-bold text-slate-900 dark:text-white">¥ {{ parseFloat(stats.monthOut).toFixed(2) }}</p>
            </div>
        </div>
        

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-apple border border-slate-100 dark:border-slate-700 transition-colors duration-300">
                <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">分类占比</h3>
                <div ref="pieChartRef" class="w-full h-64"></div>
            </div>
            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-apple border border-slate-100 dark:border-slate-700 transition-colors duration-300">
                <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">收支趋势</h3>
                <div ref="lineChartRef" class="w-full h-64"></div>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-apple border border-slate-100 dark:border-slate-700 overflow-hidden mb-8 transition-colors duration-300">
            <div class="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 transition-colors duration-300">
                <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200">
                    流水明细 <span class="text-xs font-normal text-slate-400 ml-1">({{ totalBills }} 条)</span>
                </h3>
                <div class="flex gap-2">
                    <!-- 🗑️ 批量删除按钮（放在最左边） -->
                    <button @click="openBatchDeleteModal" 
                            class="text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-md text-xs font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
                        🗑️ 批量删除
                    </button>
                    <button 
                        @click="exportExcel" 
                        :disabled="isExportingExcel"
                        class="relative overflow-hidden text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-md text-xs font-bold transition-all"
                        :class="isExportingExcel ? 'cursor-not-allowed opacity-80' : 'hover:bg-emerald-100 dark:hover:bg-emerald-500/20'"
                    >
                        <span class="flex items-center gap-1" :class="{ 'opacity-0': isExportingExcel }">
                            Excel
                        </span>
                        <span v-if="isExportingExcel" class="absolute inset-0 flex items-center justify-center bg-emerald-100 dark:bg-emerald-500/20">
                            <svg class="animate-spin h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        </span>
                    </button>
                    <button @click="exportPDF" class="text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-md text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors">PDF</button>

                    <select v-model="filterType" @change="fetchBills()" class="px-3 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium outline-none shadow-sm cursor-pointer transition-colors">
                        <option value="">全部记录</option>
                        <option value="expense">仅支出</option>
                        <option value="income">仅收入</option>
                    </select>
                </div>
            </div>
            
            <div class="grid grid-cols-6 gap-4 bg-[#fafafa] dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 text-xs font-semibold border-b border-slate-100 dark:border-slate-700 py-3 px-6">
    <div>Date</div>
    <div>Type</div>
    <div>Category</div>
    <div>Remark</div>
    <div class="text-right">Amount</div>
    <div class="text-center">Action</div>
</div>

<div v-bind="containerProps" class="h-[400px] overflow-y-auto w-full custom-scrollbar">
    <div v-bind="wrapperProps" class="divide-y divide-slate-100 dark:divide-slate-700/50">
        
        <div 
            v-for="item in list" 
            :key="item.index" 
            class="grid grid-cols-6 gap-4 items-center px-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group h-[56px]"
        >
            <div class="text-slate-500 dark:text-slate-400 font-medium text-sm">{{ item.data.date }}</div>
            
            <div>
                <span v-if="item.data.type === 'income'" class="bg-[#ecfdf5] dark:bg-emerald-500/10 text-[#059669] dark:text-emerald-400 px-2 py-0.5 rounded text-[11px] font-semibold border border-[#a7f3d0] dark:border-emerald-500/20">Income</span>
                <span v-else class="bg-[#fff1f2] dark:bg-rose-500/10 text-[#e11d48] dark:text-rose-400 px-2 py-0.5 rounded text-[11px] font-semibold border border-[#fecdd3] dark:border-rose-500/20">Expense</span>
            </div>
            
            <div class="font-semibold text-slate-800 dark:text-slate-200 text-sm">{{ item.data.category }}</div>
            <div class="text-slate-400 dark:text-slate-500 truncate text-sm">{{ item.data.remark || '-' }}</div>
            
            <div class="text-right font-semibold text-sm" :class="item.data.type === 'income' ? 'text-slate-900 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'">
                {{ item.data.type === 'income' ? '+' : '-' }}¥{{ item.data.amount }}
            </div>
            
            <div class="text-center opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-2">
                <button @click="modalStore.openManualModal(item.data)" class="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-xs bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded transition-colors">Edit</button>
                <button @click="deleteBill(item.data.id)" class="text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-medium text-xs bg-rose-50 dark:bg-rose-500/10 px-3 py-1 rounded transition-colors">Delete</button>
            </div>
        </div>

    </div>
</div>
            
            
    </div>
</div>

<!-- ========== 批量删除模态框（内联） ========== -->
<div v-if="showBatchDeleteModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" @click.self="closeBatchDeleteModal">
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4 transition-colors">
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-slate-800 dark:text-slate-200">🗑️ 批量删除账单</h2>
            <button @click="closeBatchDeleteModal" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-2xl leading-none">&times;</button>
        </div>
        <div class="space-y-4">
            <div class="flex items-center gap-3">
                <input type="checkbox" id="deleteAll" v-model="deleteAll" class="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500">
                <label for="deleteAll" class="text-sm font-medium text-slate-700 dark:text-slate-300">删除全部账单（移至回收站）</label>
            </div>
            <div v-if="!deleteAll" class="space-y-3">
                <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">起始日期</label>
                    <input type="date" v-model="startDate" class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">结束日期</label>
                    <input type="date" v-model="endDate" class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none">
                </div>
            </div>
            <div class="flex gap-3 pt-2">
                <button @click="confirmBatchDelete" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">确认删除</button>
                <button @click="closeBatchDeleteModal" class="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold py-2.5 rounded-lg transition-colors text-sm">取消</button>
            </div>
        </div>
    </div>
</div>
<!-- ========== 批量删除模态框结束 ========== -->

</template>
<style scoped>
.list-enter-active,
.list-leave-active {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.list-enter-from {
    opacity: 0;
    transform: translateY(15px); 
}
.list-leave-to {
    opacity: 0;
    transform: translateX(30px); 
}
.list-leave-active {
    position: absolute;
}
</style>