// /api/validate.js (修正后)
import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        const { key } = request.body; 
        
        if (!key) {
             return response.status(400).json({ success: false, message: '缺少密钥' });
        }
        
        const keyData = await kv.hgetall(`key:${key}`);
        
        if (!keyData) {
            // 密钥不存在
            return response.status(404).json({ success: false, message: '密钥无效或不存在' });
        }

        // 密钥存在。不检查 validation_status，不修改任何状态。
        // 检查试用密钥是否过期
        if (keyData.key_type === 'trial' && keyData.expires_at && new Date() > new Date(keyData.expires_at)) {
            return response.status(403).json({ success: false, message: '试用密钥已过期，请购买永久密钥。' });
        }

        // ==========================================================
        // 【修正点】：在成功响应中返回密钥的关键信息
        // ==========================================================
        const responseData = {
            key_type: keyData.key_type || 'permanent', // 返回密钥类型
            expires_at: keyData.expires_at || null,     // 返回到期时间 (永久密钥为 null)
            validation_status: keyData.validation_status, // 返回激活状态 (used/unused)
            user_id: keyData.user_id || null
        };

        // 验证通过
        return response.status(200).json({ 
            success: true, 
            message: '密钥存在且有效。', 
            data: responseData // 返回所需信息
        });
        
    } catch (error) {
        console.error('API 密钥验证出错:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}