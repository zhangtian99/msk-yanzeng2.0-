import { kv } from '@vercel/kv';

function checkAuth(password) { return password === process.env.ADMIN_PASSWORD; }

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
        const { quantity = 1, key_type = 'permanent', duration_days, password, anonymous_user_id } = request.body;
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
                newKey = generateRandomKey();
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
                activated_at: null
            };
            await kv.hset(`key:${newKey}`, newKeyData);
            added_count++;
        }
        
        // 如果是试用密钥激活，记录用户ID
        if (key_type === 'trial' && anonymous_user_id) {
            await kv.sadd('trial_users', anonymous_user_id);
        }

        return response.status(201).json({ success: true, added_count, generatedKeys });
    } catch (error) {
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}