import { kv } from '@vercel/kv';

// 身份验证函数
function checkAuth(password) {
    return password === process.env.ADMIN_PASSWORD;
}

// 随机密钥生成函数
const generateRandomKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'MSK' + randomPart;
};

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        const { password } = request.body;
        if (!checkAuth(password)) {
            return response.status(401).json({ success: false, message: '未经授权' });
        }

        const quantity = 10; // 固定生成10个
        let added_count = 0;
        const generatedKeys = [];

        // 循环生成10个密钥
        for (let i = 0; i < quantity; i++) {
            let newKey, keyExists = true, attempts = 0;
            // 为防止极小概率的重复，尝试最多5次
            while(keyExists && attempts < 5) {
                newKey = generateRandomKey();
                keyExists = await kv.exists(`key:${newKey}`);
                attempts++;
            }
            
            // 如果5次后仍然重复，则跳过
            if (keyExists) {
                continue;
            }
            
            generatedKeys.push(newKey);
            const newKeyData = {
                key_value: newKey,
                validation_status: 'unused',
                created_at: new Date().toISOString(),
                web_validated_time: null,
                shortcut_configured_time: null
            };
            // 存入数据库
            await kv.hset(`key:${newKey}`, newKeyData);
            added_count++;
        }

        return response.status(201).json({ success: true, added_count, generatedKeys });

    } catch (error) {
        console.error('API Error in /api/keys/batch:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}