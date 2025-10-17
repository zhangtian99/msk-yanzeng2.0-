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
        // 确保只检查试用密钥
        if (!key.endsWith('sy')) {
             return response.status(400).json({ success: false, message: '此接口仅用于试用密钥检查' });
        }

        const keyData = await kv.hgetall(`key:${key}`);
        if (!keyData) {
            return response.status(404).json({ success: false, message: '密钥不存在或无效' });
        }
        
        // 必须是已激活的试用密钥
        if (keyData.key_type !== 'trial' || keyData.validation_status !== 'used') {
             return response.status(409).json({ success: false, message: '密钥状态异常，请重新激活' });
        }

        // 核心检查：是否过期
        if (keyData.expires_at && new Date() > new Date(keyData.expires_at)) {
            return response.status(403).json({ success: false, message: '试用密钥已过期，请购买永久密钥。' });
        }
        
        // 验证成功，返回配置链接
        const config = await kv.hgetall('system_config');
        
        return response.status(200).json({ 
            success: true, 
            message: '试用密钥有效。', 
            data: { shortcut_link: config?.SHORTCUT_ICLOUD_LINK || '' }
        });

    } catch (error) {
        console.error('试用密钥快速检查API出错:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}