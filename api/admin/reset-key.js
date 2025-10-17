import { kv } from '@vercel/kv';

function checkAuth(password) {
    return password === process.env.ADMIN_PASSWORD;
}

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }

    try {
        const { key_value, password } = request.body;

        if (!checkAuth(password)) {
            return response.status(401).json({ success: false, message: '未经授权' });
        }

        if (!key_value) {
            return response.status(400).json({ success: false, message: '缺少密钥值' });
        }

        const keyName = `key:${key_value}`;
        const keyExists = await kv.exists(keyName);
        if (!keyExists) {
            return response.status(404).json({ success: false, message: '密钥不存在' });
        }

        const existingData = await kv.hgetall(keyName);

        // 更新密钥状态 (移除 ID 清理逻辑)
        await kv.hset(keyName, {
            ...existingData, 
            validation_status: 'unused', 
            web_validated_time: null,
            activated_at: null,
        });

        return response.status(200).json({ success: true, message: `密钥 ${key_value} 已成功重置为未使用状态` });
    } catch (error) {
        console.error('密钥重置API出错:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}