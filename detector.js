(() => {
  const SPIDER_TERMS = /\b(spider|arachnid|tarantula|orb[- ]?weaver|black widow|scorpion)\b/i;
  const ANALYSIS_SIZE = 32;

  function classifyPixels(image) {
    const canvas = document.createElement('canvas');
    canvas.width = ANALYSIS_SIZE;
    canvas.height = ANALYSIS_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(image, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
    const { data } = context.getImageData(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
    let darkPixels = 0;
    let warmDarkPixels = 0;
    let edgeEnergy = 0;

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const brightness = (red + green + blue) / 3;
      if (brightness < 75) darkPixels += 1;
      if (brightness < 100 && red > blue * 1.15) warmDarkPixels += 1;
      if (index >= ANALYSIS_SIZE * 4) {
        const previousRed = data[index - ANALYSIS_SIZE * 4];
        const previousGreen = data[index - ANALYSIS_SIZE * 4 + 1];
        const previousBlue = data[index - ANALYSIS_SIZE * 4 + 2];
        edgeEnergy += Math.abs(red - previousRed) + Math.abs(green - previousGreen) + Math.abs(blue - previousBlue);
      }
    }

    const pixelCount = data.length / 4;
    const darkRatio = darkPixels / pixelCount;
    const warmDarkRatio = warmDarkPixels / pixelCount;
    const normalizedEdges = edgeEnergy / (pixelCount * 3 * 255);
    const confidence = Math.min(0.79, darkRatio * 0.35 + warmDarkRatio * 0.25 + normalizedEdges * 0.6);
    return { confidence, source: 'local-visual' };
  }

  async function classifyImage(image) {
    const metadata = [image.alt, image.title, image.currentSrc, image.src].filter(Boolean).join(' ');
    const metadataMatch = SPIDER_TERMS.test(metadata);
    if (metadataMatch) return { confidence: 0.99, source: 'metadata-fallback' };

    try {
      return classifyPixels(image) ?? { confidence: 0, source: 'unavailable' };
    } catch {
      return { confidence: 0, source: 'unavailable' };
    }
  }

  globalThis.spiderShieldDetector = { classifyImage };
})();
