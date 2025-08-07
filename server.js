// server.js

// Import các thư viện cần thiết
const express = require('express');
const fetch = require('node-fetch'); // Sử dụng node-fetch để gọi API
const path = require('path');
require('dotenv').config(); // Để đọc biến môi trường từ file .env

// Khởi tạo ứng dụng Express
const app = express();
const PORT = process.env.PORT || 3000; // Render sẽ tự cung cấp PORT

// Middleware để xử lý JSON và phục vụ các tệp tĩnh
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Phục vụ các tệp trong cùng thư mục

// Route chính để phục vụ file index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route API proxy để gọi đến Hugging Face với cơ chế luân chuyển key và ghi log JSON
app.post('/api/generate-image', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        const logData = { level: "warn", message: "Request received without a prompt." };
        console.warn(JSON.stringify(logData));
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // 1. Vẫn lấy danh sách key của Hugging Face
    const apiKeysString = process.env.HUGGINGFACE_API_KEYS;

    if (!apiKeysString) {
        const logData = {
            level: "error",
            message: "HUGGINGFACE_API_KEYS not found in environment variables."
        };
        console.error(JSON.stringify(logData));
        return res.status(500).json({ error: 'API keys are not configured on the server.' });
    }

    const apiKeys = apiKeysString.split(',').map(key => key.trim());

    // 2. Vẫn giữ URL mô hình của Hugging Face
    const modelUrl = 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0';

    // 3. Vòng lặp luân chuyển key
    for (const apiKey of apiKeys) {
        const keyIdentifier = `...${apiKey.slice(-4)}`; // Dùng để nhận diện key trong log
        try {
            // Ghi log khi bắt đầu thử một key
            console.log(JSON.stringify({
                level: "info",
                message: "Trying Hugging Face key",
                key: keyIdentifier
            }));

            // 4. Vẫn gọi API Hugging Face với cấu trúc body và header của họ
            const response = await fetch(modelUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({ inputs: prompt }),
            });

            // 5. Xử lý phản hồi thành công từ Hugging Face
            if (response.ok) {
                console.log(JSON.stringify({
                    level: "info",
                    message: "Image generation successful with Hugging Face",
                    key: keyIdentifier
                }));
                
                // Vẫn xử lý ảnh nhị phân trả về từ Hugging Face 
                const imageBuffer = await response.buffer(); [cite: 32]
                const imageBase64 = imageBuffer.toString('base64'); [cite: 33]

                // Chuyển về định dạng client mong đợi
                const clientResponse = {
                    artifacts: [{ base64: imageBase64 }]
                }; [cite: 34]
                return res.json(clientResponse);
            }

            // 6. Xử lý các lỗi phổ biến và ghi log JSON
            if (response.status === 401) {
                console.warn(JSON.stringify({
                    level: "warn",
                    message: "Hugging Face key failed (Unauthorized). Trying next key.",
                    key: keyIdentifier,
                    statusCode: 401
                }));
                continue; // Thử key tiếp theo
            }
            if (response.status === 503) {
                console.warn(JSON.stringify({
                    level: "warn",
                    message: "Hugging Face model is loading (503). Trying next key.",
                    key: keyIdentifier,
                    statusCode: 503
                }));
                continue; // Thử key tiếp theo
            }
            
            // Xử lý các lỗi khác
            const errorResult = await response.json(); [cite: 38]
            throw new Error(errorResult.error || 'Unknown error from Hugging Face'); [cite: 38]

        } catch (error) {
            // Ghi log JSON cho các lỗi bắt được
            console.error(JSON.stringify({
                level: "error",
                message: "Error with Hugging Face key",
                key: keyIdentifier,
                details: error.message
            }));
        }
    }

    // Nếu tất cả các key đều thất bại
    console.error(JSON.stringify({
        level: "error",
        message: "All Hugging Face API keys failed. Unable to generate image."
    }));
    res.status(500).json({ error: 'Failed to generate image. All available API keys failed.' }); [cite: 41]
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
