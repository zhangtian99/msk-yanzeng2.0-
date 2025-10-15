import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, status: 'error', message: '仅允许POST请求' });
    }
    try {
        const { key } = request.body;
        if (!key) {
             return response.status(400).json({ success: false, status: 'invalid_input', message: '未提供有效密钥' });
        }

        const keyData = await kv.hgetall(`key:${key}`);
        if (!keyData) {
            return response.status(404).json({ success: false, status: 'not_found', message: '密钥不存在' });
        }
        
        if (keyData.key_type === 'permanent') {
            return response.status(200).json({ success: true, status: 'permanent', message: '密钥永久有效' });
        }

        if (keyData.key_type === 'trial') {
            if (keyData.expires_at && new Date() > new Date(keyData.expires_at)) {
                return response.status(200).json({ success: false, status: 'trial_expired', message: '试用密钥已过期' });
            } else {
                return response.status(200).json({ success: true, status: 'trial_active', message: '试用密钥有效' });
            }
        }
        
        return response.status(200).json({ success: true, status: 'legacy', message: '密钥有效' });

    } catch (error) {
        return response.status(500).json({ success: false, status: 'server_error', message: '服务器内部错误' });
    }
}