async function callGroqChat(apiKey, model, messages, temperature = 0.2, max_tokens = 2000) {
  const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens,
      messages
    })
  });

  const data = await groqResp.json().catch(() => ({}));
  if (!groqResp.ok) {
    const err = new Error(data.error?.message || `Groq API error (${groqResp.status})`);
    err.status = groqResp.status;
    throw err;
  }

  let content = data.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    content = content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('\n');
  }
  return typeof content === 'string' ? content : JSON.stringify(content || {});
}

function parseJsonLoose(rawText) {
  let cleaned = String(rawText || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json|```/gi, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const candidate = cleaned.slice(startIdx, endIdx + 1);
      return JSON.parse(candidate);
    }
    throw new Error('Model response could not be parsed as valid JSON.');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GROQ_API_KEY is not set in Vercel Environment Variables.'
    });
  }

  try {
    const {
      mode = 'routine',
      description = '',
      activeTriggers = [],
      currentHairState = 'Relaxed Hair (Out / Styled)',
      selectedStylingMethod = 'None / Air Dry / Protective Set',
      imageBase64 = null,
      profile = {},
      weather = {},
      inventory = [],
      lowEnergyMode = false,
      shoppingPrefs = {}
    } = req.body || {};

    if (mode === 'product_photo') {
      if (!imageBase64) {
        return res.status(400).json({ error: 'No product photo provided.' });
      }

      const visionPrompt = `You are a cosmetic chemist and beauty inventory assistant. Examine this product photo (front label, back ingredients, or barcode label) and extract product details into strict JSON with keys:
- "name": string (exact product name and brand)
- "brand": string (brand name)
- "domain": string ("hair", "skin", or "body")
- "category": string (one of: "Bond Repair", "Shampoo", "Clarifying / Chelating Shampoo", "Deep Conditioner", "Protein Treatment", "Leave-In / Mist", "Hair Oil / Sealant", "Heat Protectant", "Setting Mousse / Foam / Lotion", "Wig / Braid Scalp & Edge Care", "Face Cleanser", "Face Treatment", "Face Moisturizer", "Sunscreen", "Body Wash / Bar Soap", "Body Scrub / Exfoliant", "Body Lotion / Cream", "Body Butter", "Body Oil", "Body Powder / Dusting Powder", "Other")
- "keyIngredients": array of 3-5 notable active/beneficial ingredients or warnings
- "safetyNote": string (1 short sentence on compatibility and precautions based on the user's profile: ${JSON.stringify(profile || {})})

Return ONLY valid JSON, no markdown fences or extra text.`;

      const rawText = await callGroqChat(
        apiKey,
        'qwen/qwen3.8-27b',
        [
          {
            role: 'user',
            content: [
              { type: 'text', text: visionPrompt },
              { type: 'image_url', image_url: { url: imageBase64 } }
            ]
          }
        ],
        0.2,
        1400
      );

      return res.status(200).json({ result: parseJsonLoose(rawText) });
    }

    if (mode === 'shop_recs') {
      const maxPrice = Number(shoppingPrefs.maxPrice) || 30;
      const stores = Array.isArray(shoppingPrefs.stores) && shoppingPrefs.stores.length
        ? shoppingPrefs.stores.join(', ')
        : 'Any store';
      const focusArea = shoppingPrefs.focusArea || 'All missing hair, face & body essentials';

      const shopPrompt = `You are a trichologist, licensed esthetician, and smart beauty shopper.
Recommend 6 specific, real hair, face, and body care products tailored strictly to the user's profile, current hair state (relaxed hair, natural hair, wig, or braid extensions), and styling tools (curling iron, hot rollers, foam/flexi/velcro/satin rollers):
- User Profile: ${JSON.stringify(profile || {})}
- Current Hair Mode: ${currentHairState}
- Selected Styling Method / Rollers / Heat Tool: ${selectedStylingMethod}
- Active Change Triggers Selected: ${JSON.stringify(activeTriggers || [])}
- Location & Live Weather/AQI: ${JSON.stringify(weather || {})}
- Products User ALREADY OWNS (including any homemade body powder or custom oil mixes — DO NOT recommend duplicates): ${JSON.stringify(inventory || [])}
- Preferred Stores: ${stores}
- Maximum Price Per Item: $${maxPrice} USD (EVERY item MUST be strictly $${maxPrice} or under!)
- Focus Filter: ${focusArea}

Return ONLY valid JSON (no markdown fences) with this exact structure:
{
  "recommendations": [
    {
      "name": "Exact Brand & Product Name",
      "domain": "hair" or "skin" or "body",
      "category": "Category string",
      "price": "$14.99",
      "numericPrice": 14.99,
      "bestStore": "Best matching store from their preferred list",
      "alsoAt": "Other stores where commonly sold",
      "whyItFits": "1 short sentence explaining how it matches their profile, current hair state, roller/curling tool, body layering (including body powder if used), weather/AQI, and stash gaps."
    }
  ]
}`;

      let rawText;
      try {
        rawText = await callGroqChat(apiKey, 'openai/gpt-oss-120b', [{ role: 'user', content: shopPrompt }], 0.3, 1800);
      } catch (_) {
        rawText = await callGroqChat(apiKey, 'qwen/qwen3.8-27b', [{ role: 'user', content: shopPrompt }], 0.3, 1800);
      }

      return res.status(200).json({ result: parseJsonLoose(rawText) });
    }

    const maxPrice = Number(shoppingPrefs.maxPrice) || 30;
    const stores = Array.isArray(shoppingPrefs.stores) && shoppingPrefs.stores.length
      ? shoppingPrefs.stores.join(', ')
      : 'Any store';

    const systemInstructions = `You are an expert trichologist, dermatologist advisor, and licensed esthetician building a practical Hair, Face & Body care plan based ONLY on the user's stated profile, current check-in, current hair state, styling method, stash, weather/AQI, and active triggers. Do not assume unstated demographics or traits.
- User Profile: ${JSON.stringify(profile || {})}
- Current Hair State: ${currentHairState}
- Selected Styling Tool / Roller Method: ${selectedStylingMethod}
- Active Change Triggers Selected: ${JSON.stringify(activeTriggers || [])}
- Location & Live Weather/Air Quality: ${JSON.stringify(weather || {})}
- Current Owned Inventory: ${JSON.stringify(inventory || [])}
- Preferred Stores: ${stores}
- Max Budget Per New Item: $${maxPrice}
- Low-Energy / Short Mode: ${lowEnergyMode ? 'YES (keep each routine to max 2-3 essential steps)' : 'NO (full tailored routine)'}

Return ONLY valid JSON (no markdown fences) with this exact structure:
{
  "climateImpact": "2-3 concise sentences explaining how current local temperature, humidity/dew point, UV, and AQI affect their hair, face, and body.",
  "rootCauseInsights": [
    { "cause": "Non-weather trigger or factor relevant to their check-in/profile", "fix": "1-2 short actionable sentences on how to address it." }
  ],
  "hairAssessment": "1-2 concise sentences assessing their hair/scalp state.",
  "skinAssessment": "1-2 concise sentences assessing their face & body skin state.",
  "hairRoutine": [
    { "step": "Step title", "detail": "Short actionable instruction", "productUsed": "Product from stash or general step", "essential": true }
  ],
  "stylingGuide": {
    "method": "${selectedStylingMethod}",
    "prepAndProtection": "How to prep hair/extensions and protect from heat or tension before using this tool/roller.",
    "recommendedProducts": [
      { "productType": "Product type", "suggestion": "Specific product name under $${maxPrice} at their preferred store", "howToUse": "1 short sentence" }
    ],
    "techniqueAndTakedown": "Key setting, temperature, drying, and unrolling/takedown tips."
  },
  "skinRoutine": [
    { "step": "Step title", "detail": "Short actionable instruction", "productUsed": "Product from stash or general step", "essential": true }
  ],
  "bodyRoutine": [
    { "step": "Step title", "detail": "Short actionable instruction covering body wash/bar soap, lotion, body butter, body oil, and body powder placement", "productUsed": "Product from stash or general step", "essential": true }
  ],
  "proTreatments": [
    { "provider": "Salon" or "Dermatologist" or "Esthetician", "treatment": "Exact service name", "why": "Why it helps their specific profile/state and what precautions to ask about", "cadence": "Recommended cadence" }
  ],
  "missingProducts": [
    { "name": "Specific Brand & Product Name", "domain": "hair|skin|body", "store": "Preferred store", "reason": "Why it fills a gap in their current stash", "estimatedPrice": "$14.99" }
  ]
}`;

    const userPrompt = `Current Check-In Description: ${description || 'Generate a routine based on my profile, current hair state, styling tool, active triggers, current stash, and local weather/AQI.'}
Current Hair State: ${currentHairState}
Selected Styling Method: ${selectedStylingMethod}
Active Triggers: ${activeTriggers.length ? activeTriggers.join(', ') : 'None selected'}`;

    const messages = imageBase64
      ? [
          {
            role: 'user',
            content: [
              { type: 'text', text: systemInstructions + '\n\n' + userPrompt },
              { type: 'image_url', image_url: { url: imageBase64 } }
            ]
          }
        ]
      : [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: userPrompt }
        ];

    const primaryModel = imageBase64 ? 'qwen/qwen3.8-27b' : 'openai/gpt-oss-120b';
    const fallbackModel = imageBase64 ? 'openai/gpt-oss-120b' : 'qwen/qwen3.8-27b';

    let rawText;
    try {
      rawText = await callGroqChat(apiKey, primaryModel, messages, 0.3, 2400);
    } catch (_) {
      rawText = await callGroqChat(apiKey, fallbackModel, messages, 0.3, 2400);
    }

    return res.status(200).json({ result: parseJsonLoose(rawText) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error analyzing request' });
  }
}
