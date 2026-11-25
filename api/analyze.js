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

function buildFallbackRoutine({ currentHairState, selectedStylingMethod, weather, activeTriggers, profile = {}, inventory = [] }) {
  const hairConcerns = [...(profile.hairIssues || []), ...(profile.hairGoals || [])];
  const faceConcerns = [...(profile.faceConcerns || [])];
  const bodyConcerns = [...(profile.bodyConcerns || [])];
  const triggerText = (activeTriggers || []).join(' ').toLowerCase();
  const hairSelected = hairConcerns.length || /hair|scalp|edge|breakage|wig|braid|heat/.test(triggerText);
  const faceSelected = faceConcerns.length || /face|skin|acne|pigment|barrier/.test(triggerText);
  const bodySelected = bodyConcerns.length || /body|chaf|friction|kp|ingrown/.test(triggerText);
  const stash = Array.isArray(inventory) ? inventory : [];
  const findOwned = (domain, pattern) => {
    const item = stash.find(x => String(x.domain || '').toLowerCase() === domain && pattern.test(`${x.category || ''} ${x.name || ''}`));
    return item ? item.name : 'No matching product in your stash yet';
  };
  const wStr = weather && weather.tempF != null
    ? `${weather.tempF}°F, ${weather.humidity ?? '--'}% hum, AQI ${weather.aqi ?? '--'}`
    : 'current weather';
  const result = {
    climateImpact: `Conditions (${wStr}) are context only; product steps are based on your selected concerns.`,
    rootCauseInsights: (activeTriggers || []).slice(0, 3).map(t => ({ cause: t, fix: 'Use the concern-specific steps below; avoid adding unrelated treatments.' })),
    hairAssessment: hairSelected ? `${currentHairState}: routine limited to your selected hair/scalp concerns (${hairConcerns.join(', ') || 'check-in trigger'}).` : '',
    skinAssessment: faceSelected ? `Face routine limited to your selected concerns (${faceConcerns.join(', ') || 'check-in trigger'}).` : '',
    hairRoutine: hairSelected ? [
      { step: 'Wash day — cleanse only when due', detail: 'Use a gentle shampoo appropriate to your scalp and chemical/color history. Do not add a clarifying or protein treatment unless buildup or damage is one of the selected concerns.', productUsed: findOwned('hair', /shampoo|cleanser/i), essential: true },
      { step: 'Condition and detangle', detail: 'Condition after cleansing, detangle in sections with slip, and avoid pulling at fragile edges or the line of demarcation.', productUsed: findOwned('hair', /conditioner|deep conditioner/i), essential: true },
      { step: 'Finish for your selected style', detail: `Use a leave-in or styling product only if it suits ${selectedStylingMethod}; use heat protectant before any direct heat.`, productUsed: findOwned('hair', /leave.?in|heat protectant|mousse|foam|gel/i), essential: false }
    ] : [],
    stylingGuide: { method: selectedStylingMethod, prepAndProtection: 'Do not apply heat without a dedicated heat protectant. Keep tension low around the hairline.', recommendedProducts: [], techniqueAndTakedown: 'Work in sections and remove styles gently; stop any style that causes pain or persistent tension.' },
    skinRoutine: faceSelected ? [
      { step: 'AM — cleanse gently (or rinse)', detail: 'Use a gentle cleanser only if needed; avoid scrubbing or stacking exfoliants.', productUsed: findOwned('skin', /cleanser|wash/i), essential: true },
      { step: 'AM — moisturize and protect', detail: 'Apply a non-irritating moisturizer, then broad-spectrum SPF 30+ every morning. SPF is especially important when treating dark marks.', productUsed: `${findOwned('skin', /moisturizer|cream|lotion/i)}; sunscreen: ${findOwned('skin', /sunscreen|spf/i)}`, essential: true },
      { step: 'PM — targeted treatment only if selected', detail: 'Introduce one targeted active at a time, follow its label, and do not combine multiple exfoliating or irritating actives in the same routine.', productUsed: findOwned('skin', /treatment|serum|retinoid|azelaic|niacinamide|benzoyl/i), essential: false }
    ] : [],
    bodyRoutine: bodySelected ? [
      { step: 'Shower — gentle cleanse', detail: 'Use a mild body cleanser; avoid aggressive scrubbing, especially over irritated or inflamed areas.', productUsed: findOwned('body', /body wash|soap|cleanser/i), essential: true },
      { step: 'After shower — moisturize', detail: 'Apply moisturizer to slightly damp skin. Use a targeted exfoliating lotion only for concerns it is designed to address and according to its label.', productUsed: findOwned('body', /lotion|cream|butter|moisturizer/i), essential: true }
    ] : [],
    proTreatments: [],
    missingProducts: []
  };
  return result;
}

function buildFallbackShopRecs({ shoppingPrefs, profile, activeTriggers, inventory }) {
  const stores = Array.isArray(shoppingPrefs?.stores) ? shoppingPrefs.stores : [];
  const focusLower = String(shoppingPrefs?.focusArea || '').toLowerCase();
  const invNames = new Set((inventory || []).map(x => String((x && typeof x === 'object' ? x.name : x) || '').toLowerCase()));
  const ctx = JSON.stringify({ profile, activeTriggers, focusLower }).toLowerCase();

  let targetDomain = 'all';
  if (focusLower.includes('face') || focusLower.includes('skin')) targetDomain = 'skin';
  else if (focusLower.includes('body')) targetDomain = 'body';
  else if (focusLower.includes('hair') || focusLower.includes('wig') || focusLower.includes('braid') || focusLower.includes('curling') || focusLower.includes('roller')) targetDomain = 'hair';

  const matches = SERVER_CATALOG
    .filter(item => {
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
    .sort((a, b) => b.score - a.score)
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
      const stores = Array.isArray(shoppingPrefs.stores) && shoppingPrefs.stores.length
        ? shoppingPrefs.stores.join(', ')
        : 'Any';
      const focusArea = shoppingPrefs.focusArea || 'Missing essentials';

      const shopPrompt = `Act as a licensed cosmetology-informed textured-hair specialist, esthetician, and dermatologist-informed skincare educator with expertise in Black women's hair and melanin-rich skin. Do not claim to diagnose or replace a clinician. Recommend the most suitable effective products for "${focusArea}" at [${stores}]. Price is secondary: do not exclude a product because it exceeds a saved budget preference. Match the user's actual selected concerns, hair state, porosity, chemical/color history, protective styles, skin type, sensitivities, and stash. Recommend value-conscious options when performance and suitability are comparable, but prioritize fit and results over the lowest price.
NON-NEGOTIABLE RULES:
1) Recommend only products that have a clear purpose for this profile; do not default to the cheapest option; choose the best match for the concern and explain why it is worth considering.
2) Every item in a routine must have a compatible role and layer/order. Do not pair duplicate products doing the same job unnecessarily.
3) Check active ingredient interactions and irritation burden. Do not stack multiple exfoliating acids, retinoids, benzoyl peroxide, strong vitamin C, or other potentially irritating actives without a cautious schedule. Explain separation/alternation where appropriate. Do not describe ingredients as universally incompatible when they can be used safely with suitable scheduling.
4) For melanin-rich skin, prioritize daily broad-spectrum SPF 30+, gentle barrier support, and low-irritation approaches to post-inflammatory hyperpigmentation; do not promise to lighten or bleach natural skin tone.
5) For textured/Black hair, account for shrinkage, dryness, scalp health, traction risk, and chemical services; never recommend tight styles or overlapping relaxer/bleach. Distinguish cosmetic breakage care from medical hair-loss treatment.
6) CRITICAL SET RULE: if you recommend ANY product that belongs to a named brand system/set, recommend EVERY other product in that same set in the same response, including items already owned (mark owned=true) and items to buy (owned=false). Never output a partial set. Do not omit a suitable product or a complete system because of price. Show all set members and identify which are already owned versus needed.
7) Never invent prices, availability, ingredient lists, or product efficacy. Mark uncertain prices as estimates.
Profile:${JSON.stringify(profile || {})} Mode:${currentHairState} Style:${selectedStylingMethod} Triggers:${(activeTriggers || []).join(',')} Stash:${JSON.stringify((inventory || []).slice(0, 30))}
Return JSON only:
{"recommendations":[{"name":"Item","domain":"hair|skin|body","category":"Cat","price":"$12.99","numericPrice":12.99,"bestStore":"Store","alsoAt":"Store2","whyItFits":"reason","setId":"brand-set-id or empty","setName":"complete system name or empty","setTotal":0,"owned":false,"compatibilityNotes":"how it fits and what not to layer with","useOrder":"AM/PM or wash-day order"}],"compatibilitySummary":"brief explanation of why recommendations work together and any actives to alternate","budgetNote":"optional price context; suitability takes priority"}`;

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

    const stores = Array.isArray(shoppingPrefs.stores) && shoppingPrefs.stores.length
      ? shoppingPrefs.stores.join(', ')
      : 'Any';

    const systemInstructions = `Act as a cosmetology-informed textured-hair specialist, esthetician, and dermatologist-informed skincare educator with expertise in Black women's hair and melanin-rich skin. Do not claim to diagnose. Apply evidence-aware hair/scalp care: porosity and product buildup, relaxed/color-treated hair fragility, bond repair vs protein vs moisture, heat protection, traction prevention, and protective-style scalp hygiene. For melanin-rich skin prioritize barrier support, gentle hyperpigmentation care, and daily broad-spectrum SPF 30+. STRICT ROUTINE CONTRACT: first read profile.hairIssues + profile.hairGoals, profile.faceConcerns, and profile.bodyConcerns. Build a routine ONLY for domains with at least one selected concern (or a directly relevant active check-in trigger). Never create a generic hair, face, or body routine just to fill a section. For each selected concern, map each step to a specific need and explain the product's role, order, amount/application area, and frequency. Do not put shampoo in a conditioning step, moisturizer in an SPF step, perfume/deodorant in treatment steps, or one generic product into unrelated steps. If stash has no suitable item, say 'not in stash' and recommend a suitable product in missingProducts; do not pretend an unrelated stash item is suitable. Separate AM/PM and wash-day/styling routines. State which days to use actives and which products must not be layered in the same routine. Do not invent exact ingredient lists, clinical outcomes, or diagnoses. Pull from stash first only when category and purpose genuinely match. Avoid ingredient conflicts and unnecessary duplicate actives; give AM/PM or alternating-day schedules for potentially irritating combinations. Never promise skin bleaching/lightening. Recommend the most suitable products for the user's selected concerns at [${stores}]. Price is secondary and must not act as a hard filter; prioritize suitability, evidence-informed performance, compatibility, and the user's hair/skin profile over the cheapest option. When comparable options exist, mention a good-value choice. CRITICAL: if recommending any member of a named brand set, include every other member of that set in the same plan, including owned products clearly marked as from stash; never return a partial set. ${lowEnergyMode ? 'Use a simplified version of the same relevant routine, not unrelated steps.' : 'Be specific and concise.'} Single-line JSON only:
{"climateImpact":"1 sentence","rootCauseInsights":[{"cause":"C","fix":"F"}],"hairAssessment":"1 sentence","skinAssessment":"1 sentence","hairRoutine":[{"step":"S","detail":"D","productUsed":"Stash item","essential":true}],"stylingGuide":{"method":"${selectedStylingMethod}","prepAndProtection":"Prep","recommendedProducts":[{"productType":"T","suggestion":"Item","howToUse":"Use"}],"techniqueAndTakedown":"Tip"},"skinRoutine":[{"step":"S","detail":"D","productUsed":"Stash item","essential":true}],"bodyRoutine":[{"step":"S","detail":"D","productUsed":"Stash item","essential":true}],"proTreatments":[{"provider":"Salon|Dermatologist|Esthetician","treatment":"T","why":"W","cadence":"C"}],"missingProducts":[{"name":"N","brand":"B","domain":"hair|skin|body","store":"S","reason":"R","estimatedPrice":"$12.99","priority":"essential|optional","forConcern":"selected concern","compatibilityNotes":"safe layering/use notes"}]}`;

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
      const fb = buildFallbackRoutine({ currentHairState, selectedStylingMethod, weather, activeTriggers, profile, inventory });
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
          result: buildFallbackRoutine({ currentHairState, selectedStylingMethod, weather, activeTriggers, profile, inventory })
        });
      }
    }
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error analyzing request' });
  }
}
