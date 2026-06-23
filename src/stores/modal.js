// src/stores/modal.js
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useModalStore = defineStore('modal', () => {
    // 弹窗可见性状态
    const isAiModalOpen = ref(false)
    const isManualModalOpen = ref(false)
    
    // 用于修改账单时，传递整行账单数据
    const editBillData = ref(null)

    // 全局刷新信号（大屏组件会监听这个信号）
    const globalRefreshKey = ref(0)
    const triggerRefresh = () => { globalRefreshKey.value++ }

    // AI 速记弹窗控制
    const openAiModal = () => { isAiModalOpen.value = true }
    const closeAiModal = () => { isAiModalOpen.value = false }

    // 手动录入弹窗控制 (带参说明是修改，不带参说明是新增)
    const openManualModal = (bill = null) => {
        editBillData.value = bill
        isManualModalOpen.value = true
    }
    const closeManualModal = () => {
        isManualModalOpen.value = false
        editBillData.value = null
    }

    return { 
        isAiModalOpen, isManualModalOpen, editBillData, globalRefreshKey,
        openAiModal, closeAiModal, openManualModal, closeManualModal, triggerRefresh 
    }
})