import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

// Shared helper for user-uploaded audio (adhan sounds, custom Quran recitations).
// Files are too big for localStorage, so the bytes go to app-private storage
// (Directory.Data) via @capacitor/filesystem; only the returned relative path is what
// gets persisted in localStorage alongside the item's metadata.

const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Strip the "data:<mime>;base64," prefix — Filesystem.writeFile wants raw base64.
            const commaIndex = result.indexOf(',');
            resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1));
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const extensionFor = (file: File): string => {
    const fromName = file.name.split('.').pop();
    if (fromName && fromName.length <= 5) return fromName;
    const fromType = file.type.split('/').pop();
    return fromType || 'm4a';
};

export const saveAudioFile = async (file: File, subdir: 'adhans' | 'recitations'): Promise<string> => {
    const base64 = await readFileAsBase64(file);
    const path = `${subdir}/${crypto.randomUUID()}.${extensionFor(file)}`;
    await Filesystem.writeFile({ path, data: base64, directory: Directory.Data, recursive: true });
    return path;
};

export const getPlayableUrl = async (path: string): Promise<string> => {
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });
    return Capacitor.convertFileSrc(uri);
};

export const deleteAudioFile = async (path: string): Promise<void> => {
    try {
        await Filesystem.deleteFile({ path, directory: Directory.Data });
    } catch {
        // Already gone / never existed — nothing to clean up.
    }
};
