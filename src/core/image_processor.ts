
import sharp from 'sharp';

/**
 * Optimizes Figma assets for Copilot CLI (Strict Token Budget).
 * Strategy: Scale-2 Source -> Downsample 512px -> WebP Q70.
 */
export async function optimizeForCli(imageBuffer: Buffer): Promise<Buffer> {
    try {
        // 1. Load image
        let pipeline = sharp(imageBuffer);

        // 2. Resize to 512x512 max (inside)
        pipeline = pipeline.resize({
            width: 512,
            height: 512,
            fit: 'inside',     // Maintain aspect ratio, do not crop
            withoutEnlargement: true // Do not upscale small images
        });

        // 3. Composite over white background (remove alpha channel transparency)
        // This is important because some LLM vision models struggle with transparent PNGs
        pipeline = pipeline.flatten({ background: '#ffffff' });

        // 4. Convert to WebP (Quality 70)
        // WebP is significantly smaller than PNG/JPEG for UI screenshots
        pipeline = pipeline.webp({
            quality: 70,
            smartSubsample: true, // High quality subsampling
            effort: 6 // Max compression effort
        });

        return await pipeline.toBuffer();
    } catch (error: any) {
        console.error(`[ImageProcessor] Optimization failed: ${error.message}`);
        // Fallback: Return original buffer if optimization fails (though likely to be too big, it prevents crash)
        return imageBuffer;
    }
}
