import express from 'express';
import multer from 'multer';
import { Client, handle_file } from '@gradio/client';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Define the Gradio URLs
const GRADIO_URLS = {
    speech2sign: "https://adelshousha-sahla-speech2sign.hf.space",
    sign2speech: "https://adelshousha-sahla-sign2speech.hf.space", 
};

// Store the initialized Gradio clients
const gradioClients = {};

// Function to initialize all Gradio clients
async function initGradioClients() {
    for (const [key, url] of Object.entries(GRADIO_URLS)) {
        try {
            gradioClients[key] = await Client.connect(url);
            console.log(`Gradio client for ${key} initialized successfully`);
        } catch (error) {
            console.error(`Failed to initialize Gradio client for ${key}:`, error);
        }
    }
}

initGradioClients();

// Middleware to check if a Gradio client is initialized and direct the request to the correct client
function checkGradioClient(key) {
    return (req, res, next) => {
        if (!gradioClients[key]) {
            return res.status(500).json({ error: `Gradio client for ${key} not initialized` });
        }
        req.gradioClient = gradioClients[key];
        next();
    };
}

// Endpoint for transcribing audio
app.post('/transcribe', upload.single('audio'), checkGradioClient('speech2sign'), async (req, res) => {
    try {
        if (!req.file) throw new Error('No audio file provided');

        const audioBlob = new Blob([req.file.buffer], { type: 'audio/wav' });
        const result = await req.gradioClient.predict("/predict", [handle_file(audioBlob)]);

        const [text, audio, video] = result.data;

        res.json({ result: { text, audio: audio.url, video: video.video.url } });
    } catch (error) {
        console.error('Transcription error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint for processing video
app.post('/process-video', upload.single('video'), checkGradioClient('sign2speech'), async (req, res) => {
    try {
        if (!req.file) throw new Error('No video file provided');

        const videoBlob = new Blob([req.file.buffer], { type: 'video/mp4' });
        const result = await req.gradioClient.predict("/predict", {
            input_video_path: { video: handle_file(videoBlob) }
        });
        const [text, audio, video] = result.data;

        res.json({ result: { text, audio: audio.url, video: video.video.url } });
    } catch (error) {
        console.error('Video processing error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
