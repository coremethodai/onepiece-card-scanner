import sharp from "sharp";

interface DetectedCard {
  base64: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
}

export async function detectAndCropCards(
  base64DataUrl: string
): Promise<DetectedCard[] | null> {
  const base64Data = base64DataUrl.replace(/^data:image\/\w+;base64,/, "");
  const imageBuffer = Buffer.from(base64Data, "base64");

  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const imgWidth = metadata.width!;
  const imgHeight = metadata.height!;
  const totalPixels = imgWidth * imgHeight;

  const grayBuffer = await sharp(imageBuffer)
    .greyscale()
    .raw()
    .toBuffer();

  const threshold = 80;
  const binary = new Uint8Array(grayBuffer.length);
  for (let i = 0; i < grayBuffer.length; i++) {
    binary[i] = grayBuffer[i] > threshold ? 1 : 0;
  }

  const labels = new Int32Array(imgWidth * imgHeight);
  let nextLabel = 1;
  const parent: number[] = [0];

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }

  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }

  for (let y = 0; y < imgHeight; y++) {
    for (let x = 0; x < imgWidth; x++) {
      const idx = y * imgWidth + x;
      if (binary[idx] === 0) continue;

      const above = y > 0 ? labels[(y - 1) * imgWidth + x] : 0;
      const left = x > 0 ? labels[y * imgWidth + (x - 1)] : 0;

      if (above === 0 && left === 0) {
        labels[idx] = nextLabel;
        parent.push(nextLabel);
        nextLabel++;
      } else if (above !== 0 && left === 0) {
        labels[idx] = above;
      } else if (above === 0 && left !== 0) {
        labels[idx] = left;
      } else {
        labels[idx] = above;
        if (above !== left) union(above, left);
      }
    }
  }

  for (let i = 0; i < labels.length; i++) {
    if (labels[i] > 0) labels[i] = find(labels[i]);
  }

  const boxes = new Map<number, BoundingBox>();
  for (let y = 0; y < imgHeight; y++) {
    for (let x = 0; x < imgWidth; x++) {
      const label = labels[y * imgWidth + x];
      if (label === 0) continue;

      if (!boxes.has(label)) {
        boxes.set(label, {
          minX: x,
          minY: y,
          maxX: x,
          maxY: y,
          area: 1,
        });
      } else {
        const b = boxes.get(label)!;
        b.minX = Math.min(b.minX, x);
        b.minY = Math.min(b.minY, y);
        b.maxX = Math.max(b.maxX, x);
        b.maxY = Math.max(b.maxY, y);
        b.area++;
      }
    }
  }

  const minArea = totalPixels * 0.005;
  const maxArea = totalPixels * 0.5;

  const cardRegions = Array.from(boxes.values())
    .filter((b) => {
      const w = b.maxX - b.minX + 1;
      const h = b.maxY - b.minY + 1;
      const boxArea = w * h;
      const fillRatio = b.area / boxArea;
      const aspect = Math.max(w, h) / Math.min(w, h);

      return (
        boxArea >= minArea &&
        boxArea <= maxArea &&
        fillRatio > 0.3 &&
        aspect < 4
      );
    })
    .sort((a, b) => {
      const rowA = Math.floor(a.minY / (imgHeight * 0.15));
      const rowB = Math.floor(b.minY / (imgHeight * 0.15));
      if (rowA !== rowB) return rowA - rowB;
      return a.minX - b.minX;
    })
    .slice(0, 20);

  if (cardRegions.length === 0) {
    return null;
  }

  const padding = Math.max(5, Math.floor(Math.min(imgWidth, imgHeight) * 0.005));

  const croppedCards: DetectedCard[] = await Promise.all(
    cardRegions.map(async (region) => {
      const left = Math.max(0, region.minX - padding);
      const top = Math.max(0, region.minY - padding);
      const right = Math.min(imgWidth, region.maxX + 1 + padding);
      const bottom = Math.min(imgHeight, region.maxY + 1 + padding);
      const width = right - left;
      const height = bottom - top;

      const croppedBuffer = await sharp(imageBuffer)
        .extract({ left, top, width, height })
        .jpeg({ quality: 85 })
        .toBuffer();

      return {
        base64: croppedBuffer.toString("base64"),
        x: left,
        y: top,
        width,
        height,
      };
    })
  );

  return croppedCards;
}
