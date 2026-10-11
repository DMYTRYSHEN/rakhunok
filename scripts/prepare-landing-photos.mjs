import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceDirectory = resolve(root, 'static/images/landing');
const outputDirectory = resolve(sourceDirectory, 'graded');
const names = (await readdir(sourceDirectory)).filter((name) => /^editorial-.*\.jpg$/.test(name)).sort();
await mkdir(outputDirectory, { recursive: true });

for (const name of names) {
	const source = resolve(sourceDirectory, name);
	const statistics = await sharp(source).rotate().toColourspace('srgb').stats();
	const luminance = statistics.channels[0].mean * 0.2126 + statistics.channels[1].mean * 0.7152 + statistics.channels[2].mean * 0.0722;
	const brightness = Math.max(0.96, Math.min(1.16, 1 + (125 - luminance) / 600));
	const output = resolve(outputDirectory, name.replace(/\.jpg$/, '.webp'));
	const result = await sharp(source)
		.rotate()
		.toColourspace('srgb')
		.resize({ width: 1600, withoutEnlargement: true })
		.modulate({ brightness, saturation: 0.9 })
		.linear(0.98, 2)
		.sharpen({ sigma: 0.5, m1: 0.3, m2: 0.6 })
		.webp({ quality: 88, effort: 6, smartSubsample: true })
		.toFile(output);
	console.log(JSON.stringify({ name, width: result.width, height: result.height, sourceBytes: (await stat(source)).size, outputBytes: result.size, brightness: Number(brightness.toFixed(3)) }));
}