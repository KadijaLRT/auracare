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

const CATEGORY_DOMAIN = Object.freeze({
  'Bond Repair':'hair', 'Clarifying / Chelating Shampoo':'hair', 'Conditioner':'hair', 'Deep Conditioner':'hair', 'Edge Control / Wax':'hair', 'Hair Dye':'hair', 'Hair Gel':'hair', 'Hair Oil / Sealant':'hair', 'Hair Relaxer':'hair', 'Heat Protectant':'hair', 'Leave-In / Mist':'hair', 'Hair Moisturizer':'hair', 'Moisturizer':'hair', 'Oil Sheen':'hair', 'Protein Treatment':'hair', 'Setting Mousse / Foam / Lotion':'hair', 'Shampoo':'hair', 'Wig / Braid Scalp & Edge Care':'hair',
  'Face Cleanser':'skin', 'Face Moisturizer':'skin', 'Face Treatment':'skin', 'Sunscreen':'skin',
  'Body Butter':'body', 'Body Lotion / Cream':'body', 'Body Oil':'body', 'Body Powder / Dusting Powder':'body', 'Body Scrub / Exfoliant':'body', 'Body Wash / Bar Soap':'body', 'Deodorant':'body', 'Perfume / Scents':'body'
});
function normalizeInventoryDomain(item) {
  const categoryDomain = CATEGORY_DOMAIN[String(item?.category || '').trim()];
  if (!categoryDomain || item.domain !== categoryDomain) return { ...item, domain: 'unclassified' };
  return { ...item, domain: categoryDomain };
}
function normalizeRecommendation(item) {
  if (!item || typeof item !== 'object') return null;
  const category = String(item.category || '').trim();
  const domain = CATEGORY_DOMAIN[category];
  if (!domain || item.domain !== domain) return null;
  return { ...item, domain, category };
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

function buildFallbackRoutine({ currentHairState, selectedStylingMethod, weather, activeTriggers, checkInNote = "", profile = {}, inventory = [] }) {
  const hairConcerns = [...(profile.hairIssues || []), ...(profile.hairGoals || [])];
  const faceConcerns = [...(profile.faceConcerns || [])];
  const bodyConcerns = [...(profile.bodyConcerns || [])];
  const triggerText = [...(activeTriggers || []), checkInNote].join(' ').toLowerCase();
  const hairSelected = hairConcerns.length || /hair|scalp|edge|breakage|wig|braid|heat/.test(triggerText);
  const faceSelected = faceConcerns.length || /face|acne|pigment|barrier/.test(triggerText);
  const bodySelected = bodyConcerns.length || /body|chaf|friction|kp|ingrown/.test(triggerText);
  const stash = Array.isArray(inventory) ? inventory : [];
  const findOwned = (domain, pattern) => {
    const item = stash.find(x => String(x.domain || '').toLowerCase() === domain && CATEGORY_DOMAIN[String(x.category || '').trim()] === domain && pattern.test(String(x.category || '')));
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
      { step: 'Wash day — cleanse only when due', detail: 'Use a gentle shampoo appropriate to your scalp and chemical/color history. Do not add a clarifying or protein treatment unless buildup or damage is one of the selected concerns.', productUsed: findOwned('hair', /Shampoo|Clarifying \/ Chelating Shampoo/i), essential: true },
      { step: 'Condition and detangle', detail: 'Condition after cleansing, detangle in sections with slip, and avoid pulling at fragile edges or the line of demarcation.', productUsed: findOwned('hair', /Conditioner|Deep Conditioner/i), essential: true },
      { step: 'Finish for your selected style', detail: `Use a leave-in or styling product only if it suits ${selectedStylingMethod}; use heat protectant before any direct heat.`, productUsed: findOwned('hair', /Leave-In \/ Mist|Hair Moisturizer|Moisturizer|Heat Protectant|Setting Mousse \/ Foam \/ Lotion|Hair Gel/i), essential: false }
    ] : [],
    stylingGuide: { method: selectedStylingMethod, prepAndProtection: 'Do not apply heat without a dedicated heat protectant. Keep tension low around the hairline.', recommendedProducts: [], techniqueAndTakedown: 'Work in sections and remove styles gently; stop any style that causes pain or persistent tension.' },
    skinRoutine: faceSelected ? [
      { step: 'AM — cleanse gently (or rinse)', detail: 'Use a gentle cleanser only if needed; avoid scrubbing or stacking exfoliants.', productUsed: findOwned('skin', /Face Cleanser/i), essential: true },
      { step: 'AM — moisturize and protect', detail: 'Apply a non-irritating moisturizer, then broad-spectrum SPF 30+ every morning. SPF is especially important when treating dark marks.', productUsed: `${findOwned('skin', /Face Moisturizer/i)}; sunscreen: ${findOwned('skin', /Sunscreen/i)}`, essential: true },
      { step: 'PM — targeted treatment only if selected', detail: 'Introduce one targeted active at a time, follow its label, and do not combine multiple exfoliating or irritating actives in the same routine.', productUsed: findOwned('skin', /treatment|serum|retinoid|azelaic|niacinamide|benzoyl/i), essential: false }
    ] : [],
    bodyRoutine: bodySelected ? [
      { step: 'Shower — gentle cleanse', detail: 'Use a mild body cleanser; avoid aggressive scrubbing, especially over irritated or inflamed areas.', productUsed: findOwned('body', /Body Wash \/ Bar Soap/i), essential: true },
      { step: 'After shower — moisturize', detail: 'Apply moisturizer to slightly damp skin. Use a targeted exfoliating lotion only for concerns it is designed to address and according to its label.', productUsed: findOwned('body', /Body Butter|Body Lotion \/ Cream|Body Oil/i), essential: true }
    ] : [],
    proTreatments: [],
    missingProducts: []
  };
  return result;
}

function buildFallbackShopRecs({ shoppingPrefs, profile, activeTriggers, checkInNote = "", inventory }) {
  const stores = Array.isArray(shoppingPrefs?.stores) ? shoppingPrefs.stores : [];
  const focusLower = String(shoppingPrefs?.focusArea || '').toLowerCase();
  const invNames = new Set((inventory || []).map(x => String((x && typeof x === 'object' ? x.name : x) || '').toLowerCase()));
  const ctx = JSON.stringify({ profile, activeTriggers, checkInNote, focusLower }).toLowerCase();

  let targetDomain = 'all';
  if (focusLower.includes('face') || focusLower.includes('skin')) targetDomain = 'skin';
  else if (focusLower.includes('body')) targetDomain = 'body';
  else if (focusLower.includes('hair') || focusLower.includes('wig') || focusLower.includes('braid') || focusLower.includes('curling') || focusLower.includes('roller')) targetDomain = 'hair';

  const checkinText = `${JSON.stringify(activeTriggers || [])} ${checkInNote || ''}`.toLowerCase();
  const selectedDomains = new Set();
  if ((profile?.hairIssues || []).length || (profile?.hairGoals || []).length || /hair|scalp|edge|breakage|wig|braid|heat|thinning|shed|brittle/.test(checkinText)) selectedDomains.add('hair');
  if ((profile?.faceConcerns || []).length || /face|skin|acne|break.?out|pimple|blemish|pigment|barrier|dark spot|forehead|cheek|complexion|dry patch/.test(checkinText)) selectedDomains.add('skin');
  if ((profile?.bodyConcerns || []).length || /body|chaf|friction|kp|ingrown|rough skin|arms|legs|body bump/.test(checkinText)) selectedDomains.add('body');

  const matches = SERVER_CATALOG
    .filter(item => {
      if (invNames.has(item.name.toLowerCase())) return false;
      if (targetDomain !== 'all' && item.domain !== targetDomain) return false;
      if (targetDomain === 'all' && selectedDomains.size && !selectedDomains.has(item.domain)) return false;
      if (targetDomain === 'all' && !selectedDomains.size) return false;
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
      checkInNote = '',
      checkInTriggers = [],
      lastCheckIn = null,
      activeTriggers = [],
      currentHairState = 'Relaxed Hair (Out / Styled)',
      selectedStylingMethod = 'None / Air Dry / Protective Set',
      imageBase64 = null,
      profile = {},
      weather = {},
      inventory = [],
      lowEnergyMode = false,
      shoppingPrefs = {},
      existingDomain = 'hair',
      existingCategory = 'Other'
    } = req.body || {};
    inventory = (Array.isArray(inventory) ? inventory : []).map(normalizeInventoryDomain);
    const effectiveCheckInNote = String(checkInNote || description || lastCheckIn?.note || '').slice(0, 600);
    const effectiveTriggers = [...new Set([
      ...(Array.isArray(activeTriggers) ? activeTriggers : []),
      ...(Array.isArray(checkInTriggers) ? checkInTriggers : []),
      ...(Array.isArray(lastCheckIn?.triggers) ? lastCheckIn.triggers : [])
    ])].slice(0, 12);

    if (mode === 'product_photo') {
      if (!imageBase64) return res.status(400).json({ error: 'No product photo provided.' });

      const visionPrompt = `Read product label and return compact JSON (no newlines in strings). If the label is a perfume, eau de parfum, eau de toilette, cologne, body mist, or fragrance oil, set domain="body" and category="Perfume / Scents". Do not classify a fragrance as hair or skincare:
{"name":"Brand & Name","brand":"Brand","domain":"hair|skin|body","category":"Bond Repair|Clarifying / Chelating Shampoo|Conditioner|Deep Conditioner|Edge Control / Wax|Hair Dye|Hair Gel|Hair Oil / Sealant|Hair Relaxer|Heat Protectant|Leave-In / Mist|Hair Moisturizer|Moisturizer|Oil Sheen|Protein Treatment|Setting Mousse / Foam / Lotion|Shampoo|Wig / Braid Scalp & Edge Care|Face Cleanser|Face Moisturizer|Face Treatment|Sunscreen|Body Butter|Body Lotion / Cream|Body Oil|Body Powder / Dusting Powder|Body Scrub / Exfoliant|Body Wash / Bar Soap|Deodorant|Perfume / Scents|Other","keyIngredients":["ing1","ing2"],"safetyNote":"short note"}`;

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

      const parsed = parseJsonLoose(rawText);
      const category = String(parsed.category || 'Other').trim();
      const categoryDomain = CATEGORY_DOMAIN[category];
      const ambiguousLegacyMoisturizer = category === 'Moisturizer' && parsed.domain !== 'hair';
      return res.status(200).json({ result: {
        ...parsed,
        category: categoryDomain && !ambiguousLegacyMoisturizer ? category : 'Other',
        domain: categoryDomain && !ambiguousLegacyMoisturizer ? categoryDomain : 'unclassified'
      }});
    }

    if (mode === 'product_name') {
      const prodQuery = String(description || '').trim().slice(0, 160);
      if (!prodQuery) return res.status(400).json({ error: 'Enter a product name before looking it up.' });

      const safeQuery = prodQuery.replace(/["\\]/g, ' ').replace(/[\r\n]/g, ' ').trim();
      const namePrompt = `Identify the real personal-care product (hair care, skincare, body care, deodorant, or fragrance/perfume) from its user-entered name.
Query: "${safeQuery}"
Existing domain/category: ${existingDomain}/${existingCategory}
Rules:
- Do not use generic category "Moisturizer" for facial or body products. Use "Face Moisturizer" for face products, "Body Lotion / Cream" or "Body Butter" for body products, and "Hair Moisturizer" for hair products. If domain or purpose is uncertain, return domain="unclassified" and category="Other".
- If you recognize this real commercial product (including well-known Black hair care lines like Aunt Jackie's, Olaplex, ApHogee, Mizani, KeraCare, Design Essentials, Camille Rose, Mielle, ORS, SheaMoisture, Eco Style, Ebin, TGIN, As I Am, Pattern, Carol's Daughter, or well-known skincare/body/perfume products), set "matched": true, set "confidence" between 0.80 and 0.99, fill in the real "brand", best matching "domain" ("hair"|"skin"|"body"), best matching "category" from ["Bond Repair","Clarifying / Chelating Shampoo","Conditioner","Deep Conditioner","Edge Control / Wax","Hair Dye","Hair Gel","Hair Oil / Sealant","Hair Relaxer","Heat Protectant","Leave-In / Mist","Moisturizer","Oil Sheen","Protein Treatment","Setting Mousse / Foam / Lotion","Shampoo","Wig / Braid Scalp & Edge Care","Face Cleanser","Face Moisturizer","Face Treatment","Sunscreen","Body Butter","Body Lotion / Cream","Body Oil","Body Powder / Dusting Powder","Body Scrub / Exfoliant","Body Wash / Bar Soap","Deodorant","Perfume / Scents","Other"], up to 5 verified "keyIngredients" (or fragrance notes if it is a Perfume / Scents product), and a concise "safetyNote" (or scent family/usage note).
- Only if the query is completely unrecognized, homemade/DIY, or ambiguous across unrelated products, set "matched": false and "confidence": 0.
Return compact single-line JSON only:
{"matched":true,"confidence":0.92,"name":"${safeQuery}","brand":"Brand Name","domain":"${existingDomain}","category":"${existingCategory}","keyIngredients":["Ingredient 1","Ingredient 2"],"safetyNote":"Concise chemistry/usage or scent note"}`;

      const formatProductNameResult = (rawText) => {
        const result = parseJsonLoose(rawText);
        const confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0));
        const matched = result.matched === true && confidence >= 0.72;
        const category = String(result.category || existingCategory).trim();
        const categoryDomain = CATEGORY_DOMAIN[category];
        const ambiguousLegacyMoisturizer = category === 'Moisturizer' && result.domain !== 'hair';
        const validClassification = Boolean(categoryDomain && !ambiguousLegacyMoisturizer);
        return {
          matched,
          confidence: matched ? confidence : 0,
          name: prodQuery,
          brand: matched ? String(result.brand || '').slice(0, 80) : '',
          domain: matched ? (validClassification ? categoryDomain : 'unclassified') : existingDomain,
          category: matched ? (validClassification ? category.slice(0, 80) : 'Other') : existingCategory,
          keyIngredients: matched && Array.isArray(result.keyIngredients) ? result.keyIngredients.filter(x => typeof x === 'string').slice(0, 5) : [],
          safetyNote: matched ? String(result.safetyNote || '').slice(0, 240) : ''
        };
      };

      try {
        const rawText = await callGroqChat(apiKey, 'openai/gpt-oss-120b', [{ role: 'user', content: namePrompt }], 0.1, 320, true);
        return res.status(200).json({ result: formatProductNameResult(rawText) });
      } catch (_) {
        try {
          const rawText = await callGroqChat(apiKey, 'qwen/qwen3.8-27b', [{ role: 'user', content: namePrompt }], 0.1, 320, true);
          return res.status(200).json({ result: formatProductNameResult(rawText) });
        } catch (__) {
          return res.status(200).json({ result: { matched: false, confidence: 0, name: prodQuery, brand: '', domain: existingDomain, category: existingCategory, keyIngredients: [], safetyNote: '' } });
        }
      }
    }

    if (mode === 'scent_profile_from_stash') {
      const fragrances = (Array.isArray(req.body?.fragrances) ? req.body.fragrances : [])
        .filter(x => x && typeof x === 'object' && String(x.name || '').trim())
        .slice(0, 30)
        .map(x => ({
          name: String(x.name || '').slice(0, 120),
          brand: String(x.brand || '').slice(0, 80),
          category: String(x.category || 'Perfume / Scents').slice(0, 60),
          notes: String(x.notes || '').slice(0, 300)
        }));
      if (!fragrances.length) {
        return res.status(200).json({ result: { families: [], notes: [], summary: 'Add fragrances to My Stash to begin building your scent profile.', fragranceCount: 0 } });
      }
      const scentAnalysisPrompt = `You are analyzing the user's OWN fragrance collection to infer their likely scent preferences. Do not recommend products. Analyze only the fragrance names, brands, categories, and user-entered/lookup notes supplied. Identify scent families and notes only when you have reliable knowledge of the exact fragrance or the notes are explicitly present in the supplied notes. Product names can be ambiguous; do not guess. Do not infer a disliked note merely because it is absent. Do not infer occasion, projection, longevity, or concentration unless explicitly stated in the data. Weight repeated patterns across multiple fragrances more strongly than a single item. Return only compact JSON with family names chosen from: Gourmand, Vanilla / Amber, Warm & Spicy, Woody, Musky, Floral, Fruity, Fresh / Citrus, Clean / Soapy, Aquatic, Green / Herbal, Powdery, Sweet / Creamy. Notes should be concise, common fragrance note names, max 12. Keep uncertain/unknown products out of the inferred profile. The summary must explain the strongest recurring patterns and disclose when the sample is too small or product details are uncertain. JSON schema: {"families":["Gourmand"],"notes":["Vanilla","Amber"],"summary":"Short evidence-based summary"}. Fragrances: ${JSON.stringify(fragrances)}`;
      try {
        const rawText = await callGroqChat(apiKey, 'openai/gpt-oss-120b', [{ role: 'user', content: scentAnalysisPrompt }], 0.1, 400, true);
        const parsed = parseJsonLoose(rawText);
        const allowedFamilies = ['Gourmand', 'Vanilla / Amber', 'Warm & Spicy', 'Woody', 'Musky', 'Floral', 'Fruity', 'Fresh / Citrus', 'Clean / Soapy', 'Aquatic', 'Green / Herbal', 'Powdery', 'Sweet / Creamy'];
        const families = [...new Set((Array.isArray(parsed.families) ? parsed.families : []).filter(x => allowedFamilies.includes(String(x))))].slice(0, 8);
        const notes = [...new Set((Array.isArray(parsed.notes) ? parsed.notes : []).map(x => String(x || '').trim()).filter(x => x && x.length <= 40))].slice(0, 12);
        return res.status(200).json({ result: {
          families,
          notes,
          summary: String(parsed.summary || 'Inferred from the fragrance details available in My Stash.').slice(0, 400),
          fragranceCount: fragrances.length
        }});
      } catch (_) {
        return res.status(200).json({ result: {
          families: [], notes: [],
          summary: 'The fragrance details could not be identified reliably yet. Add a brand or product notes, then refresh the profile.',
          fragranceCount: fragrances.length
        }});
      }
    }

    if (mode === 'shop_recs') {
      const stores = Array.isArray(shoppingPrefs.stores) && shoppingPrefs.stores.length
        ? shoppingPrefs.stores.join(', ')
        : 'Any';
      const focusArea = shoppingPrefs.focusArea || 'Missing essentials';
      const scentFocus = /scent|fragrance|perfume|cologne|body mist/i.test(String(focusArea));
      const scentRetailers = ['Burlington Coat Factory', 'Scentbird', 'Bath & Body Works', 'Amazon'];
      const recommendationStores = scentFocus ? scentRetailers.join(', ') : stores;
      const scentBudget = Math.max(1, Number(shoppingPrefs.scentBudget || profile?.scentBudget || 30));
      const scentDerived = profile?.scentDerived && typeof profile.scentDerived === 'object' ? profile.scentDerived : {};
      const scentProfile = {
        families: [...new Set([...(profile?.scentFamilies || []), ...(scentDerived.families || [])])],
        notes: [...new Set([...(profile?.scentNotes || []), ...(scentDerived.notes || [])])],
        occasions: profile?.scentOccasions || [], intensity: profile?.scentIntensity || '',
        likes: profile?.scentLikes || '', avoid: profile?.scentAvoid || '',
        learnedFromCollection: scentDerived.summary || '',
        fragranceCountInStash: Number(scentDerived.fragranceCount || 0)
      };

      const shopPrompt = `Act as a licensed cosmetology-informed textured-hair specialist, esthetician, and dermatologist-informed skincare educator with expertise in Black women's hair and melanin-rich skin. Do not claim to diagnose or replace a clinician. Recommend the most suitable effective products for "${focusArea}" at [${recommendationStores}]. ${scentFocus ? `FRAGRANCE MODE: Build recommendations from the user's personal scent profile, including patterns inferred from the fragrances they already own in My Stash. Treat explicitly selected preferences as direct preferences and stash-derived patterns as evidence-based signals, not absolute rules. Preferred retailers are Burlington Coat Factory, Scentbird, Bath & Body Works, and Amazon; include options across these stores when suitable, but do not force an unsuitable item merely to represent every store. Treat Burlington assortment as variable, Scentbird as fragrance discovery/subscription, Bath & Body Works as body-mist/fragrance, and Amazon as a broad marketplace where seller authenticity matters. HARD BUDGET CAP: Each recommended fragrance must cost no more than $${scentBudget} per item. Do not include an item over budget. Return only items with a plausible price estimate and numericPrice <= ${scentBudget}; if you cannot responsibly estimate a price within budget, omit it. Prices and availability are not live-verified; label prices as estimates and never claim in-stock status. Scent profile to honor: ${JSON.stringify(scentProfile)}. Use family/notes/likes/avoid/intensity/occasion to infer a coherent scent direction, explain the match, distinguish perfume/EDP/EDT/body mist/oil, and avoid suggesting notes/styles the user explicitly dislikes. If the profile is sparse, state the provisional nature of the profile rather than inventing preferences. Do not mix fragrance recommendations into hair/skin treatment steps.` : ''} Use the saved profile AND current/saved Check-In note and triggers together. Only recommend for concern areas actually selected in the profile or directly supported by the Check-In; do not fill every category when no concern is selected. Exclude every product already in Stash from purchase recommendations. ${scentFocus ? `The fragrance budget cap of $${scentBudget} is mandatory and overrides the general price guidance.` : 'Price is secondary: do not exclude a product because it exceeds a saved budget preference.'} Match the user's complete saved profile AND current/saved Check-In note and triggers, hair state, porosity, chemical/color history, protective styles, skin type, sensitivities, preferences, and stash. Recommend value-conscious options when performance and suitability are comparable, but prioritize fit and results over the lowest price.
NON-NEGOTIABLE RULES:
1) Recommend only products that have a clear purpose for this profile; do not default to the cheapest option; choose the best match for the concern and explain why it is worth considering.
2) Every item in a routine must have a compatible role and layer/order. Do not pair duplicate products doing the same job unnecessarily.
3) Check active ingredient interactions and irritation burden. Do not stack multiple exfoliating acids, retinoids, benzoyl peroxide, strong vitamin C, or other potentially irritating actives without a cautious schedule. Explain separation/alternation where appropriate. Do not describe ingredients as universally incompatible when they can be used safely with suitable scheduling.
4) For melanin-rich skin, prioritize daily broad-spectrum SPF 30+, gentle barrier support, and low-irritation approaches to post-inflammatory hyperpigmentation; do not promise to lighten or bleach natural skin tone.
5) For textured/Black hair, account for shrinkage, dryness, scalp health, traction risk, and chemical services; never recommend tight styles or overlapping relaxer/bleach. Distinguish cosmetic breakage care from medical hair-loss treatment.
6) CRITICAL SET RULE for hair/skin/body care: if you recommend ANY product that belongs to a named brand system/set, recommend EVERY other suitable member in that same set, marking owned versus needed. FRAGRANCE MODE EXCEPTION: do not force fragrance gift sets or exceed the user's hard per-fragrance scentBudget; budget cap takes precedence.
7) Never invent prices, availability, ingredient lists, or product efficacy. Mark uncertain prices as estimates.
Profile:${JSON.stringify(profile || {})} Mode:${currentHairState} Style:${selectedStylingMethod} Check-in note:${effectiveCheckInNote || 'None'} Triggers:${effectiveTriggers.join(',') || 'None'} Saved check-in:${JSON.stringify(lastCheckIn || {})} Stash:${JSON.stringify((inventory || []).slice(0, 30))}
Return JSON only:
{"recommendations":[{"name":"Item","domain":"hair|skin|body","category":"Cat","price":"$12.99","numericPrice":12.99,"bestStore":"Store","alsoAt":"Store2","whyItFits":"reason","setId":"brand-set-id or empty","setName":"complete system name or empty","setTotal":0,"owned":false,"compatibilityNotes":"how it fits and what not to layer with","useOrder":"AM/PM or wash-day order","scentFamily":"family","notes":["note"],"concentration":"EDP|EDT|body mist|oil","wearProfile":"occasion / projection fit"}],"compatibilitySummary":"brief explanation of why recommendations work together and any actives to alternate","budgetNote":"optional price context; suitability takes priority"}`;

      try {
        const rawText = await callGroqChat(apiKey, 'openai/gpt-oss-120b', [{ role: 'user', content: shopPrompt }], 0.25, 950, true);
        const parsed = parseJsonLoose(rawText);
        if (scentFocus) {
          const priced = (Array.isArray(parsed.recommendations) ? parsed.recommendations : []).filter(item => {
            const numeric = Number(item.numericPrice);
            return Number.isFinite(numeric) && numeric > 0 && numeric <= scentBudget;
          }).map(item => ({ ...item, domain: 'body', category: 'Perfume / Scents', numericPrice: Number(item.numericPrice), price: item.price || `Estimated $${Number(item.numericPrice).toFixed(2)}` }));
          parsed.recommendations = priced;
          parsed.budgetNote = `Hard cap applied: no more than $${scentBudget} per fragrance. Prices are estimates, not live retailer quotes.`;
        }
        parsed.recommendations = (Array.isArray(parsed.recommendations) ? parsed.recommendations : []).map(normalizeRecommendation).filter(Boolean);
        return res.status(200).json({ result: parsed });
      } catch (_) {
        try {
          const rawText = await callGroqChat(apiKey, 'qwen/qwen3.8-27b', [{ role: 'user', content: shopPrompt }], 0.25, 950, true);
          const parsed = parseJsonLoose(rawText);
          if (scentFocus) {
            const priced = (Array.isArray(parsed.recommendations) ? parsed.recommendations : []).filter(item => {
              const numeric = Number(item.numericPrice);
              return Number.isFinite(numeric) && numeric > 0 && numeric <= scentBudget;
            }).map(item => ({ ...item, domain: 'body', category: 'Perfume / Scents', numericPrice: Number(item.numericPrice), price: item.price || `Estimated $${Number(item.numericPrice).toFixed(2)}` }));
            parsed.recommendations = priced;
            parsed.budgetNote = `Hard cap applied: no more than ${scentBudget} per fragrance. Prices are estimates, not live retailer quotes.`;
          }
          parsed.recommendations = (Array.isArray(parsed.recommendations) ? parsed.recommendations : []).map(normalizeRecommendation).filter(Boolean);
          return res.status(200).json({ result: parsed });
        } catch (__) {
          return res.status(200).json({ result: scentFocus ? { recommendations: [], budgetNote: `No fragrance price could be verified or responsibly estimated within $${scentBudget}. Try a higher budget or search again.` } : buildFallbackShopRecs({ shoppingPrefs, profile, activeTriggers: effectiveTriggers, checkInNote: effectiveCheckInNote, inventory }) });
        }
      }
    }

    const stores = Array.isArray(shoppingPrefs.stores) && shoppingPrefs.stores.length
      ? shoppingPrefs.stores.join(', ')
      : 'Any';

    const systemInstructions = `Act as a cosmetology-informed textured-hair specialist, esthetician, and dermatologist-informed skincare educator with expertise in Black women's hair and melanin-rich skin. Do not claim to diagnose. Apply evidence-aware hair/scalp care: porosity and product buildup, relaxed/color-treated hair fragility, bond repair vs protein vs moisture, heat protection, traction prevention, and protective-style scalp hygiene. For melanin-rich skin prioritize barrier support, gentle hyperpigmentation care, and daily broad-spectrum SPF 30+. STRICT ROUTINE CONTRACT: first read the complete saved profile (hair texture, chemical/color history, hair issues/goals, face type/concerns, body concerns, sensitivities, preferences) AND the current/saved Check-In note, selected triggers, hair state, and styling method. Resolve overlapping signals and prioritize the user's actual stated concerns. First read profile.hairIssues + profile.hairGoals, profile.faceConcerns, and profile.bodyConcerns. Build a routine ONLY for domains with at least one selected concern (or a directly relevant active check-in trigger). Never create a generic hair, face, or body routine just to fill a section. For each selected concern, map each step to a specific need and explain the product's role, order, amount/application area, and frequency. Do not put shampoo in a conditioning step, moisturizer in an SPF step, perfume/deodorant in treatment steps, or one generic product into unrelated steps. If stash has no suitable item, say 'not in stash' and recommend a suitable product in missingProducts; do not pretend an unrelated stash item is suitable. Separate AM/PM and wash-day/styling routines. State which days to use actives and which products must not be layered in the same routine. Do not invent exact ingredient lists, clinical outcomes, or diagnoses. Pull from stash first only when category and purpose genuinely match. Do not repeat the names of owned stash products in routine step titles or details; refer to them generically as the matching product saved in My Stash. Owned products must not appear in missingProducts or be presented as purchases. Avoid ingredient conflicts and unnecessary duplicate actives; give AM/PM or alternating-day schedules for potentially irritating combinations. Never promise skin bleaching/lightening. Recommend the most suitable products for the user's selected concerns at [${stores}]. Price is secondary and must not act as a hard filter; prioritize suitability, evidence-informed performance, compatibility, and the user's hair/skin profile over the cheapest option. When comparable options exist, mention a good-value choice. CRITICAL SET RULE: if a routine requires a named brand system, include every still-missing member of that system in missingProducts, but do not repeat any member already owned in Stash. Complete owned-versus-missing set inventories belong in the Shop tab, not the routine display. ${lowEnergyMode ? 'Use a simplified version of the same relevant routine, not unrelated steps.' : 'Be specific and concise.'} Single-line JSON only:
{"climateImpact":"1 sentence","rootCauseInsights":[{"cause":"C","fix":"F"}],"hairAssessment":"1 sentence","skinAssessment":"1 sentence","hairRoutine":[{"step":"S","detail":"D","productUsed":"Stash item","essential":true}],"stylingGuide":{"method":"${selectedStylingMethod}","prepAndProtection":"Prep","recommendedProducts":[{"productType":"T","suggestion":"Item","howToUse":"Use"}],"techniqueAndTakedown":"Tip"},"skinRoutine":[{"step":"S","detail":"D","productUsed":"Stash item","essential":true}],"bodyRoutine":[{"step":"S","detail":"D","productUsed":"Stash item","essential":true}],"proTreatments":[{"provider":"Salon|Dermatologist|Esthetician","treatment":"T","why":"W","cadence":"C"}],"missingProducts":[{"name":"N","brand":"B","domain":"hair|skin|body","category":"domain-specific category","store":"S","reason":"R","estimatedPrice":"$12.99","priority":"essential|optional","forConcern":"selected concern","compatibilityNotes":"safe layering/use notes"}]}`;

    const userPrompt = `Note:${description || 'None'} Mode:${currentHairState} Style:${selectedStylingMethod} Check-in note:${effectiveCheckInNote || description || 'None'} Triggers:${effectiveTriggers.join(',') || 'None'} Saved check-in:${JSON.stringify(lastCheckIn || {})} Profile:${JSON.stringify(profile || {})} Weather:${JSON.stringify(weather || {})} Stash:${JSON.stringify((inventory || []).slice(0, 15))}`;

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
      const fb = buildFallbackRoutine({ currentHairState, selectedStylingMethod, weather, activeTriggers: effectiveTriggers, checkInNote: effectiveCheckInNote, profile, inventory });
      if (!parsed || typeof parsed !== 'object') return fb;
      const cleanSteps = (arr, fbArr) => {
        if (!Array.isArray(fbArr) || !fbArr.length) return [];
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
        missingProducts: (Array.isArray(parsed.missingProducts) ? parsed.missingProducts : fb.missingProducts)
          .filter(item => {
            if (!item || !CATEGORY_DOMAIN[String(item.category || '').trim()] || CATEGORY_DOMAIN[String(item.category || '').trim()] !== item.domain) return false;
            const key = String(item && item.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
            if (!key) return false;
            return !(inventory || []).some(owned => {
              const ownedKey = String(owned && owned.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
              return ownedKey && (ownedKey === key || ownedKey.includes(key) || key.includes(ownedKey));
            });
          })
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
          result: buildFallbackRoutine({ currentHairState, selectedStylingMethod, weather, activeTriggers: effectiveTriggers, checkInNote: effectiveCheckInNote, profile, inventory })
        });
      }
    }
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error analyzing request' });
  }
}
