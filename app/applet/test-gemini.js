import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); 

async function run() {
    try {
        const response = await ai.models.generateImages({
            model: "imagen-3.0-generate-002",
            prompt: "a picture of a cute cat",
            config: {
                numberOfImages: 1,
                aspectRatio: "1:1",
                outputMimeType: "image/jpeg"
            }
        });
        console.log(response.generatedImages?.[0]?.image?.imageBytes ? "SUCCESS, got bytes" : "FAILED");
    } catch(err) {
        console.error(err);
    }
}
run();
