import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        // 必须从客户端（快捷指令）获取 key 和 user_id
        const { key, user_id } = request.body; 
        
        if (!key || !user_id) {
             return response.status(400).json({ success: false, message: '密钥或用户ID缺失' });
        }
        
        const keyData = await kv.hgetall(`key:${key}`);
        if (!keyData) {
            return response.status(404).json({ success: false, message: '密钥无效或不存在' });
        }

        const isPermanent = keyData.key_type === 'permanent';

        // 1. 试用密钥到期后失效
        if (keyData.key_type === 'trial' && keyData.expires_at && new Date() > new Date(keyData.expires_at)) {
            // 返回 403 明确告知客户端已过期
            return response.status(403).json({ success: false, message: '试用密钥已过期，请购买永久密钥。' });
        }

        // 获取配置链接
        const config = await kv.hgetall('system_config');
        const shortcut_link = config?.SHORTCUT_ICLOUD_LINK || '';

        // 构造基础成功数据
        const successData = {
            shortcut_link: shortcut_link,
            key_type: keyData.key_type || 'permanent',
            expires_at: keyData.expires_at || null,
            validation_status: keyData.validation_status
        };

        // 2. 检查密钥是否已被使用 (one-key-one-activation)
        if (keyData.validation_status === 'used') {
            // 2a. 永久密钥：直接返回成功
            if (isPermanent) {
                return response.status(200).json({ 
                    success: true, 
                    message: '永久密钥已激活且有效。', 
                    data: successData 
                });
            }
            
            // 2b. 已激活的试用密钥：必须是本用户才能继续使用
            if (keyData.user_id === user_id) {
                return response.status(200).json({ 
                    success: true, 
                    message: '试用密钥已激活且有效。', 
                    data: successData 
                });
            } else {
                // 如果密钥已激活，但不是当前用户的ID，阻止使用。
                return response.status(409).json({ success: false, message: '此密钥已被其他用户激活。' });
            }
        }

        // 3. 激活流程 (Key is valid and 'unused')
        
        if (!isPermanent) {
            // 【一人一试核心检查】：检查此 user_id 是否已经激活过任何试用密钥
            const trialUsed = await kv.exists(`user:trial_used:${user_id}`);
            if (trialUsed) {
                // ！！！ 关键的拦截 ！！！
                return response.status(409).json({ success: false, message: '您已使用过试用密钥，请购买永久密钥。' });
            }
        }
        
        // 3a. 记录激活信息
        const validationTime = new Date().toISOString();
        const updateData = {
            ...keyData,
            validation_status: 'used',
            web_validated_time: validationTime,
            activated_at: validationTime,
            user_id: user_id // 记录用户 ID
        };
        
        // 3b. 写入数据库
        const pipeline = kv.pipeline();
        pipeline.hset(`key:${key}`, updateData);

        if (!isPermanent) {
            // 【一人一试核心记录】：记录该用户 ID 已使用过试用密钥（永久标记）
            // 设置一个很长的过期时间，例如一年 (31536000秒)
            pipeline.set(`user:trial_used:${user_id}`, 'true', { ex: 31536000 }); 
        }
        
        await pipeline.exec();

        // 返回成功激活的响应
        successData.validation_status = 'used'; 
        successData.expires_at = updateData.expires_at; // 返回最新的过期时间
        return response.status(200).json({ 
            success: true, 
            message: `${isPermanent ? '永久' : '试用'}密钥首次激活成功。`,
            data: successData
        });

    } catch (error) {
        console.error('密钥验证API出错:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}