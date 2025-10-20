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
        
        const keyName = `key:${key}`;
        const keyData = await kv.hgetall(keyName);
        
        if (!keyData) {
            return response.status(404).json({ success: false, message: '密钥无效或不存在' });
        }

        // 1. 检查试用密钥是否过期
        if (keyData.key_type === 'trial' && keyData.expires_at && new Date() > new Date(keyData.expires_at)) {
            return response.status(403).json({ success: false, message: '试用密钥已过期，请购买永久密钥。' });
        }
        
        // 2. 【核心前置检查】：未通过 Web 验证的密钥，通过 API 无法验证
        if (keyData.validation_status !== 'used') {
            return response.status(401).json({ success: false, message: '请先在Web页面完成激活。' });
        }

        // 3. 检查 API 验证次数限制 (默认 0)
        const apiChecks = parseInt(keyData.api_checks || 0, 10);
        const MAX_CHECKS = 2; // 最多验证 2 次
        
        if (apiChecks >= MAX_CHECKS) {
            return response.status(403).json({ success: false, message: `API 验证次数已达上限（${MAX_CHECKS}次）。` });
        }
        
        // 4. 验证通过：递增计数器并返回信息
        
        const newApiChecks = apiChecks + 1;
        
        // 使用 pipeline 确保更新和读取的原子性 (虽然这里只更新)
        await kv.hset(keyName, { api_checks: newApiChecks.toString() });

        const responseData = {
            key_type: keyData.key_type || 'permanent',
            expires_at: keyData.expires_at || null,
            validation_status: keyData.validation_status,
            user_id: keyData.user_id || null,
            api_checks_remaining: MAX_CHECKS - newApiChecks
        };

        return response.status(200).json({ 
            success: true, 
            message: `验证成功。这是第 ${newApiChecks} 次验证。`, 
            data: responseData
        });
        
    } catch (error) {
        console.error('API 密钥验证出错:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}