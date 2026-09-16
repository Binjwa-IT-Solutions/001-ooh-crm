/**
 * AI Extraction Helper for Inbound Leads
 * Uses Google Gemini (v1beta REST via fetch) to extract structured lead data
 * from free-text/unstructured emails without adding heavy dependencies.
 */

export interface IExtractedLeadAI {
  contactPerson?: string;
  companyName?: string;
  mobile?: string;
  email?: string;
  city?: string;
  budgetInRupees?: number;
  locationPreference?: 'Airport' | 'Highway' | 'Mall' | 'Metro' | 'Other';
  campaignDuration?: string;
  summary?: string;
}

export async function extractLeadWithGemini(emailContent: {
  from?: string;
  subject?: string;
  text?: string;
}): Promise<IExtractedLeadAI | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const prompt = `You are a CRM lead extraction assistant for an Out-Of-Home (OOH) media & billboard advertising agency named Media Octus.
Analyze the following inbound inquiry email and extract the prospect's details into clean JSON.

Email Metadata:
From: ${emailContent.from || ''}
Subject: ${emailContent.subject || ''}
Content:
${emailContent.text || ''}

Return ONLY a valid JSON object with these exact keys (leave as null or omit if not found):
{
  "contactPerson": "string or null (clean individual name, not email)",
  "companyName": "string or null (client company or business name if mentioned or inferable from domain)",
  "mobile": "string or null (10-digit Indian phone number without country code or spaces)",
  "email": "string or null (clean email address)",
  "city": "string or null (e.g. Indore, Bhopal, Mumbai, etc.)",
  "budgetInRupees": "number or null (convert words like 50k to 50000, 1 Lakh to 100000)",
  "locationPreference": "Airport | Highway | Mall | Metro | Other | null",
  "campaignDuration": "string or null (e.g. 1 Month, 15 Days)",
  "summary": "string or null (a concise 1-2 sentence summary of what advertising they need)"
}`;

  try {
    // Resilient fallback list of production flash models to avoid single-model free-tier limits
    const candidateModels = [
      'gemini-flash-latest',
      'gemini-3.5-flash',
      'gemini-flash-lite-latest',
      'gemini-3.6-flash',
    ];

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          console.warn(`[Gemini AI] Model ${model} returned status ${response.status}, trying next fallback model...`);
          continue;
        }

        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) {
          continue;
        }

        const parsed: IExtractedLeadAI = JSON.parse(candidateText);
        return parsed;
      } catch (subErr: any) {
        console.warn(`[Gemini AI] Attempt with ${model} failed:`, subErr.message);
      }
    }

    return null;
  } catch (err: any) {
    console.warn('[Gemini AI] Failed to extract lead info, falling back to regex:', err.message);
    return null;
  }
}
