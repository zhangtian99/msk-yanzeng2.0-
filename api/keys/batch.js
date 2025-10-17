import { kv } from '@vercel/kv';

function checkAuth(password) { return password === process.env.ADMIN_PASSWORD; }

// 【核心修改点 A】：函数现在接收 keyType 参数
const generateRandomKey = (keyType) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomPart = '';
    // 生成6位随机部分
    for (let i = 0; i < 6; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    let key = 'MSK' + randomPart;
    
    // 【核心修改点 B】：试用密钥添加 'sy' 后缀
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
        // 【移除修改点 C】：移除 anonymous_user_id
        const { quantity = 1, key_type = 'permanent', duration_days, password } = request.body;
        
        if (!checkAuth(password)) {
            return response.status(401).json({ success: false, message: '未经授权' });
        }

        let added_count = 0;
        const generatedKeys = [];
        let expires_at = null;

        if (key_type === 'trial') {
            const duration = parseInt(duration_days, 10);
            if (isNaN(duration) || duration <= 0) {
                return response.status(400).json({ success: false, message: '试用密钥必须提供有效的持续天数' });
            }
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + duration);
            expires_at = expiryDate.toISOString();
        }

        for (let i = 0; i < quantity; i++) {
            let newKey, keyExists = true, attempts = 0;
            while(keyExists && attempts < 5) {
                // 【核心修改点 D】：调用时传入 key_type 参数
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
        
        // 【移除修改点 E】：移除试用密钥的用户ID记录逻辑

        return response.status(201).json({
            success: true,
            message: `成功生成并添加了 ${added_count} 个密钥`,
            generated_keys: generatedKeys,
            added_count: added_count
        });

    } catch (error) {
        console.error('批量生成密钥API出错:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}