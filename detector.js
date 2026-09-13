(() => {
  const SPIDER_TERMS = [
    'arachnid',
    'arachnids',
    'banana spider',
    'banana spiders',
    'black widow',
    'black widows',
    'brown recluse',
    'brown recluses',
    'cellar spider',
    'cellar spiders',
    'crab spider',
    'crab spiders',
    'daddy long leg',
    'daddy long legs',
    'daddy longleg',
    'daddy longlegs',
    'false widow',
    'false widows',
    'fishing spider',
    'fishing spiders',
    'four legged spider',
    'four legged spiders',
    'funnel web spider',
    'funnel web spiders',
    'funnel web spiders',
    'funnel web spider',
    'garden spider',
    'garden spiders',
    'golden silk orb weaver',
    'golden silk orb weavers',
    'goliath birdeater',
    'goliath birdeaters',
    'harvestman',
    'harvestmen',
    'hobo spider',
    'hobo spiders',
    'house spider',
    'house spiders',
    'huntsman spider',
    'huntsman spiders',
    'jumping spider',
    'jumping spiders',
    'lynx spider',
    'lynx spiders',
    'orb weaver',
    'orb weavers',
    'orbweaver',
    'orbweavers',
    'redback spider',
    'redback spiders',
    'scorpion',
    'scorpions',
    'six eyed sand spider',
    'six eyed sand spiders',
    'spider',
    'spiderling',
    'spiderlings',
    'spiders',
    'tarantula',
    'tarantulas',
    'trapdoor spider',
    'trapdoor spiders',
    'wandering spider',
    'wandering spiders',
    'white tail spider',
    'white tail spiders',
    'wolf spider',
    'wolf spiders',
    'zebra spider',
    'zebra spiders',
  ];
  const ANALYSIS_SIZE = 32;

  function normalizeMetadata(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function collectContext(image) {
    const values = [];
    let element = image;
    for (let depth = 0; element && depth < 4; depth += 1, element = element.parentElement) {
      values.push(
        element.getAttribute?.('aria-label'),
        element.getAttribute?.('data-testid'),
        element.getAttribute?.('data-adclicklocation'),
        element.getAttribute?.('title'),
      );
    }
    const post = image.closest('article, [data-testid="post-container"], shreddit-post');
    if (post) values.push(post.textContent);
    return values.filter(Boolean);
  }

  const spiderPattern = new RegExp(
    `\\b(?:${SPIDER_TERMS
      .map(normalizeMetadata)
      .sort((left, right) => right.length - left.length)
      .map((term) => term.replace(/\s+/g, '\\s+'))
      .join('|')})\\b`,
    'i',
  );

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
    const confidence = Math.min(1, darkRatio * 0.35 + warmDarkRatio * 0.25 + normalizedEdges * 0.6);
    return { confidence, source: 'local-visual' };
  }

  async function classifyImage(image) {
    const link = image.closest('a');
    const metadata = [
      image.alt,
      image.title,
      image.getAttribute('aria-label'),
      image.getAttribute('data-image-title'),
      image.currentSrc,
      image.src,
      link?.getAttribute('aria-label'),
      link?.title,
      link?.textContent,
      ...collectContext(image),
    ].filter(Boolean).join(' ');
    const metadataMatch = spiderPattern.test(normalizeMetadata(metadata));
    if (metadataMatch) return { confidence: 0.99, source: 'metadata-fallback' };

    try {
      return classifyPixels(image) ?? { confidence: 0, source: 'unavailable' };
    } catch {
      return { confidence: 0, source: 'unavailable' };
    }
  }

  globalThis.spiderShieldDetector = { classifyImage };
})();
