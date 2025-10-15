import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        // --- 核心修正点：现在 anonymous_user_id 是可选的 ---
        const { key, anonymous_user_id } = request.body;
        
        // 密钥是必需的
        if (!key) {
             return response.status(400).json({ success: false, message: '密钥格式无效' });
        }
        
        const keyData = await kv.hgetall(`key:${key}`);
        if (!keyData) {
            return response.status(404).json({ success: false, message: '密钥无效或不存在' });
        }
        
        // 如果是试用密钥，并且请求中包含了匿名ID，则执行严格的“一人一试用”检查
        if (keyData.key_type === 'trial' && anonymous_user_id) {
            const userHasTrialed = await kv.sismember('trial_users', anonymous_user_id);
            if (userHasTrialed) {
                return response.status(403).json({ success: false, message: '您已使用过试用密钥，无法再次激活。请输入永久密钥。' });
            }
        }

        // 检查所有密钥的通用规则（是否过期/是否已使用）
        if (keyData.key_type === 'trial' && keyData.expires_at && new Date() > new Date(keyData.expires_at)) {
            return response.status(403).json({ success: false, message: '密钥已过期' });
        }
        if (keyData.validation_status === 'used') {
            return response.status(409).json({ success: false, message: '此密钥已被使用' });
        }

        // 更新密钥状态
        const validationTime = new Date().toISOString();
        await kv.hset(`key:${key}`, {
            ...keyData,
            validation_status: 'used',
            web_validated_time: validationTime,
            activated_at: validationTime
        });

        // 如果激活的是试用密钥且匿名ID存在，则记录
        if (keyData.key_type === 'trial' && anonymous_user_id) {
            await kv.sadd('trial_users', anonymous_user_id);
        }
        
        return response.status(200).json({ 
            success: true, 
            message: '密钥激活成功',
            key_value: keyData.key_value,
            key_type: keyData.key_type,
            expires_at: keyData.expires_at 
        });

    } catch (error) {
        console.error("激活API出错:", error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}