import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        // 移除 anonymous_user_id
        const { key } = request.body;
        
        if (!key) {
             return response.status(400).json({ success: false, message: '密钥格式无效' });
        }
        
        const keyData = await kv.hgetall(`key:${key}`);
        if (!keyData) {
            return response.status(404).json({ success: false, message: '密钥无效或不存在' });
        }

        const isPermanent = keyData.key_type === 'permanent';

        // 检查所有密钥的通用规则

        // 1. 试用密钥到期后失效
        if (keyData.key_type === 'trial' && keyData.expires_at && new Date() > new Date(keyData.expires_at)) {
            return response.status(403).json({ success: false, message: '试用密钥已过期，请购买永久密钥。' });
        }

        // 2. 检查密钥是否已被使用 (one-key-one-activation)
        if (keyData.validation_status === 'used') {
            // 【核心逻辑】：永久密钥已激活，直接返回成功，前端拿到链接后无需再次调用
            if (isPermanent) {
                const config = await kv.hgetall('system_config');
                return response.status(200).json({ 
                    success: true, 
                    message: '永久密钥已激活且有效。', 
                    data: { shortcut_link: config?.SHORTCUT_ICLOUD_LINK || '' } 
                });
            }
            // 试用密钥已被使用，阻止二次激活（实现“一人一试”的简易替代）
            return response.status(409).json({ success: false, message: '此密钥已被使用。' });
        }

        // 激活流程 (Key is valid and 'unused')
        const validationTime = new Date().toISOString();
        const updateData = {
            ...keyData,
            validation_status: 'used',
            web_validated_time: validationTime,
            activated_at: validationTime
        };
        
        // 移除所有 anonymous_user_id 逻辑

        await kv.hset(`key:${key}`, updateData);

        // 返回配置链接
        const config = await kv.hgetall('system_config');
        return response.status(200).json({ 
            success: true, 
            message: `${isPermanent ? '永久' : '试用'}密钥首次激活成功。`,
            data: {
                shortcut_link: config?.SHORTCUT_ICLOUD_LINK || '',
            }
        });

    } catch (error) {
        console.error('密钥验证API出错:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}