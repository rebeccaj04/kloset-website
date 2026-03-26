const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_TIMEOUT_MS = 28_000; // 28s — resolves before the client's 30s abort fires

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let image: string;
  let mimeType: string;
  let mode: 'adult' | 'kids' | 'pets' = 'adult';
  try {
    ({ image, mimeType, mode } = await request.json());
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!image || !mimeType) {
    return Response.json({ error: 'Missing image or mimeType' }, { status: 400 });
  }

  const isKids = mode === 'kids';
  const isPets = mode === 'pets';

  const fabricHint = '"fabric": "primary fabric — Cotton, Wool, Silk, Denim, Linen, Cashmere, Leather, Suede, Velvet, Polyester, Nylon, Viscose, Knit, Jersey, or best guess from texture/sheen/drape — null if impossible to determine"';

  const prompt = isPets
    ? `Analyse this pet clothing or accessory image. Return ONLY a valid JSON object with these fields:
{
  "type": "use pet clothing categories: Coat, Jumper, Harness, Bandana, Costume, Accessories, Raincoat, Boots, Pyjamas, Swimwear, or other pet clothing type",
  "colour": "primary colour(s)",
  "pattern": "e.g. solid, striped, floral, checked, paw print, tartan",
  "style": "e.g. casual, outdoor, fashion, sportswear, occasion",
  "formality": "casual | smart | occasion",
  "brand": "brand name if visible (e.g. Barbour, Hunter, Joules, Moshiqa, Ruffwear, Puppia), otherwise null",
  "size": "pet size if visible on label: XS, S, M, L, XL (dog sizes) — or breed-specific size notation — null if not visible",
  "season": "SS25 for lightweight/summer pet clothing, AW25 for warm/winter pet clothing",
  ${fabricHint}
}
Return only the JSON object, no markdown, no explanation.`
    : isKids
    ? `Analyse this children's clothing item image. Return ONLY a valid JSON object with these fields:
{
  "type": "use children's categories: School Uniform, Playsuit, Babygrow, Kids Dress, Kids Top, Kids Jeans, Kids Trousers, Kids Shorts, Kids Skirt, Kids Hoodie, Kids Jacket, Kids Trainers, Kids Shoes, Kids Hat, Kids Coat, Kids Swimwear, Pyjamas, or other children's clothing type",
  "colour": "primary colour(s)",
  "pattern": "e.g. solid, striped, floral, checked, dinosaurs, unicorns, cartoon print",
  "style": "e.g. casual, school, formal, sportswear, nightwear",
  "formality": "casual | school | formal",
  "brand": "brand name if visible (e.g. Zara Kids, H&M Kids, Gap Kids, Next, M&S, JoJo Maman Bébé), otherwise null",
  "size": "children's age-based size if visible on label: e.g. 0-3m, 3-6m, 6-9m, 9-12m, 12-18m, 18-24m, 2-3y, 3-4y, 4-5y, 5-6y, 6-7y, 7-8y, 8-9y, 9-10y, 10-11y, 11-12y, 12-13y — null if not visible",
  "season": "fashion season based on garment weight and style. Default to SS25 for spring/summer items (lightweight, bright, short sleeves, swimwear, linen, cotton) and AW25 for autumn/winter items (heavy fabrics, knits, wool, coats, dark tones) — only use an older season (SS24, AW24 etc.) if the garment style clearly suggests it is from a prior season. Return null only if completely ambiguous.",
  ${fabricHint}
}
Return only the JSON object, no markdown, no explanation.`
    : `Analyse this clothing item image. Return ONLY a valid JSON object with these fields:
{
  "type": "Be VERY specific about the garment type. Use these exact categories: T-Shirt, Polo Shirt, Shirt (button-up/collared), Blouse, Vest Top, Crop Top, Jumper/Sweater, Hoodie, Cardigan, Jeans, Trousers, Leggings, Shorts, Skirt, Dress, Jumpsuit, Blazer, Jacket, Coat, Shoes, Boots, Trainers, Heels, Sandals, Hat, Cap, Bag, Belt, Scarf, Jewellery, Swimwear, Sportswear, Pyjamas, Underwear. CRITICAL: A shirt or blouse must NEVER be tagged as 'dress'. Only tag as 'Dress' if the garment covers both upper and lower body as one piece. If unsure between two categories, pick the more specific one.",
  "colour": "primary colour(s)",
  "pattern": "e.g. solid, striped, floral, checked, plain",
  "style": "e.g. casual, smart-casual, formal, sportswear, streetwear",
  "formality": "casual | smart-casual | formal",
  "brand": "brand name if visible, otherwise null",
  "size": "size from any visible label — use standard format: XS, S, M, L, XL, XXL or numeric UK sizes 6, 8, 10, 12, 14, 16 etc — null if not visible",
  "season": "fashion season based on garment weight, fabric and style. Default to SS25 for spring/summer items (lightweight, bright colours, short sleeves, linen, cotton) and AW25 for autumn/winter items (heavy fabrics, knits, wool, coats, dark tones) — only use an older season (SS24, AW24 etc.) if the garment style clearly suggests it is from a prior season. Return null only if completely ambiguous.",
  "confidence": "high | medium | low — your confidence in the type classification. Use 'low' if the image is unclear, partially visible, or you are unsure",
  ${fabricHint}
}
Return only the JSON object, no markdown, no explanation.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    signal: controller.signal,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 768,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: image },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });

  clearTimeout(timer);

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    return Response.json(
      { error: `Anthropic error: ${anthropicRes.status} ${err}` },
      { status: anthropicRes.status }
    );
  }

  const data = await anthropicRes.json();
  const text: string = data.content[0].text.trim();

  try {
    const tags = JSON.parse(text);
    return Response.json(tags);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return Response.json(JSON.parse(match[0]));
    return Response.json({ error: 'Failed to parse Claude response' }, { status: 502 });
  }
}
