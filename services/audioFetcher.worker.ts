
// Audio Fetcher Worker
// Handles downloading audio files as ArrayBuffers to keep the main thread free.

self.onmessage = async (e: MessageEvent) => {
    const { url, id } = e.data;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        // Transfer the ArrayBuffer to main thread
        self.postMessage({ id, buffer: arrayBuffer, success: true }, { transfer: [arrayBuffer] });

    } catch (error: any) {
        self.postMessage({ id, error: error.message, success: false });
    }
};
