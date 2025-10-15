import { kv } from '@vercel/kv';

function checkAuth(password) {
    return password === process.env.ADMIN_PASSWORD;
}

export default async function handler(request, response) {
    const { password } = request.query;
    if (!checkAuth(password)) {
        return response.status(401).json({ success: false, message: '未经授权' });
    }

    if (request.method === 'GET') {
        try {
            // 1. 获取所有key:*格式的键名
            const keys = await kv.keys('key:*');
            if (keys.length === 0) {
                return response.status(200).json({ success: true, data: { totalKeys: 0, usedKeys: 0 } });
            }

            // 2. 使用pipeline批量获取所有密钥的详细数据
            const pipeline = kv.pipeline();
            keys.forEach(key => pipeline.hgetall(key));
            const allKeyData = await pipeline.exec();
            
            // ======================================================
            // --- 修正点：修复了统计已激活密钥的逻辑 ---
            // ======================================================
            // 3. 过滤并计算已激活(used)的密钥数量
            const usedKeysCount = allKeyData.filter(keyData => {
                // 确保keyData存在并且它的validation_status属性为'used'
                return keyData && keyData.validation_status === 'used';
            }).length;
            
            const stats = {
                totalKeys: keys.length,
                usedKeys: usedKeysCount,
            };

            return response.status(200).json({ success: true, data: stats });

        } catch (error) {
            console.error('获取统计数据API出错:', error);
            return response.status(500).json({ success: false, message: '服务器内部错误' });
        }
    }
    
    return response.status(405).json({ success: false, message: '仅允许GET请求' });
}