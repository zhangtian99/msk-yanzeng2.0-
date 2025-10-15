import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: '仅允许POST请求' });
    }

    try {
        const { key } = request.body;

        if (!key || typeof key !== 'string' || key.trim() === '') {
             return response.status(400).json({ code: 'INVALID_INPUT', message: '密钥验证失败，未提供有效密钥！！！' });
        }

        const keyExists = await kv.exists(`key:${key}`);

        if (keyExists) {
            // 遵照您的要求，当验证成功时，message 的值将改为“密钥验证成功，已激活！！！” 
            return response.status(200).json({ code: 'ACTIVATION_SUCCESS', message: '密钥验证成功，已激活！！！' });
        } else {
            // 失败时的消息也相应地调整 
            return response.status(404).json({ code: 'KEY_NOT_FOUND', message: '密钥验证失败，密钥不存在！！！' });
        }

    } catch (error) {
        if (error instanceof SyntaxError) {
            return response.status(400).json({ code: 'INVALID_JSON', message: '无效的JSON格式' });
        }
        console.error('检查密钥是否存在API出错:', error);
        return response.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: '密钥验证失败，服务器错误！！！' });
    }
}