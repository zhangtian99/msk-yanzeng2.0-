import { kv } from '@vercel/kv';

// 统一的身份验证函数
function checkAuth(password) {
    return password === process.env.ADMIN_PASSWORD;
}

export default async function handler(request, response) {
    
    // --- 处理 GET 请求：获取所有密钥列表 ---
    if (request.method === 'GET') {
        const { password } = request.query;
        if (!checkAuth(password)) {
            return response.status(401).json({ success: false, message: '未经授权' });
        }
        
        try {
            const keys = await kv.keys('key:*');
            if (keys.length === 0) {
                return response.status(200).json({ success: true, data: [] });
            }

            const pipeline = kv.pipeline();
            keys.forEach(key => pipeline.hgetall(key));
            const allKeyData = await pipeline.exec();
            
            // 过滤掉可能为空的数据并按创建时间降序排序
            const sortedKeys = allKeyData
                .filter(Boolean)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            return response.status(200).json({ success: true, data: sortedKeys });

        } catch (error) {
            console.error('API Error in GET /api/keys:', error);
            return response.status(500).json({ success: false, message: '服务器内部错误' });
        }
    }

    // --- 处理 POST 请求：添加单个密钥 ---
    // (注意：此功能当前未在简化版UI中使用，但保留API以备将来之需)
    if (request.method === 'POST') {
        const { key_value, password } = request.body;
        if (!checkAuth(password)) {
            return response.status(401).json({ success: false, message: '未经授权' });
        }
        
        try {
            if (!key_value || typeof key_value !== 'string' || !/^[A-Za-z0-9]+$/.test(key_value) || key_value.length > 64) {
                return response.status(400).json({ success: false, message: '密钥格式无效' });
            }

            const keyExists = await kv.exists(`key:${key_value}`);
            if (keyExists) {
                return response.status(409).json({ success: false, message: '密钥已存在' });
            }
            
            const newKeyData = {
                key_value: key_value,
                validation_status: 'unused',
                created_at: new Date().toISOString(),
                web_validated_time: null,
                shortcut_configured_time: null
            };

            await kv.hset(`key:${key_value}`, newKeyData);

            return response.status(201).json({ success: true, data: newKeyData });

        } catch (error) {
            console.error('API Error in POST /api/keys:', error);
            return response.status(500).json({ success: false, message: '服务器内部错误' });
        }
    }
    
    // --- 新增：处理 DELETE 请求，用于删除单个密钥 ---
    if (request.method === 'DELETE') {
        const { key_value, password } = request.body;
        if (!checkAuth(password)) {
            return response.status(401).json({ success: false, message: '未经授权' });
        }
        try {
            if (!key_value) {
                return response.status(400).json({ success: false, message: '未提供要删除的密钥' });
            }
            await kv.del(`key:${key_value}`);
            return response.status(200).json({ success: true, message: '密钥已成功删除' });
        } catch (error) {
            console.error('API Error in DELETE /api/keys:', error);
            return response.status(500).json({ success: false, message: '删除密钥时发生服务器错误' });
        }
    }
    
    // 如果不是以上任何一种请求方法，则返回错误
    return response.status(405).json({ success: false, message: `不支持的请求方法: ${request.method}` });
}