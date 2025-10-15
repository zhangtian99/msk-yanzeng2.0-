import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        const { key, anonymous_user_id } = request.body;
        if (!key || !anonymous_user_id) {
             return response.status(400).json({ success: false, message: '请求参数不完整' });
        }
        
        const keyData = await kv.hgetall(`key:${key}`);
        if (!keyData) {
            return response.status(404).json({ success: false, message: '密钥无效或不存在' });
        }
        
        if (keyData.key_type === 'trial') {
            // 检查试用密钥是否过期
            if (keyData.expires_at && new Date() > new Date(keyData.expires_at)) {
                return response.status(403).json({ success: false, message: '密钥已过期' });
            }
            // 检查该用户是否已使用过试用密钥
            const userHasTrialed = await kv.sismember('trial_users', anonymous_user_id);
            if (userHasTrialed) {
                return response.status(403).json({ success: false, message: '您已使用过试用密钥，无法再次激活。请输入永久密钥。' });
            }
        }
        
        if (keyData.validation_status === 'used') {
            return response.status(409).json({ success: false, message: '此密钥已被使用' });
        }

        const validationTime = new Date().toISOString();
        await kv.hset(`key:${key}`, {
            ...keyData,
            validation_status: 'used',
            web_validated_time: validationTime,
            activated_at: validationTime
        });

        // 如果激活的是试用密钥，则记录用户ID
        if (keyData.key_type === 'trial') {
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
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}