import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        const { key } = request.body;
        
        if (!key) {
             return response.status(400).json({ success: false, message: '密钥格式无效' });
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
        
        // 获取配置链接 (用于成功响应)
        const config = await kv.hgetall('system_config');
        const shortcut_link = config?.SHORTCUT_ICLOUD_LINK || '';

        // 构造基础成功数据
        const successData = {
            shortcut_link: shortcut_link,
            key_type: keyData.key_type || 'permanent',
            expires_at: keyData.expires_at || null,
            // 添加状态，方便快捷指令判断是否需要保存到本地
            validation_status: keyData.validation_status
        };

        // 2. 检查密钥是否已被使用 (one-key-one-activation)
        if (keyData.validation_status === 'used') {
            // 【修正逻辑】：永久密钥或未过期的试用密钥，直接返回成功 (幂等查询)
            return response.status(200).json({ 
                success: true, 
                message: `${isPermanent ? '永久' : '试用'}密钥已激活且有效。`, 
                data: successData 
            });
        }
        
        // 3. 激活流程 (Key is valid and 'unused') - 首次激活
        const validationTime = new Date().toISOString();
        const updateData = {
            ...keyData,
            validation_status: 'used',
            web_validated_time: validationTime,
            activated_at: validationTime
        };
        
        await kv.hset(`key:${key}`, updateData);

        // 返回成功激活的响应
        successData.validation_status = 'used'; // 状态已更新
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