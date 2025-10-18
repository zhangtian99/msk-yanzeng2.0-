import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        // user_id 存在与否用于区分 Web/Shortcut
        const { key, user_id } = request.body; 
        
        if (!key) {
             return response.status(400).json({ success: false, message: '缺少密钥' });
        }
        
        const keyData = await kv.hgetall(`key:${key}`);
        if (!keyData) {
            return response.status(404).json({ success: false, message: '密钥无效或不存在' });
        }

        const isPermanent = keyData.key_type === 'permanent';

        // 1. 试用密钥到期后失效 (无论 Web 还是 Shortcut 都要检查)
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
            validation_status: keyData.validation_status,
            user_id: keyData.user_id || null // 返回已关联的 user_id
        };
        
        // ==========================================================
        // --- 逻辑分支 1：如果传入了 user_id (来自快捷指令) ---
        // ==========================================================
        if (user_id) {
            
            // 2. Shortcut 验证/关联流程
            
            // 2a. 检查是否已被 Web 激活 (必须是 USED 状态)
            if (keyData.validation_status !== 'used') {
                return response.status(401).json({ success: false, message: '密钥未激活，请先在Web页面完成首次验证。' });
            }
            
            // 2b. 密钥是 USED 状态，检查 user_id 关联
            if (keyData.user_id) {
                // 如果已关联 ID，则检查 ID 是否匹配 (防盗用/严格一人一试)
                if (keyData.user_id !== user_id) {
                    // 如果密钥已被他人关联，且是试用密钥（防盗用）
                    if (!isPermanent) {
                        return response.status(409).json({ success: false, message: '此密钥已被其他设备使用。' });
                    }
                }
            } else if (!isPermanent) {
                // 2c. 试用密钥首次关联 ID (Web 激活后第一次被 Shortcut 使用)
                
                // 【一人一试】检查：检查此 user_id 是否已经激活过任何试用密钥
                const trialUsed = await kv.exists(`user:trial_used:${user_id}`);
                if (trialUsed) {
                    return response.status(409).json({ success: false, message: '您已使用过试用密钥，请购买永久密钥。' });
                }
                
                // 写入 user_id 和一人一试标记
                const pipeline = kv.pipeline();
                pipeline.hset(`key:${key}`, { ...keyData, user_id: user_id });
                pipeline.set(`user:trial_used:${user_id}`, 'true', { ex: 31536000 }); 
                await pipeline.exec();
                
                successData.user_id = user_id;
            }

            // 验证通过 (已激活，未过期，ID 匹配/新关联)
            return response.status(200).json({ 
                success: true, 
                message: `${isPermanent ? '永久' : '试用'}密钥有效。`, 
                data: successData 
            });

        } 
        // ==========================================================
        // --- 逻辑分支 2：如果未传入 user_id (来自 Web 页面，执行激活) ---
        // ==========================================================
        else {
            // 2. Web 激活流程
            
            if (keyData.validation_status === 'used') {
                // 永久密钥已激活，直接返回成功
                if (isPermanent) {
                    return response.status(200).json({ success: true, message: '永久密钥已激活且有效。', data: successData });
                }
                // 试用密钥在 Web 简单模式下只能激活一次
                return response.status(409).json({ success: false, message: '此密钥已被使用。' });
            }

            // 【激活流程】：Web 端执行状态修改 (unused -> used)
            const validationTime = new Date().toISOString();
            const updateData = {
                ...keyData,
                validation_status: 'used',
                web_validated_time: validationTime,
                activated_at: validationTime,
                // 注意：Web 激活时不记录 user_id
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