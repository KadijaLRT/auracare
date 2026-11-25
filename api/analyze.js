async function callGroqChat(apiKey, model, messages, temperature = 0.2, max_tokens = 650, jsonMode = true) {
  const safeMaxTokens = Math.min(Number(max_tokens) || 550, 650);
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
      const nextCh = cleaned[i + 1] || '';
      if (!/["\\/bfnrtu]/.test(nextCh)) {
        out += '\\\\';
        continue;
      }
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

const SERVER_CATALOG = [
  {
    name: 'Olaplex No. 3 Hair Perfector',
    domain: 'hair',
    category: 'Bond Repair',
    priceNum: 28,
    stores: ['Ulta Beauty', 'Amazon', 'Target'],
    tags: ['breakage', 'color', 'dye', 'bleached', 'relaxed', 'bond', 'repair'],
    whyItFits: 'Rebuilds bonds in chemically treated or color-processed hair.'
  },
  {
    name: "Aunt Jackie's Knot On My Watch Instant Detangling Therapy",
    domain: 'hair',
    category: 'Leave-In / Mist',
    priceNum: 9,
    stores: ['Sally Beauty', 'Target', 'Walmart', 'Ulta Beauty', 'Amazon'],
    tags: ['breakage', 'tangle', 'moisture', 'relaxed', 'edge', 'temple'],
    whyItFits: 'Helps detangle and reduce breakage on relaxed or styled hair.'
  },
  {
    name: 'Mizani Miracle Milk Leave-In Conditioner',
    domain: 'hair',
    category: 'Leave-In / Mist',
    priceNum: 22,
    stores: ['Ulta Beauty', 'Sally Beauty', 'Amazon'],
    tags: ['moisture', 'heat', 'roller', 'curling', 'breakage', 'color'],
    whyItFits: 'Adds moisture, slip, and heat protection before styling.'
  },
  {
    name: 'ORS Olive Oil Sheen Spray',
    domain: 'hair',
    category: 'Oil Sheen',
    priceNum: 8,
    stores: ['Sally Beauty', 'Walmart', 'CVS', 'Walgreens', 'Amazon'],
    tags: ['sheen', 'shine', 'dull', 'dry', 'roller', 'curling', 'wig', 'braid'],
    whyItFits: 'Adds lightweight shine without heavy buildup.'
  },
  {
    name: 'CeraVe Hydrating Facial Cleanser',
    domain: 'skin',
    category: 'Face Cleanser',
    priceNum: 16,
    stores: ['Target', 'Walmart', 'CVS', 'Walgreens', 'Ulta Beauty', 'Amazon'],
    tags: ['dry', 'sensitive', 'barrier', 'face', 'cleanser'],
    whyItFits: 'Gentle non-foaming cleanser with ceramides for barrier care.'
  },
  {
    name: 'AmLactin Daily Moisturizing Body Lotion',
    domain: 'body',
    category: 'Body Lotion / Cream',
    priceNum: 18,
    stores: ['Target', 'Walmart', 'CVS', 'Walgreens', 'Amazon'],
    tags: ['rough', 'kp', 'bumps', 'ingrown', 'body', 'dry'],
    whyItFits: 'Smooths rough or bumpy body skin and supports hydration.'
  }
];

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

function buildFallbackShopRecs({ shoppingPrefs, profile, activeTriggers, inventory }) {
  const maxPrice = Number(shoppingPrefs?.maxPrice) || 30;
  const stores = Array.isArray(shoppingPrefs?.stores) ? shoppingPrefs.stores : [];
  const focusLower = String(shoppingPrefs?.focusArea || '').toLowerCase();
  const invNames = new Set((inventory || []).map(x => String(x || '').toLowerCase()));
  const ctx = JSON.stringify({ profile, activeTriggers, focusLower }).toLowerCase();

  let targetDomain = 'all';
  if (focusLower.includes('face') || focusLower.includes('skin')) targetDomain = 'skin';
  else if (focusLower.includes('body')) targetDomain = 'body';
  else if (focusLower.includes('hair') || focusLower.includes('wig') || focusLower.includes('braid') || focusLower.includes('curling') || focusLower.includes('roller')) targetDomain = 'hair';

  const matches = SERVER_CATALOG
    .filter(item => {
      if (item.priceNum > maxPrice) return false;
      if (invNames.has(item.name.toLowerCase())) return false;
      if (targetDomain !== 'all' && item.domain !== targetDomain) return false;
      return true;
    })
    .map(item => {
      let score = 0;
      if (stores.some(s => item.stores.map(x => x.toLowerCase()).includes(s.toLowerCase()))) score += 3;
      item.tags.forEach(t => { if (ctx.includes(t)) score += 2; });
      return { item, score };
    })
    .sort((a, b) => b.score - a.score || a.item.priceNum - b.item.priceNum)
    .slice(0, 4)
    .map(({ item }) => {
      const bestStore = stores.find(s => item.stores.map(x => x.toLowerCase()).includes(s.toLowerCase())) || item.stores[0] || 'Target';
      const alsoAt = item.stores.filter(s => s.toLowerCase() !== bestStore.toLowerCase()).slice(0, 2).join(', ');
      return {
        name: item.name,
        domain: item.domain,
        category: item.category,
        price: `$${item.priceNum.toFixed(2)}`,
        numericPrice: item.priceNum,
        bestStore,
        alsoAt,
        whyItFits: item.whyItFits
      };
    });

  return { recommendations: matches };
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
{"name":"Brand & Name","brand":"Brand","domain":"hair|skin|body","category":"Bond Repair|Clarifying / Chelating Shampoo|Conditioner|Deep Conditioner|Edge Control / Wax|Hair Dye|Hair Gel|Hair Oil / Sealant|Hair Relaxer|Heat Protectant|Leave-In / Mist|Moisturizer|Oil Sheen|Protein Treatment|Setting Mousse / Foam / Lotion|Shampoo|Wig / Braid Scalp & Edge Care|Face Cleanser|Face Moisturizer|Face Treatment|Sunscreen|Body Butter|Body Lotion / Cream|Body Oil|Body Powder / Dusting Powder|Body Scrub / Exfoliant|Body Wash / Bar Soap|Deodorant|Perfume / Scents|Other","keyIngredients":["ing1","ing2"],"safetyNote":"short note"}`;

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

    if (mode === 'product_name') {
      const prodQuery = String(description || '').trim();
      if (!prodQuery) return res.status(400).json({ error: 'No product name provided.' });

      const namePrompt = `Identify the exact personal care product "${prodQuery.replace(/"/g, '')}" (hair, face, or body). If unsure of exact brand/ingredients, return empty strings/arrays rather than guessing an unrelated product. Return compact JSON only (no newlines in strings):
{"name":"${prodQuery.replace(/"/g, '')}","brand":"Exact brand or empty string","domain":"hair|skin|body","category":"Bond Repair|Clarifying / Chelating Shampoo|Conditioner|Deep Conditioner|Edge Control / Wax|Hair Dye|Hair Gel|Hair Oil / Sealant|Hair Relaxer|Heat Protectant|Leave-In / Mist|Moisturizer|Oil Sheen|Protein Treatment|Setting Mousse / Foam / Lotion|Shampoo|Wig / Braid Scalp & Edge Care|Face Cleanser|Face Moisturizer|Face Treatment|Sunscreen|Body Butter|Body Lotion / Cream|Body Oil|Body Powder / Dusting Powder|Body Scrub / Exfoliant|Body Wash / Bar Soap|Deodorant|Perfume / Scents|Other","keyIngredients":[],"safetyNote":"concise usage/chemistry note or empty string"}`;

      try {
        const rawText = await callGroqChat(apiKey, 'openai/gpt-oss-120b', [{ role: 'user', content: namePrompt }], 0.2, 350, true);
        return res.status(200).json({ result: parseJsonLoose(rawText) });
      } catch (_) {
        return res.status(200).json({
          result: { name: prodQuery, brand: '', domain: 'hair', category: 'Other', keyIngredients: [], safetyNote: 'Matched by entered product name.' }
        });
      }
    }

    if (mode === 'shop_recs') {
      const maxPrice = Number(shoppingPrefs.maxPrice) || 30;
      const stores = Array.isArray(shoppingPrefs.stores) && shoppingPrefs.stores.length
        ? shoppingPrefs.stores.join(', ')
        : 'Any';
      const focusArea = shoppingPrefs.focusArea || 'Missing essentials';

      const shopPrompt = `Expert Black hair & skin chemist: recommend 3-4 compatible, non-clashing items <=$${maxPrice} at [${stores}] for "${focusArea}" matching hair porosity, chemical/color history (relaxed/dyed/bleached/natural), protective styles, and brand sets in stash.
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
          return res.status(200).json({ result: buildFallbackShopRecs({ shoppingPrefs, profile, activeTriggers, inventory }) });
        }
      }
    }

    const maxPrice = Number(shoppingPrefs.maxPrice) || 30;
    const stores = Array.isArray(shoppingPrefs.stores) && shoppingPrefs.stores.length
      ? shoppingPrefs.stores.join(', ')
      : 'Any';

    const systemInstructions = `Expert Black hair trichologist & cosmetic chemist. Apply Type 3/4 elliptical-shaft sebum science, porosity/LCO-LOC layering, pH balance (4.5-5.5 after relaxer/color), disulfide bond repair (Olaplex/acidic bonding) vs hydrolyzed protein vs humectant/dew-point rules, chelating hard-water ions (EDTA/phytic acid), and wig/braid scalp care. Pull from stash first, never claim stash items are missing unless absent, pair full brand sets when owned (Olaplex No.0->3->4->5->6/7, Aunt Jackie's, ApHogee, Mizani, KeraCare, Design Essentials, Camille Rose, Mielle, CeraVe), avoid clashing products, and recommend compatible items <=${maxPrice} at [${stores}]. ${lowEnergyMode ? '2 short steps max per routine.' : 'Short steps.'} Single-line JSON only:
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

    const normalizeRoutinePayload = (parsed) => {
      const fb = buildFallbackRoutine({ currentHairState, selectedStylingMethod, weather, activeTriggers });
      if (!parsed || typeof parsed !== 'object') return fb;
      const cleanSteps = (arr, fbArr) => {
        const list = Array.isArray(arr) ? arr.filter(x => x && (x.step || x.detail)) : [];
        if (!list.length) return fbArr;
        return list.map((item, idx) => {
          const def = fbArr[idx] || fbArr[0];
          const prod = String(item.productUsed || '').trim();
          return {
            step: String(item.step || def.step).trim(),
            detail: String(item.detail || def.detail).trim(),
            productUsed: (!prod || /^none\b/i.test(prod)) ? def.productUsed : prod,
            essential: Boolean(item.essential !== undefined ? item.essential : def.essential)
          };
        });
      };
      return {
        ...fb,
        ...parsed,
        hairRoutine: cleanSteps(parsed.hairRoutine, fb.hairRoutine),
        skinRoutine: cleanSteps(parsed.skinRoutine, fb.skinRoutine),
        bodyRoutine: cleanSteps(parsed.bodyRoutine, fb.bodyRoutine),
        missingProducts: Array.isArray(parsed.missingProducts) ? parsed.missingProducts : fb.missingProducts
      };
    };

    try {
      const rawText = await callGroqChat(apiKey, primaryModel, messages, 0.25, 650, true);
      return res.status(200).json({ result: normalizeRoutinePayload(parseJsonLoose(rawText)) });
    } catch (_) {
      try {
        const rawText = await callGroqChat(apiKey, fallbackModel, messages, 0.25, 650, true);
        return res.status(200).json({ result: normalizeRoutinePayload(parseJsonLoose(rawText)) });
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
