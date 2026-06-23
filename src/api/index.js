// src/api/index.js
const API_BASE = 'http://127.0.0.1:8000';

export async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('jwt_token');
    const headers = { 
        'Content-Type': 'application/json', 
        ...(token && { 'Authorization': `Bearer ${token}` }) 
    };
    
    const response = await fetch(`${API_BASE}${url}`, { ...options, headers });
    
    if (response.status === 401) {
        localStorage.removeItem('jwt_token');
        window.location.href = '/login'; // 被拦截后直接踢回登录页
        throw new Error("凭证过期，请重新登录");
    }
    if (!response.ok && response.status !== 200) throw new Error(`请求失败 (HTTP ${response.status})`);
    
    return response.json();
}