import { GoogleGenAI, Type } from "@google/genai";
import { AiAnalysisResult } from "../types";

// Helper to convert AudioBuffer to WAV Base64
function audioBufferToWavBase64(buffer: AudioBuffer): string {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this example)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true); // write 16-bit sample
      offset += 2;
    }
    pos++;
  }

  // Helper functions
  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  let binary = '';
  const bytes = new Uint8Array(bufferArr);
  const len = bytes.byteLength;
  for (let j = 0; j < len; j++) {
    binary += String.fromCharCode(bytes[j]);
  }
  return window.btoa(binary);
}

export const analyzeTrackWithGemini = async (audioBuffer: AudioBuffer, apiKey?: string): Promise<AiAnalysisResult> => {
  const key = apiKey;
  
  if (!key) {
    throw new Error("API Key is missing. Please enter a key in the input field.");
  }

  // Create a shorter snippet (max 30 seconds) to avoid huge payloads/latency
  const durationToAnalyze = Math.min(audioBuffer.duration, 30);
  const sampleRate = audioBuffer.sampleRate;
  const frameCount = durationToAnalyze * sampleRate;
  
  const offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, frameCount, sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  
  // Render the snippet
  const snippetBuffer = await offlineCtx.startRendering();
  
  // Convert to Base64 WAV
  const base64Audio = audioBufferToWavBase64(snippetBuffer);

  const ai = new GoogleGenAI({ apiKey: key });
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'audio/wav',
            data: base64Audio
          }
        },
        {
          text: "Analyze this audio snippet. Provide the musical Genre, the Mood/Vibe, the Musical Key (e.g., C Minor), and a brief 1-sentence description."
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          genre: { type: Type.STRING },
          mood: { type: Type.STRING },
          key: { type: Type.STRING },
          musicalDescription: { type: Type.STRING }
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as AiAnalysisResult;
};