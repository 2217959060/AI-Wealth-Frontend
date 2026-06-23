<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
    options: {
        type: Object,
        required: true
    }
})

const chartRef = ref(null)
let chartInstance = null
let resizeObserver = null // 🌟 移动端自适应杀手锏

const initChart = async () => {
    // 1. 强制等待一帧，确保 Vue 把父级聊天气泡的 DOM 尺寸全部计算完毕
    await nextTick()

    if (!chartRef.value) return

    // 2. 如果已经存在实例，先销毁，防止内存泄漏
    if (chartInstance) {
        chartInstance.dispose()
    }

    // 3. 初始化并注入数据
    chartInstance = echarts.init(chartRef.value)
    chartInstance.setOption(props.options)

    // 4. 🌟 挂载 ResizeObserver：它比普通的 window.resize 强大百倍
    // 只要这个 div 的物理尺寸有哪怕 1 像素的变化（比如手机横屏、弹出软键盘），它都会瞬间重绘图表
    resizeObserver = new ResizeObserver(() => {
        if (chartInstance) {
            chartInstance.resize()
        }
    })
    resizeObserver.observe(chartRef.value)
}

onMounted(() => {
    // 故意延迟 100ms：给移动端的流式输出动画和弹性盒子(Flexbox)留出撑开高度的时间
    setTimeout(() => {
        initChart()
    }, 100)
})

// 监听大模型返回的动态数据更新
watch(() => props.options, (newVal) => {
    if (chartInstance) {
        chartInstance.setOption(newVal)
    }
}, { deep: true })

onUnmounted(() => {
    // 离开页面时安全卸载雷达和图表实例
    if (resizeObserver && chartRef.value) {
        resizeObserver.unobserve(chartRef.value)
    }
    if (chartInstance) {
        chartInstance.dispose()
    }
})
</script>

<template>
    <div class="chart-wrapper w-full bg-white dark:bg-slate-800 rounded-xl p-1 my-4 border border-slate-100 dark:border-slate-700 shadow-sm relative z-10 overflow-hidden">
        <div ref="chartRef" class="w-full h-[300px] md:h-[350px]"></div>
    </div>
</template>