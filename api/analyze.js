async function callGroqChat(apiKey, model, messages, temperature = 0.2, max_tokens = 900, jsonMode = true) {
  const safeMaxTokens = Math.min(Number(max_tokens) || 900, 950);
  const baseBody = {
    model,
    temperature,
    max_tokens: safeMaxTokens,
    messages
  };

  const bodyWithJson = jsonMode
    ? { ...baseBody, response_format: { type: 'json_object' } }
    : baseBody;

  let groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyWithJson)
  });

  let data = await groqResp.json().catch(() => ({}));

  if (!groqResp.ok && jsonMode && /response_format|json_object/i.test(data.error?.message || '')) {
    groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(baseBody)
    });
    data = await groqResp.json().catch(() => ({}));
  }

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

function sanitizeJsonString(rawText) {
  let cleaned = String(rawText || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json|```/gi, '')
    .trim();

  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }

  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString) {
      if (ch === '\n') {
        out += '\\n';
        continue;
      }
      if (ch === '\r') {
        out += '\\r';
        continue;
      }
      if (ch === '\t') {
        out += '\\t';
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        continue;
      }
    }
    out += ch;
  }

  out = out.replace(/,\s*([}\]])/g, '$1');
  return out.trim();
}

function parseJsonLoose(rawText) {
  const repaired = sanitizeJsonString(rawText);
  return JSON.parse(repaired);
}

function buildFallbackRoutine({ currentHairState, selectedStylingMethod, weather, activeTriggers }) {
  const wStr = weather && weather.tempF != null
    ? `${weather.tempF}°F, ${weather.humidity ?? '--'}% humidity, AQI ${weather.aqi ?? '--'}`
    : 'your current local conditions';
  return {
    climateImpact: `Current conditions (${wStr}) can affect moisture retention and styling hold—keep hydration steady and avoid heavy buildup.`,
    rootCauseInsights: (activeTriggers || []).slice(0, 3).map((t) => ({
      cause: t,
      fix: 'Address this trigger gently with balanced moisture, low tension, and clean scalp/skin care.'
    })),
    hairAssessment: `Current mode: ${currentHairState}. Keep routines gentle and targeted.`,
    skinAssessment: 'Keep face and body barrier moisture balanced with gentle cleansing.',
    hairRoutine: [
      { step: 'Cleanse & Hydrate', detail: 'Cleanse scalp and hair gently without stripping, then apply a water-based leave-in.', productUsed: 'Stash or gentle cleanser/leave-in', essential: true },
      { step: 'Seal & Protect', detail: 'Seal ends or protective style with a light oil or mist suited to your current hair state.', productUsed: 'Lightweight oil or mist', essential: true }
    ],
    stylingGuide: {
      method: selectedStylingMethod,
      prepAndProtection: 'Prep clean/conditioned strands and protect from excess heat or tension.',
      recommendedProducts: [],
      techniqueAndTakedown: 'Work in clean sections and release curls or styles gently without tugging.'
    },
    skinRoutine: [
      { step: 'Gentle Cleanse & Moisturize', detail: 'Cleanse face mildly and apply a barrier moisturizer suited to your skin type.', productUsed: 'Face cleanser & moisturizer', essential: true }
    ],
    bodyRoutine: [
      { step: 'Cleanse, Moisturize & Layer', detail: 'Cleanse body, apply lotion/butter on damp skin, and use powder only where needed for dry comfort.', productUsed: 'Body care stash', essential: true }
    ],
    proTreatments: [],
    missingProducts: []
  };
}

function buildFallbackShopRecs({ shoppingPrefs }) {
  const maxPrice = Number(shoppingPrefs?.maxPrice) || 30;
  const store = Array.isArray(shoppingPrefs?.stores) && shoppingPrefs.stores.length
    ? shoppingPrefs.stores[0]
    : 'Target';
  return {
    recommendations: [
      {
        name: 'SheaMoisture Raw Shea Butter Restorative Conditioner',
        domain: 'hair',
        category: 'Deep Conditioner',
        price: `$${Math.min(13.99, maxPrice).toFixed(2)}`,
        numericPrice: Math.min(13.99, maxPrice),
        bestStore: store,
        alsoAt: 'Walmart, Ulta Beauty',
        whyItFits: 'Helps restore moisture and softness for dry or styled hair within your budget.'
      },
      {
        name: 'CeraVe Daily Moisturizing Lotion',
        domain: 'body',
        category: 'Body Lotion / Cream',
        price: `$${Math.min(16.99, maxPrice).toFixed(2)}`,
        numericPrice: Math.min(16.99, maxPrice),
        bestStore: store,
        alsoAt: 'CVS, Walgreens, Amazon',
        whyItFits: 'Supports skin barrier hydration with ceramides and hyaluronic acid.'
      }
    ]
  };
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

      const visionPrompt = `Read this product label/barcode photo and return ONLY valid JSON with no newlines inside strings:
{"name":"Brand & Product Name","brand":"Brand","domain":"hair","category":"Bond Repair|Clarifying / Chelating Shampoo|Conditioner|Deep Conditioner|Edge Control / Wax|Hair Dye|Hair Gel|Hair Oil / Sealant|Hair Relaxer|Heat Protectant|Leave-In / Mist|Moisturizer|Oil Sheen|Protein Treatment|Setting Mousse / Foam / Lotion|Shampoo|Wig / Braid Scalp & Edge Care|Face Cleanser|Face Moisturizer|Face Treatment|Sunscreen|Body Butter|Body Lotion / Cream|Body Oil|Body Powder / Dusting Powder|Body Scrub / Exfoliant|Body Wash / Bar Soap|Other","keyIngredients":["ing1","ing2"],"safetyNote":"1 short note"}`;

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
        850,
        true
      );

      return res.status(200).json({ result: parseJsonLoose(rawText) });
    }

    if (mode === 'shop_recs') {
      const maxPrice = Number(shoppingPrefs.maxPrice) || 30;
      const stores = Array.isArray(shoppingPrefs.stores) && shoppingPrefs.stores.length
        ? shoppingPrefs.stores.join(', ')
        : 'Any store';
      const focusArea = shoppingPrefs.focusArea || 'All missing hair, face & body essentials';

      const shopPrompt = `Recommend 4 specific products <=$${maxPrice} at [${stores}] for focus "${focusArea}".
Profile: ${JSON.stringify(profile || {})}
Hair mode: ${currentHairState} | Styling: ${selectedStylingMethod} | Triggers: ${(activeTriggers || []).join(', ')}
Weather/AQI: ${JSON.stringify(weather || {})}
Owned stash: ${JSON.stringify((inventory || []).map(i => i.name))}
Return ONLY single-line valid JSON (no raw newlines inside string values):
{"recommendations":[{"name":"Brand Product","domain":"hair","category":"Category","price":"$14.99","numericPrice":14.99,"bestStore":"Store","alsoAt":"Store2","whyItFits":"1 short reason"}]}`;

      let rawText = '';
      try {
        rawText = await callGroqChat(apiKey, 'openai/gpt-oss-120b', [{ role: 'user', content: shopPrompt }], 0.25, 950, true);
        return res.status(200).json({ result: parseJsonLoose(rawText) });
      } catch (_) {
        try {
          rawText = await callGroqChat(apiKey, 'qwen/qwen3.8-27b', [{ role: 'user', content: shopPrompt }], 0.25, 950, true);
          return res.status(200).json({ result: parseJsonLoose(rawText) });
        } catch (__) {
          return res.status(200).json({ result: buildFallbackShopRecs({ shoppingPrefs }) });
        }
      }
    }

    const maxPrice = Number(shoppingPrefs.maxPrice) || 30;
    const stores = Array.isArray(shoppingPrefs.stores) && shoppingPrefs.stores.length
      ? shoppingPrefs.stores.join(', ')
      : 'Any store';

    const systemInstructions = `Build a concise Hair, Face & Body care plan from the user's profile, check-in, stash, triggers, and weather/AQI without assuming unstated traits. Max price per item: $${maxPrice}. Stores: ${stores}. ${lowEnergyMode ? 'Keep routines to 2 short steps each.' : 'Keep each step brief and actionable.'}
Return ONLY single-line valid JSON (no raw newlines inside string values):
{"climateImpact":"1-2 sentences","rootCauseInsights":[{"cause":"Cause","fix":"1 short fix"}],"hairAssessment":"1 sentence","skinAssessment":"1 sentence","hairRoutine":[{"step":"Step","detail":"Brief action","productUsed":"Stash item or step","essential":true}],"stylingGuide":{"method":"${selectedStylingMethod}","prepAndProtection":"Brief prep","recommendedProducts":[{"productType":"Type","suggestion":"Product <=$${maxPrice}","howToUse":"Brief tip"}],"techniqueAndTakedown":"Brief tip"},"skinRoutine":[{"step":"Step","detail":"Brief action","productUsed":"Stash item or step","essential":true}],"bodyRoutine":[{"step":"Step","detail":"Brief wash/lotion/butter/oil/powder action","productUsed":"Stash item or step","essential":true}],"proTreatments":[{"provider":"Salon","treatment":"Service","why":"Brief reason","cadence":"Cadence"}],"missingProducts":[{"name":"Product","domain":"hair","store":"Store","reason":"Brief reason","estimatedPrice":"$14.99"}]}`;

    const userPrompt = `Check-in: ${description || 'Routine check-in'}
Hair mode: ${currentHairState} | Styling: ${selectedStylingMethod}
Triggers: ${(activeTriggers || []).join(', ') || 'None'}
Profile: ${JSON.stringify(profile || {})}
Weather/AQI: ${JSON.stringify(weather || {})}
Stash: ${JSON.stringify((inventory || []).map(i => `${i.name} (${i.category})`))}`;

    const messages = imageBase64
      ? [
          {
            role: 'user',
            content: [
              { type: 'text', text: systemInstructions + '\n' + userPrompt },
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

    try {
      const rawText = await callGroqChat(apiKey, primaryModel, messages, 0.25, 950, true);
      return res.status(200).json({ result: parseJsonLoose(rawText) });
    } catch (_) {
      try {
        const rawText = await callGroqChat(apiKey, fallbackModel, messages, 0.25, 950, true);
        return res.status(200).json({ result: parseJsonLoose(rawText) });
      } catch (__) {
        return res.status(200).json({
          result: buildFallbackRoutine({ currentHairState, selectedStylingMethod, weather, activeTriggers })
        });
      }
    }
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error analyzing request' });
  }
}
