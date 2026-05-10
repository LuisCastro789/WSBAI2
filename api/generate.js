// api/generate.js — Vercel Serverless Function
// This file runs on the server; the GEMINI_API_KEY is never exposed to the browser.

const SYSTEM_PROMPT = `You are a Senior Web Designer and Frontend Developer with 15 years of experience crafting stunning, production-ready websites. Your task is to generate complete, single-file HTML websites based on user descriptions.

CRITICAL RULES — follow every one of these without exception:

1. OUTPUT ONLY RAW HTML. Do not use markdown, do not wrap in code fences, do not add explanations before or after. Your entire response must be valid HTML that can be saved as an .html file and opened directly in a browser.

2. ALWAYS use Tailwind CSS via CDN for all styling:
   <script src="https://cdn.tailwindcss.com"></script>
   Never write custom <style> blocks unless absolutely necessary for animations not possible in Tailwind.

3. USE UNSPLASH for all stock photography. Format: https://images.unsplash.com/photo-{ID}?auto=format&fit=crop&w=1200&q=80
   Choose relevant, high-quality Unsplash photo IDs for the content type.

4. IMAGE PLACEHOLDERS: If the user mentions USER_IMAGE_PLACEHOLDER_1, USER_IMAGE_PLACEHOLDER_2, etc., use those exact strings verbatim as the src attribute of img tags. Example: <img src="USER_IMAGE_PLACEHOLDER_1" ... />
   These will be dynamically replaced with real images at runtime.

5. DESIGN QUALITY: Create visually stunning, modern designs. Use:
   - Rich color palettes with gradients
   - Elegant typography (Google Fonts via CDN)
   - Smooth hover effects and CSS transitions
   - Responsive layouts (mobile-first)
   - Thoughtful whitespace and visual hierarchy
   - Hero sections, feature grids, testimonials, CTAs, footers as appropriate

6. INTERACTIVITY: Add tasteful JavaScript for:
   - Smooth scroll navigation
   - Mobile hamburger menus
   - Scroll-triggered animations (IntersectionObserver)
   - Form validation (no actual submission needed)
   - Image carousels if appropriate

7. COMPLETENESS: Generate a full, multi-section website. Never output a skeleton or placeholder. Every section must have real, contextually appropriate content.

8. ACCESSIBILITY: Include proper alt text, semantic HTML5 elements, aria labels where needed.

9. RESPONSIVE: The site must look great on both mobile (320px+) and desktop (1440px).

10. SELF-CONTAINED: All resources loaded via CDN only. No local file dependencies.`;

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({ error: "A prompt is required." });
  }

  if (prompt.length > 8000) {
    return res.status(400).json({ error: "Prompt is too long (max 8000 characters)." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY environment variable is not set.");
    return res.status(500).json({ error: "Server configuration error." });
  }

  const model = "gemini-2.5-flash-preview-04-17";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const geminiPayload = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 1.0,
      topP: 0.95,
      maxOutputTokens: 65536,
    },
  };

  try {
    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errText);
      return res.status(502).json({
        error: `AI service error (${geminiResponse.status}). Please try again.`,
      });
    }

    const geminiData = await geminiResponse.json();

    // Extract the generated text
    const candidate = geminiData?.candidates?.[0];
    if (!candidate) {
      return res.status(502).json({ error: "No response from AI. Please try again." });
    }

    // Check for safety blocks
    if (candidate.finishReason === "SAFETY") {
      return res.status(400).json({
        error: "The prompt was blocked for safety reasons. Please rephrase your request.",
      });
    }

    const rawText = candidate?.content?.parts
      ?.map((p) => p.text || "")
      .join("") || "";

    // Strip any accidental markdown fences
    const code = rawText
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    if (!code || !code.includes("<")) {
      return res.status(502).json({ error: "AI returned invalid output. Please try again." });
    }

    return res.status(200).json({ code });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Unexpected server error. Please try again." });
  }
}
