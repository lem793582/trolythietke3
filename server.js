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

// Route API proxy để gọi đến Hugging Face một cách an toàn
app.post('/api/generate-image', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // --- THAY ĐỔI 1: SỬ DỤNG HUGGINGFACE_API_KEYS ---
    // Lấy danh sách API key của Hugging Face từ biến môi trường.
    const apiKeysString = process.env.HUGGINGFACE_API_KEYS;

    if (!apiKeysString) {
        console.error('HUGGINGFACE_API_KEYS not found in environment variables.');
        return res.status(500).json({ error: 'Hugging Face API keys are not configured on the server.' });
    }

    const apiKeys = apiKeysString.split(',').map(key => key.trim());

    // --- THAY ĐỔI 2: ĐỊNH NGHĨA URL CỦA HUGGING FACE MODEL ---
    const modelUrl = 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0';

    // Vòng lặp để thử từng key
    for (const apiKey of apiKeys) {
        console.log(`Trying Hugging Face API key ending with ...${apiKey.slice(-4)}`);
        try {
            // --- THAY ĐỔI 3: GỌI ĐẾN API CỦA HUGGING FACE ---
            const response = await fetch(modelUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`, // Dùng key của Hugging Face
                },
                body: JSON.stringify({ inputs: prompt }), // Cấu trúc body cho Hugging Face
            });

            // Nếu key hợp lệ và yêu cầu thành công
            if (response.ok) {
                console.log(`Success with Hugging Face API key ...${apiKey.slice(-4)}`);
                
                // Hugging Face trả về dữ liệu nhị phân của ảnh trực tiếp
                const imageBuffer = await response.buffer();
                const imageBase64 = imageBuffer.toString('base64');

                // Chuyển đổi về định dạng mà client-side đang mong đợi
                const clientResponse = {
                    artifacts: [{
                        base64: imageBase64
                    }]
                };
                return res.json(clientResponse);
            }

            // Xử lý các lỗi phổ biến từ Hugging Face
            if (response.status === 401) {
                console.warn(`Hugging Face API key ...${apiKey.slice(-4)} failed (Unauthorized). Trying next key.`);
                continue;
            }
            if (response.status === 503) {
                 console.warn(`Hugging Face model is loading (503). Trying next key or wait...`);
                 continue; // Model đang tải, thử key tiếp theo
            }
            
            const errorResult = await response.json();
            throw new Error(`Non-recoverable response from Hugging Face: ${response.status} - ${errorResult.error}`);

        } catch (error) {
            console.error(`Error with Hugging Face API key ...${apiKey.slice(-4)}:`, error.message);
        }
    }

    // Nếu vòng lặp kết thúc mà không có key nào thành công
    console.error('All Hugging Face API keys failed.');
    res.status(500).json({ error: 'Failed to generate image. All available Hugging Face API keys failed.' });
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
