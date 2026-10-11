# Promo landing photo credits

## Photo processing

Landing keeps editable JPEG sources in `static/images/landing/`. Run
`npm run build:photos` after replacing a source; the root `npm run build`
also runs this step automatically. The script writes separate WebP copies
to `static/images/landing/graded/`, which the Landing uses in its hero,
business catalogue, and story cover. JPEG sources are not overwritten.

The shared treatment uses sRGB, bounded exposure adjustment, 90% saturation,
a gentle lifted-black tone, and mild sharpening. Output is capped at 1600px
wide without enlargement, with WebP quality 88. Neutral dark overlays preserve
text contrast without adding a green cast. This does not reconstruct missing
detail or guarantee that QR codes depicted inside a photograph are scannable.

The 2026-10-04 audit covered all 21 current sources: widths 1024-1600px,
9,032,708 source bytes and 3,982,110 processed bytes. The KSO, fuel, and auto
sources are 1024x572px; higher-resolution originals are needed for additional
detail on wide displays. Sources vary in lighting and composition, so a shared
grade is not a replacement for a consistent photo shoot.

The attribution table below is historical. Replaced source files require
updated provenance from their supplier; do not infer that a new image has the
same author or license as the previous file at that path.

The following Wikimedia Commons photos appear in the Promo landing experience. Local copies are scaled to 1280 pixels wide by Wikimedia Commons; the site's responsive `object-fit: cover` may crop them in the browser. Attribution and license links refer to each original file.

| Local photo | Original and author | License |
| --- | --- | --- |
| `static/images/landing/editorial-fuel.jpg` | [Luxwen gasoline filling station at E95 during the evening (1)](https://commons.wikimedia.org/wiki/File:Luxwen_gasoline_filling_station_at_E95_during_the_evening_(1).jpg), Vasyatka1 (Vasylkiv district, Ukraine) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `static/images/landing/editorial-cafe.jpg` | [Cafe-Gallery Shtuka -03](https://commons.wikimedia.org/wiki/File:Cafe-Gallery_Shtuka_-03.jpg), Ю.Корицька-Голуб (Lviv, Ukraine) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `static/images/landing/editorial-flowers.jpg` | [Kyiv Ukraine - September 2012 Flower Shop](https://commons.wikimedia.org/wiki/File:Kyiv_Ukraine_-_September_2012_Flower_Shop.jpg), Sharon Hahn Darlin (Kyiv, Ukraine) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |
| `static/images/landing/editorial-restaurant.jpg` | [National restaurant Nadiya hotel](https://commons.wikimedia.org/wiki/File:National_restaurant_Nadiya_hotel.jpg), Nadiaweb83 (Ukraine) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `static/images/landing/editorial-auto.jpg` | [Chery A1 - service shop in Ukraine (7)](https://commons.wikimedia.org/wiki/File:Chery_A1_-_service_shop_in_Ukraine_(7).jpg), ANT Berezhnyi (Ukraine) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |