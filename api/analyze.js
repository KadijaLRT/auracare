async function callGroqChat(apiKey, model, messages, temperature = 0.2, max_tokens = 900) {
  const safeMaxTokens = Math.min(Number(max_tokens) || 900, 950);
  const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: safeMaxTokens,
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
      return JSON.parse(cleaned.slice(startIdx, endIdx + 1));
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

      const visionPrompt = `Read this product label/barcode photo and return ONLY compact JSON (no <think>, no markdown):
{"name":"Brand & Product Name","brand":"Brand","domain":"hair|skin|body","category":"Bond Repair|Shampoo|Conditioner|Clarifying / Chelating Shampoo|Deep Conditioner|Protein Treatment|Hair Relaxer|Moisturizer|Leave-In / Mist|Hair Oil / Sealant|Oil Sheen|Heat Protectant|Setting Mousse / Foam / Lotion|Edge Control / Wax|Wig / Braid Scalp & Edge Care|Face Cleanser|Face Treatment|Face Moisturizer|Sunscreen|Body Wash / Bar Soap|Body Scrub / Exfoliant|Body Lotion / Cream|Body Butter|Body Oil|Body Powder / Dusting Powder|Other","keyIngredients":["ing1","ing2"],"safetyNote":"1 short note for profile"}`;

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
        850
      );

      return res.status(200).json({ result: parseJsonLoose(rawText) });
    }

    if (mode === 'shop_recs') {
      const maxPrice = Number(shoppingPrefs.maxPrice) || 30;
      const stores = Array.isArray(shoppingPrefs.stores) && shoppingPrefs.stores.length
        ? shoppingPrefs.stores.join(', ')
        : 'Any store';
      const focusArea = shoppingPrefs.focusArea || 'All missing hair, face & body essentials';

      const shopPrompt = `Recommend 5 specific products <=$${maxPrice} at [${stores}] for focus "${focusArea}".
Profile: ${JSON.stringify(profile || {})}
Hair mode: ${currentHairState} | Styling: ${selectedStylingMethod} | Triggers: ${(activeTriggers || []).join(', ')}
Weather/AQI: ${JSON.stringify(weather || {})}
Owned stash (skip duplicates): ${JSON.stringify((inventory || []).map(i => i.name))}
Return ONLY compact JSON:
{"recommendations":[{"name":"Brand Product","domain":"hair|skin|body","category":"Category","price":"$14.99","numericPrice":14.99,"bestStore":"Store","alsoAt":"Store2","whyItFits":"1 short reason"}]}`;

      let rawText;
      try {
        rawText = await callGroqChat(apiKey, 'openai/gpt-oss-120b', [{ role: 'user', content: shopPrompt }], 0.3, 950);
      } catch (_) {
        rawText = await callGroqChat(apiKey, 'qwen/qwen3.8-27b', [{ role: 'user', content: shopPrompt }], 0.3, 950);
      }

      return res.status(200).json({ result: parseJsonLoose(rawText) });
    }

    const maxPrice = Number(shoppingPrefs.maxPrice) || 30;
    const stores = Array.isArray(shoppingPrefs.stores) && shoppingPrefs.stores.length
      ? shoppingPrefs.stores.join(', ')
      : 'Any store';

    const systemInstructions = `Build a concise Hair, Face & Body care plan from the user's profile, check-in, stash, triggers, and weather/AQI without assuming unstated traits. Max price per item: $${maxPrice}. Stores: ${stores}. ${lowEnergyMode ? 'Keep routines to 2 short steps each.' : 'Keep each step brief and actionable.'}
Return ONLY compact JSON:
{"climateImpact":"1-2 sentences","rootCauseInsights":[{"cause":"Cause","fix":"1 short fix"}],"hairAssessment":"1 sentence","skinAssessment":"1 sentence","hairRoutine":[{"step":"Step","detail":"Brief action","productUsed":"Stash item or step","essential":true}],"stylingGuide":{"method":"${selectedStylingMethod}","prepAndProtection":"Brief prep","recommendedProducts":[{"productType":"Type","suggestion":"Product <=$${maxPrice}","howToUse":"Brief tip"}],"techniqueAndTakedown":"Brief tip"},"skinRoutine":[{"step":"Step","detail":"Brief action","productUsed":"Stash item or step","essential":true}],"bodyRoutine":[{"step":"Step","detail":"Brief wash/lotion/butter/oil/powder action","productUsed":"Stash item or step","essential":true}],"proTreatments":[{"provider":"Salon|Dermatologist|Esthetician","treatment":"Service","why":"Brief reason","cadence":"Cadence"}],"missingProducts":[{"name":"Product","domain":"hair|skin|body","store":"Store","reason":"Brief reason","estimatedPrice":"$14.99"}]}`;

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

    let rawText;
    try {
      rawText = await callGroqChat(apiKey, primaryModel, messages, 0.3, 950);
    } catch (_) {
      rawText = await callGroqChat(apiKey, fallbackModel, messages, 0.3, 950);
    }

    return res.status(200).json({ result: parseJsonLoose(rawText) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error analyzing request' });
  }
}
