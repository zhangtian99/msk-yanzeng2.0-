import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        // 接收 key 和 user_id (user_id 可能是 null 或 undefined)
        const { key, user_id } = request.body; 
        
        if (!key) {
             return response.status(400).json({ success: false, message: '缺少密钥' });
        }
        
        const keyData = await kv.hgetall(`key:${key}`);
        if (!keyData) {
            return response.status(404).json({ success: false, message: '密钥无效或不存在' });
        }

        const isPermanent = keyData.key_type === 'permanent';

        // 1. 试用密钥到期后失效
        if (keyData.key_type === 'trial' && keyData.expires_at && new Date() > new Date(keyData.expires_at)) {
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
        
        // ==========================================================
        // --- 逻辑分支：如果传入了 user_id，执行严格的“一人一试”逻辑 ---
        // ==========================================================
        if (user_id) {
            // 2a. 严格验证 (用于快捷指令)：已激活的密钥
            if (keyData.validation_status === 'used') {
                 // 永久密钥直接通过，试用密钥必须 ID 匹配
                 if (isPermanent || keyData.user_id === user_id) {
                     return response.status(200).json({ 
                         success: true, 
                         message: `${isPermanent ? '永久' : '试用'}密钥已激活且有效。`, 
                         data: successData 
                     });
                 } else {
                     return response.status(409).json({ success: false, message: '此密钥已被其他设备使用。' });
                 }
            }

            // 2b. 严格验证 (用于快捷指令)：激活流程前的“一人一试”拦截
            if (!isPermanent) {
                const trialUsed = await kv.exists(`user:trial_used:${user_id}`);
                if (trialUsed) {
                    return response.status(409).json({ success: false, message: '您已使用过试用密钥，请购买永久密钥。' });
                }
            }
            
            // 2c. 严格激活 (带 user_id)
            const validationTime = new Date().toISOString();
            const updateData = {
                ...keyData, validation_status: 'used', web_validated_time: validationTime, activated_at: validationTime, user_id: user_id
            };
            const pipeline = kv.pipeline();
            pipeline.hset(`key:${key}`, updateData);
            if (!isPermanent) {
                pipeline.set(`user:trial_used:${user_id}`, 'true', { ex: 31536000 }); 
            }
            await pipeline.exec();
            
            successData.validation_status = 'used'; 
            successData.expires_at = updateData.expires_at;
            return response.status(200).json({ 
                success: true, 
                message: `${isPermanent ? '永久' : '试用'}密钥首次激活成功。`,
                data: successData
            });
        } 
        // ==========================================================
        // --- 逻辑分支：如果未传入 user_id，执行 Web 简单验证逻辑 ---
        // ==========================================================
        else {
            // 2. 检查密钥是否已被使用 (Web 简单模式)
            if (keyData.validation_status === 'used') {
                // 永久密钥已激活，直接返回成功
                if (isPermanent) {
                    return response.status(200).json({ 
                        success: true, 
                        message: '永久密钥已激活且有效。', 
                        data: successData 
                    });
                }
                // 试用密钥在 Web 简单模式下只能激活一次
                return response.status(409).json({ success: false, message: '此密钥已被使用。' });
            }

            // 3. 激活流程 (Key is valid and 'unused')
            const validationTime = new Date().toISOString();
            const updateData = {
                ...keyData,
                validation_status: 'used',
                web_validated_time: validationTime,
                activated_at: validationTime,
                // 不记录 user_id
            };

            await kv.hset(`key:${key}`, updateData);

            // 返回成功激活的响应
            successData.validation_status = 'used'; 
            return response.status(200).json({ 
                success: true, 
                message: `${isPermanent ? '永久' : '试用'}密钥首次激活成功。`,
                data: successData
            });
        }
        
    } catch (error) {
        console.error('密钥验证API出错:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}