import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        const { key } = request.body;
        if (!key || typeof key !== 'string' || !/^[A-Za-z0-9]+$/.test(key) || key.length > 64) {
             return response.status(400).json({ success: false, message: '密钥格式无效' });
        }
        
        // 在数据库中查找密钥
        const keyData = await kv.hgetall(`key:${key}`);

        // 检查密钥是否存在
        if (!keyData) {
            return response.status(404).json({ success: false, message: '密钥无效或不存在' });
        }

        // 检查密钥是否已被激活/使用
        if (keyData.validation_status === 'used') {
            return response.status(409).json({ success: false, message: '此密钥已被使用' });
        }

        // 如果密钥有效且未使用，则更新其状态为“已激活”
        const validationTime = new Date().toISOString();
        await kv.hset(`key:${key}`, {
            validation_status: 'used',
            web_validated_time: validationTime
        });
        
        // 返回成功响应
        return response.status(200).json({ success: true, message: '密钥验证成功' });

    } catch (error) {
        console.error('API Error in /api/validate-key-web:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}