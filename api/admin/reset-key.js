import { kv } from '@vercel/kv';

// 身份验证函数
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

        // --- 优化点 ---
        // 先获取现有数据，再更新特定字段，而不是覆盖整个记录
        const existingData = await kv.hgetall(keyName);

        // 更新密钥状态
        await kv.hset(keyName, {
            ...existingData, // 保留所有旧数据
            validation_status: 'unused', // 只更新状态
            web_validated_time: null, // 清空激活时间
        });

        return response.status(200).json({ success: true, message: `密钥 ${key_value} 已成功重置` });

    } catch (error) {
        console.error('重置密钥API出错:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}