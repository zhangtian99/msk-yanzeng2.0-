import { kv } from '@vercel/kv';

function checkAuth(password) { return password === process.env.ADMIN_PASSWORD; }

// 生成随机密钥的函数
const generateRandomKey = (keyType) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomPart = '';
    // 生成6位随机部分
    for (let i = 0; i < 6; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    let key = 'MSK' + randomPart;
    
    // 试用密钥添加 'sy' 后缀
    if (keyType === 'trial') {
        key += 'sy';
    }
    return key;
};

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        // 【修正点 A】：确保只获取需要的字段，移除了 anonymous_user_id
        const { quantity = 1, key_type = 'permanent', duration_days, password } = request.body;
        
        if (!checkAuth(password)) {
            return response.status(401).json({ success: false, message: '未经授权' });
        }

        let added_count = 0;
        const generatedKeys = [];
        let expires_at = null;

        // 处理试用密钥的过期时间计算
        if (key_type === 'trial') {
            const duration = parseInt(duration_days, 10);
            if (isNaN(duration) || duration <= 0) {
                return response.status(400).json({ success: false, message: '试用密钥必须提供有效的持续天数' });
            }
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + duration);
            expires_at = expiryDate.toISOString();
        }

        // 批量生成密钥的主循环
        for (let i = 0; i < quantity; i++) {
            let newKey, keyExists = true, attempts = 0;
            while(keyExists && attempts < 5) {
                // 调用时传入 key_type 参数
                newKey = generateRandomKey(key_type); 
                keyExists = await kv.exists(`key:${newKey}`);
                attempts++;
            }
            if (keyExists) continue;
            
            generatedKeys.push(newKey);
            const newKeyData = {
                key_value: newKey,
                validation_status: 'unused',
                created_at: new Date().toISOString(),
                key_type: key_type,
                expires_at: expires_at,
                activated_at: null,
            };
            await kv.hset(`key:${newKey}`, newKeyData);
            added_count++;
        }
        
        // 【修正点 B】：彻底移除原代码中关于 anonymous_user_id 或 trial_users 的逻辑
        
        // 成功返回
        return response.status(201).json({
            success: true,
            message: `成功生成并添加了 ${added_count} 个密钥`,
            generated_keys: generatedKeys,
            added_count: added_count
        });

    } catch (error) {
        // 捕获所有其他意外错误
        console.error('批量生成密钥API出错:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}