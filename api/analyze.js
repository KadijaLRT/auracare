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
      mode = 'routine', // 'routine' | 'product_photo' | 'shop_recs'
      description = '',
      activeTriggers = [],
      currentHairState = 'Relaxed Hair (Out / Styled)',
      selectedStylingMethod = 'None / Air Dry / Natural',
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

      const visionPrompt = `You are a cosmetic chemist and beauty inventory assistant. Examine this product photo and extract product details into strict JSON with keys:
- "name": string (exact product name)
- "brand": string (brand name)
- "domain": string ("hair", "skin", or "body")
- "category": string (one of: "Bond Repair", "Shampoo", "Clarifying / Chelating Shampoo", "Deep Conditioner", "Protein Treatment", "Leave-In / Mist", "Hair Oil / Sealant", "Heat Protectant", "Setting Mousse / Foam / Lotion", "Wig / Braid Scalp & Edge Care", "Face Cleanser", "Face Treatment", "Face Moisturizer", "Sunscreen", "Body Wash / Bar Soap", "Body Scrub / Exfoliant", "Body Lotion / Cream", "Body Butter", "Body Oil", "Body Powder / Dusting Powder", "Other")
- "keyIngredients": array of 3-5 notable active/beneficial ingredients or warnings
- "safetyNote": string (1 short sentence on compatibility and precautions based on the user's profile: ${JSON.stringify(profile || {})})

Return ONLY valid JSON, no markdown fences.`;

      const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.2-11b-vision-preview',
          temperature: 0.2,
          max_tokens: 550,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: visionPrompt },
                { type: 'image_url', image_url: { url: imageBase64 } }
              ]
            }
          ]
        })
      });

      const data = await groqResp.json();
      if (!groqResp.ok) {
        return res.status(groqResp.status).json({ error: data.error?.message || 'Groq Vision API error' });
      }

      const rawText = data.choices?.[0]?.message?.content || '{}';
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      return res.status(200).json({ result: JSON.parse(cleaned) });
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

      const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3,
          max_tokens: 1200,
          messages: [{ role: 'user', content: shopPrompt }]
        })
      });

      const data = await groqResp.json();
      if (!groqResp.ok) {
        return res.status(groqResp.status).json({ error: data.error?.message || 'Groq API error' });
      }

      const rawText = data.choices?.[0]?.message?.content || '{}';
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      return res.status(200).json({ result: JSON.parse(cleaned) });
    }

    // Routine generation mode
    const model = imageBase64 ? 'llama-3.2-11b-vision-preview' : 'llama-3.3-70b-versatile';
    const maxPrice = Number(shoppingPrefs.maxPrice) || 30;
    const stores = Array.isArray(shoppingPrefs.stores) && shoppingPrefs.stores.length
      ? shoppingPrefs.stores.join(', ')
      : 'Any store';

    const systemInstructions = `You are an expert trichologist, dermatologist advisor, and licensed esthetician building a practical Hair, Face & Body care plan based ONLY on the user's stated profile, current check-in, current hair state, styling method, stash, weather/AQI, and active triggers. Do not assume unstated demographics or traits.
- User Profile: ${JSON.stringify(profile || {})}
- Current Hair State: ${currentHairState} (If "Relaxed Hair (Out / Styled)": prioritize bond/protein-moisture balance, line-of-demarcation protection, low heat, and gentle moisture sealing. If wearing a wig: cover scalp care underneath, wig-cap/band edge friction protection, moisturizing braids/cornrows under the unit, and unit maintenance. If wearing braid extensions: cover diluted/no-rinse scalp cleansing, braid spray/leave-in misting without heavy buildup, edge tension relief, and takedown prep.)
- Selected Styling Tool / Roller Method: ${selectedStylingMethod} (Provide exact prep, setting/heat products, temperature/drying precautions, and takedown steps specific to that tool.)
- Body Care & Homemade Body Powder Note: If the user makes or uses homemade body powder / dusting powder, integrate it properly into the body routine (e.g., cleanse -> apply body lotion/cream on damp skin -> seal dry areas with body butter/oil -> dust body powder on friction/sweat-prone areas like underarms, inner thighs, under-bust, feet, or over sticky lotion/oil for a silky dry finish, keeping powder away from inhalation/mucous membranes).
- Active Change Triggers Selected: ${JSON.stringify(activeTriggers || [])}
- Location & Live Weather/Air Quality: ${JSON.stringify(weather || {})}
- Current Owned Inventory: ${JSON.stringify(inventory || [])}
- Preferred Stores: ${stores}
- Max Budget Per New Item: $${maxPrice}
- Low-Energy / Short Mode: ${lowEnergyMode ? 'YES (keep each routine to max 2-3 essential steps)' : 'NO (full tailored routine)'}

Return ONLY valid JSON (no markdown fences) with this exact structure:
{
  "climateImpact": "2-3 concise sentences explaining how current local temperature, humidity/dew point, UV, and AQI affect their hair (including relaxed hair/wigs/braids/curls), face, and body.",
  "rootCauseInsights": [
    { "cause": "Non-weather trigger or factor relevant to their check-in/profile", "fix": "1-2 short actionable sentences on how to address it." }
  ],
  "hairAssessment": "1-2 concise sentences assessing their hair/scalp state including current relaxed/natural/wig/braid status.",
  "skinAssessment": "1-2 concise sentences assessing their face & body skin state.",
  "hairRoutine": [
    { "step": "Step title", "detail": "Short actionable instruction", "productUsed": "Product from stash or general step", "essential": true }
  ],
  "stylingGuide": {
    "method": "${selectedStylingMethod}",
    "prepAndProtection": "How to prep hair/extensions and protect from heat or tension before using this tool/roller.",
    "recommendedProducts": [
      { "productType": "e.g., Thermal Heat Protectant / Setting Mousse / End Papers", "suggestion": "Specific product name under $${maxPrice} at their preferred store", "howToUse": "1 short sentence" }
    ],
    "techniqueAndTakedown": "Key setting, temperature, drying, and unrolling/takedown tips so curls hold without breakage or frizz."
  },
  "skinRoutine": [
    { "step": "Step title", "detail": "Short actionable instruction", "productUsed": "Product from stash or general step", "essential": true }
  ],
  "bodyRoutine": [
    { "step": "Step title", "detail": "Short actionable instruction covering body wash/bar soap, lotion, body butter, body oil, and body powder placement", "productUsed": "Product from stash (including homemade body powder if applicable) or general step", "essential": true }
  ],
  "proTreatments": [
    { "provider": "Salon" or "Dermatologist" or "Esthetician", "treatment": "Exact service name", "why": "Why it helps their specific profile/state and what precautions to ask about", "cadence": "Recommended cadence" }
  ],
  "missingProducts": [
    { "name": "Specific Brand & Product Name", "domain": "hair|skin|body", "store": "Preferred store", "reason": "Why it fills a gap in their current stash, protective style, or styling setup", "estimatedPrice": "$14.99" }
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

    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 1850,
        messages
      })
    });

    const data = await groqResp.json();
    if (!groqResp.ok) {
      return res.status(groqResp.status).json({ error: data.error?.message || 'Groq API error' });
    }

    const rawText = data.choices?.[0]?.message?.content || '{}';
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    return res.status(200).json({ result: JSON.parse(cleaned) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error analyzing request' });
  }
}
