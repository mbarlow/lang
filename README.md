# Language Learning Assistant

A web-based language learning tool that helps users practice English to Thai translation through voice recording and real-time transcription.

## Features

- Voice recording with spacebar control
- Real-time speech-to-text transcription using Whisper AI model
- English to Thai translation via Ollama API
- Text-to-speech playback for both languages
- Visual highlighting during Thai pronunciation
- Clean, modern UI with gradient background

## How to Use

1. **Press and hold SPACE** - Start recording your English speech
2. **Release SPACE** - Stop recording and process the audio
3. **Press SHIFT** - Replay the English audio followed by Thai translation

## Technical Stack

- **Frontend**: Vanilla JavaScript with ES6 modules
- **Speech Recognition**: Xenova Transformers.js with Whisper model
- **Translation**: Ollama API with Gemma3 model (requires local Ollama server)
- **Text-to-Speech**: Google Translate TTS with Web Speech API fallback
- **Deployment**: GitHub Pages

## Prerequisites

- Modern web browser with microphone access
- Ollama server running locally with Gemma3 model installed
- Internet connection for loading AI models and TTS services

## Local Development

Simply open `index.html` in a web browser or serve the files using any static file server.

## Deployment

The project is configured to automatically deploy to GitHub Pages on push to the main branch.