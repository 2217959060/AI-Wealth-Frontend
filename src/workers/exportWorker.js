// src/workers/exportWorker.js
import * as XLSX from 'xlsx'

// 监听主线程发来的消息
self.onmessage = (e) => {
    // 1. 接收主线程传来的海量数据
    const { data, filterType } = e.data;

    try {
        // 2. 开始重体力劳动：遍历十万级数据，进行格式化
        const wsData = data.map(b => ({
            日期: b.date, 
            类型: b.type === 'income' ? '收入' : '支出', 
            分类: b.category, 
            备注: b.remark || '-', 
            金额: b.amount
        }));

        // 3. 生成 Excel 工作表
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "账单数据");

        // 🌟 4. 核心性能点：不能直接写文件（Worker 没权限），必须转为 ArrayBuffer
        // type: 'array' 会生成一个极其底层的二进制缓冲区，方便我们在线程间“零拷贝”传输
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

        // 5. 将处理好的二进制数据发回给主线程
        // 注意第三个参数 [excelBuffer]，这是转移所有权（Transferable），性能极高！
        self.postMessage(
            { status: 'success', buffer: excelBuffer, filterType }, 
            [excelBuffer] 
        );
    } catch (error) {
        self.postMessage({ status: 'error', message: error.message });
    }
}