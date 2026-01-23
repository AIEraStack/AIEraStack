import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const files = [
    { input: 'public/og-image.svg', output: 'public/og-image.jpg' },
    { input: 'public/og-image-devto.svg', output: 'public/og-image-devto.jpg' }
];

async function convert() {
    for (const file of files) {
        try {
            console.log(`Converting ${file.input}...`);
            await sharp(file.input)
                .jpeg({ quality: 95 })
                .toFile(file.output);
            console.log(`Successfully created ${file.output}`);
        } catch (err) {
            console.error(`Error converting ${file.input}:`, err);
        }
    }
}

convert();
