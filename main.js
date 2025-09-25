import {
    pipeline,
    env,
} from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

// Configure Transformers.js for web environment
env.allowRemoteModels = true;
env.allowLocalModels = false;

class LanguageLearner {
    constructor() {
        this.whisper = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.currentAudioBlob = null;
        this.currentEnglish = "";
        this.currentThai = "";
        this.isProcessing = false;
        this.synthUtterance = null;

        this.statusEl = document.getElementById("status");
        this.englishEl = document.getElementById("englishText");
        this.thaiEl = document.getElementById("thaiText");
        this.loadingEl = document.getElementById("loadingOverlay");

        this.init();
    }

    async init() {
        try {
            await this.loadWhisper();
            await this.setupAudio();
            this.setupEventListeners();
            this.loadingEl.style.display = "none";
            this.updateStatus(
                "Press SPACE to start recording",
                "ready",
            );
        } catch (error) {
            console.error("Initialization error:", error);
            this.showError(
                "Failed to initialize. Please refresh and try again.",
            );
        }
    }

    async loadWhisper() {
        try {
            this.whisper = await pipeline(
                "automatic-speech-recognition",
                "Xenova/whisper-tiny",
                {
                    progress_callback: (progress) => {
                        if (progress.status === "progress") {
                            const percent = Math.round(
                                (progress.loaded / progress.total) *
                                    100,
                            );
                            document
                                .getElementById("loadingOverlay")
                                .querySelector(
                                    "div:last-child",
                                ).textContent =
                                `Loading Whisper model... ${percent}%`;
                        }
                    },
                },
            );
        } catch (error) {
            console.error("Failed to load Whisper:", error);
            throw error;
        }
    }

    async setupAudio() {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
            },
        });

        this.mediaRecorder = new MediaRecorder(stream, {
            mimeType: "audio/webm;codecs=opus",
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = async () => {
            this.currentAudioBlob = new Blob(this.audioChunks, {
                type: "audio/webm",
            });
            this.audioChunks = [];
            await this.processAudio();
        };
    }

    setupEventListeners() {
        document.addEventListener("keydown", (e) => {
            if (e.code === "Space" && !this.isProcessing) {
                e.preventDefault();
                this.startRecording();
            } else if (
                e.code === "ShiftLeft" ||
                e.code === "ShiftRight"
            ) {
                e.preventDefault();
                if (
                    this.currentEnglish &&
                    this.currentThai &&
                    !this.isProcessing
                ) {
                    this.playbackCycle();
                }
            }
        });

        document.addEventListener("keyup", (e) => {
            if (e.code === "Space" && this.isRecording) {
                e.preventDefault();
                this.stopRecording();
            }
        });
    }

    startRecording() {
        if (this.isRecording || this.isProcessing) return;

        this.isRecording = true;
        this.audioChunks = [];
        this.mediaRecorder.start();
        this.updateStatus(
            "🎤 Recording... (release SPACE to stop)",
            "recording",
        );
        this.reset();
    }

    stopRecording() {
        if (!this.isRecording) return;

        this.isRecording = false;
        this.mediaRecorder.stop();
        this.updateStatus("Processing...", "processing");
        this.isProcessing = true;
    }

    async processAudio() {
        try {
            // Convert blob to audio buffer for Whisper
            const arrayBuffer =
                await this.currentAudioBlob.arrayBuffer();
            const audioContext = new AudioContext({
                sampleRate: 16000,
            });
            const audioBuffer =
                await audioContext.decodeAudioData(arrayBuffer);

            // Convert to the format Whisper expects
            const audioArray = audioBuffer.getChannelData(0);

            // Transcribe with Whisper
            const result = await this.whisper(audioArray, {
                chunk_length_s: 30,
                stride_length_s: 5,
                language: "english",
                task: "transcribe",
            });

            this.currentEnglish = result.text.trim();

            if (!this.currentEnglish) {
                throw new Error("No speech detected");
            }

            // Display English text
            this.displayEnglish();

            // Translate to Thai
            await this.translateToThai();

            // Start playback cycle
            await this.playbackCycle();
        } catch (error) {
            console.error("Processing error:", error);
            this.showError(
                "Failed to process audio. Please try again.",
            );
        } finally {
            this.isProcessing = false;
            this.updateStatus(
                "Press SPACE to start recording",
                "ready",
            );
        }
    }

    async translateToThai() {
        try {
            const response = await fetch(
                "http://localhost:11434/api/generate",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: "gemma3",
                        prompt: `Translate this English text to Thai. Respond with ONLY the Thai translation, no explanation: "${this.currentEnglish}"`,
                        stream: false,
                    }),
                },
            );

            if (!response.ok) {
                throw new Error(
                    `Ollama request failed: ${response.status}`,
                );
            }

            const data = await response.json();
            this.currentThai = data.response.trim();

            // Display Thai text
            this.displayThai();
        } catch (error) {
            console.error("Translation error:", error);
            this.currentThai = "Translation failed";
            this.displayThai();
        }
    }

    displayEnglish() {
        this.englishEl.textContent = this.currentEnglish;
        this.englishEl.classList.add("visible");
    }

    displayThai() {
        // Split Thai text into words and wrap each in a span
        const words = this.currentThai.split(/(\s+)/);
        this.thaiEl.innerHTML = words
            .map((word, index) => {
                if (word.trim()) {
                    return `<span class="thai-word" data-index="${index}">${word}</span>`;
                }
                return word;
            })
            .join("");

        this.thaiEl.classList.add("visible");
    }

    async playbackCycle() {
        try {
            // Play original English audio
            await this.playAudio(this.currentAudioBlob);

            // Wait a moment
            await this.sleep(500);

            // Speak Thai with highlighting
            await this.speakThaiWithHighlighting();
        } catch (error) {
            console.error("Playback error:", error);
        }
    }

    playAudio(blob) {
        return new Promise((resolve) => {
            const audio = new Audio(URL.createObjectURL(blob));
            audio.onended = resolve;
            audio.onerror = resolve;
            audio.play();
        });
    }

    speakThaiWithHighlighting() {
        return new Promise((resolve) => {
            if (
                !this.currentThai ||
                this.currentThai === "Translation failed"
            ) {
                resolve();
                return;
            }

            // Split text into chunks if needed (Google TTS has ~200 char limit)
            const chunks = this.splitTextIntoChunks(
                this.currentThai,
                200,
            );
            const words =
                this.thaiEl.querySelectorAll(".thai-word");

            // Play chunks sequentially
            let chunkIndex = 0;

            const playNextChunk = () => {
                if (chunkIndex >= chunks.length) {
                    // Remove all highlighting when done
                    words.forEach((word) =>
                        word.classList.remove("highlighted"),
                    );
                    resolve();
                    return;
                }

                const chunk = chunks[chunkIndex];
                const audio = new Audio(
                    `https://translate.google.com/translate_tts?ie=UTF-8&tl=th&client=tw-ob&q=${encodeURIComponent(chunk)}`,
                );

                // Slow down the Thai speech to half speed
                audio.playbackRate = 0.5;

                // Highlight words for current chunk
                const chunkWords = chunk.split(/\s+/);
                let wordStartIndex = 0;
                for (let i = 0; i < chunkIndex; i++) {
                    wordStartIndex += chunks[i].split(/\s+/).length;
                }

                // Simple highlighting: highlight all words in current chunk
                audio.onplay = () => {
                    words.forEach((word, index) => {
                        if (
                            index >= wordStartIndex &&
                            index <
                                wordStartIndex + chunkWords.length
                        ) {
                            word.classList.add("highlighted");
                        } else {
                            word.classList.remove("highlighted");
                        }
                    });
                };

                audio.onended = () => {
                    chunkIndex++;
                    playNextChunk();
                };

                audio.onerror = (error) => {
                    console.error("Google TTS error:", error);
                    // Fallback to browser TTS if Google TTS fails
                    this.fallbackToWebSpeech(this.currentThai).then(
                        resolve,
                    );
                };

                audio.play().catch((error) => {
                    console.error(
                        "Failed to play Google TTS:",
                        error,
                    );
                    // Fallback to browser TTS
                    this.fallbackToWebSpeech(this.currentThai).then(
                        resolve,
                    );
                });
            };

            playNextChunk();
        });
    }

    splitTextIntoChunks(text, maxLength) {
        if (text.length <= maxLength) return [text];

        const chunks = [];
        const words = text.split(/\s+/);
        let currentChunk = "";

        for (const word of words) {
            if (
                (currentChunk + " " + word).length > maxLength &&
                currentChunk
            ) {
                chunks.push(currentChunk.trim());
                currentChunk = word;
            } else {
                currentChunk = currentChunk
                    ? currentChunk + " " + word
                    : word;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    fallbackToWebSpeech(text) {
        return new Promise((resolve) => {
            console.log("Falling back to Web Speech API");
            speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            const voices = speechSynthesis.getVoices();
            const thaiVoice = voices.find((voice) =>
                voice.lang.includes("th"),
            );
            if (thaiVoice) {
                utterance.voice = thaiVoice;
            }

            utterance.rate = 0.5;
            utterance.onend = resolve;
            utterance.onerror = resolve;

            speechSynthesis.speak(utterance);
        });
    }

    reset() {
        this.englishEl.classList.remove("visible");
        this.thaiEl.classList.remove("visible");
        this.englishEl.textContent = "";
        this.thaiEl.innerHTML = "";
        this.currentEnglish = "";
        this.currentThai = "";

        // Cancel any ongoing speech
        speechSynthesis.cancel();
    }

    updateStatus(message, type = "") {
        this.statusEl.textContent = message;
        this.statusEl.className = `status ${type}`;
    }

    showError(message) {
        this.updateStatus(`❌ ${message}`, "error");
        setTimeout(() => {
            this.updateStatus(
                "Press SPACE to start recording",
                "ready",
            );
        }, 3000);
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

// Initialize the app
new LanguageLearner();