async function callGroqChat(apiKey, model, messages, temperature = 0.2, max_tokens = 650, jsonMode = true) {
  const safeMaxTokens = Math.min(Number(max_tokens) || 650, 750);
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
      if (ch.charCodeAt(0) < 0x20) {
        continue;
      }
    }
    out += ch;
  }

  return out.replace(/,\s*([}\]])/g, '$1').trim();
}

function parseJsonLoose(rawText) {
  return JSON.parse(sanitizeJsonString(rawText));
}

function buildFallbackRoutine({ currentHairState, selectedStylingMethod, weather, activeTriggers }) {
  const wStr = weather && weather.tempF != null
    ? `${weather.tempF}°F, ${weather.humidity ?? '--'}% hum, AQI ${weather.aqi ?? '--'}`
    : 'current weather';
  return {
    climateImpact: `Conditions (${wStr}): keep moisture steady and avoid heavy buildup.`,
    rootCauseInsights: (activeTriggers || []).slice(0, 2).map((t) => ({
      cause: t,
      fix: 'Use gentle moisture and low tension.'
    })),
    hairAssessment: `${currentHairState} — keep care focused and gentle.`,
    skinAssessment: 'Keep face and body barrier moisture balanced.',
    hairRoutine: [
      { step: 'Cleanse & Hydrate', detail: 'Use stash cleanser/conditioner + leave-in.', productUsed: 'Stash hair items', essential: true },
      { step: 'Seal & Protect', detail: `Style for ${selectedStylingMethod} with light oil/mist.`, productUsed: 'Stash oil/mist', essential: true }
    ],
    stylingGuide: {
      method: selectedStylingMethod,
      prepAndProtection: 'Prep clean/conditioned hair and protect edges/heat.',
      recommendedProducts: [],
      techniqueAndTakedown: 'Work in sections and release gently.'
    },
    skinRoutine: [
      { step: 'Cleanse & Moisturize', detail: 'Gentle cleanse + barrier moisturizer.', productUsed: 'Stash face items', essential: true }
    ],
    bodyRoutine: [
      { step: 'Wash, Moisturize & Powder', detail: 'Layer body care on damp skin; powder friction zones.', productUsed: 'Stash body items', essential: true }
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
        name: 'SheaMoisture Raw Shea Butter Conditioner',
        domain: 'hair',
        category: 'Conditioner',
        price: `$${Math.min(13.99, maxPrice).toFixed(2)}`,
        numericPrice: Math.min(13.99, maxPrice),
        bestStore: store,
        alsoAt: 'Walmart, Ulta Beauty',
        whyItFits: 'Hydrates dry or styled hair within budget.'
      },
      {
        name: 'CeraVe Daily Moisturizing Lotion',
        domain: 'body',
        category: 'Body Lotion / Cream',
        price: `$${Math.min(16.99, maxPrice).toFixed(2)}`,
        numericPrice: Math.min(16.99, maxPrice),
        bestStore: store,
        alsoAt: 'CVS, Walgreens',
        whyItFits: 'Supports skin barrier hydration.'
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
    return res.status(500).json({ error: 'GROQ_API_KEY is not set in Vercel Environment Variables.' });
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
      if (!imageBase64) return res.status(400).json({ error: 'No product photo provided.' });

      const visionPrompt = `Read product label and return compact JSON (no newlines in strings):
{"name":"Brand & Name","brand":"Brand","domain":"hair|skin|body","category":"Bond Repair|Clarifying / Chelating Shampoo|Conditioner|Deep Conditioner|Edge Control / Wax|Hair Dye|Hair Gel|Hair Oil / Sealant|Hair Relaxer|Heat Protectant|Leave-In / Mist|Moisturizer|Oil Sheen|Protein Treatment|Setting Mousse / Foam / Lotion|Shampoo|Wig / Braid Scalp & Edge Care|Face Cleanser|Face Moisturizer|Face Treatment|Sunscreen|Body Butter|Body Lotion / Cream|Body Oil|Body Powder / Dusting Powder|Body Scrub / Exfoliant|Body Wash / Bar Soap|Other","keyIngredients":["ing1","ing2"],"safetyNote":"short note"}`;

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
        450,
        true
      );

      return res.status(200).json({ result: parseJsonLoose(rawText) });
    }

    if (mode === 'shop_recs') {
      const maxPrice = Number(shoppingPrefs.maxPrice) || 30;
      const stores = Array.isArray(shoppingPrefs.stores) && shoppingPrefs.stores.length
        ? shoppingPrefs.stores.join(', ')
        : 'Any';
      const focusArea = shoppingPrefs.focusArea || 'Missing essentials';

      const shopPrompt = `3-4 items <=$${maxPrice} at [${stores}] for "${focusArea}".
Profile:${JSON.stringify(profile || {})} Mode:${currentHairState} Style:${selectedStylingMethod} Triggers:${(activeTriggers || []).join(',')} Stash:${JSON.stringify((inventory || []).slice(0, 15))}
JSON only:
{"recommendations":[{"name":"Item","domain":"hair|skin|body","category":"Cat","price":"$12.99","numericPrice":12.99,"bestStore":"Store","alsoAt":"Store2","whyItFits":"short reason"}]}`;

      try {
        const rawText = await callGroqChat(apiKey, 'openai/gpt-oss-120b', [{ role: 'user', content: shopPrompt }], 0.25, 650, true);
        return res.status(200).json({ result: parseJsonLoose(rawText) });
      } catch (_) {
        try {
          const rawText = await callGroqChat(apiKey, 'qwen/qwen3.8-27b', [{ role: 'user', content: shopPrompt }], 0.25, 650, true);
          return res.status(200).json({ result: parseJsonLoose(rawText) });
        } catch (__) {
          return res.status(200).json({ result: buildFallbackShopRecs({ shoppingPrefs }) });
        }
      }
    }

    const maxPrice = Number(shoppingPrefs.maxPrice) || 30;
    const stores = Array.isArray(shoppingPrefs.stores) && shoppingPrefs.stores.length
      ? shoppingPrefs.stores.join(', ')
      : 'Any';

    const systemInstructions = `Concise care plan pulling from stash first, recommending items <=$${maxPrice} at [${stores}]. ${lowEnergyMode ? '2 short steps max per routine.' : 'Short steps.'} Single-line JSON only:
{"climateImpact":"1 sentence","rootCauseInsights":[{"cause":"C","fix":"F"}],"hairAssessment":"1 sentence","skinAssessment":"1 sentence","hairRoutine":[{"step":"S","detail":"D","productUsed":"Stash item","essential":true}],"stylingGuide":{"method":"${selectedStylingMethod}","prepAndProtection":"Prep","recommendedProducts":[{"productType":"T","suggestion":"Item","howToUse":"Use"}],"techniqueAndTakedown":"Tip"},"skinRoutine":[{"step":"S","detail":"D","productUsed":"Stash item","essential":true}],"bodyRoutine":[{"step":"S","detail":"D","productUsed":"Stash item","essential":true}],"proTreatments":[{"provider":"Salon|Dermatologist|Esthetician","treatment":"T","why":"W","cadence":"C"}],"missingProducts":[{"name":"N","domain":"hair|skin|body","store":"S","reason":"R","estimatedPrice":"$12.99"}]}`;

    const userPrompt = `Note:${description || 'None'} Mode:${currentHairState} Style:${selectedStylingMethod} Triggers:${(activeTriggers || []).join(',') || 'None'} Profile:${JSON.stringify(profile || {})} Weather:${JSON.stringify(weather || {})} Stash:${JSON.stringify((inventory || []).slice(0, 15))}`;

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
      const rawText = await callGroqChat(apiKey, primaryModel, messages, 0.25, 700, true);
      return res.status(200).json({ result: parseJsonLoose(rawText) });
    } catch (_) {
      try {
        const rawText = await callGroqChat(apiKey, fallbackModel, messages, 0.25, 700, true);
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
