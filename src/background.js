/**
 * @file YouTube AI 字幕字典 - 後台服務 (background.js)
 * @version 2.0
 * @description 該腳本負責處理核心邏輯：
 * 1. 接收來自 content script 的文本分析請求。
 * 2. 從本地存儲獲取用戶設定的 API 金鑰。
 * 3. 呼叫 Gemini API 進行語言分析 (定義、音標、上下文解釋等)。
 * 4. 動態生成穩定可靠的 Google TTS 音訊 URL。
 * 5. 將分析結果與音訊 URL 整合後回傳。
 * 6. (可選) 作為代理，解決 content script 可能遇到的音訊跨域 (CORS) 問題。
 */

// Gemini API 端點，使用較新且高效的模型
const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

/**
 * 主要訊息監聽器 ，作為 content script 與 background service 之間的橋樑。
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 處理文本分析請求
  if (request.action === 'analyzeText') {
    // 使用 async/await 處理非同步操作，並透過 .then/.catch 回傳結果
    analyzeText(request.text, request.context)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('[YouTube AI Dict] Analysis Error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 返回 true，表示將會非同步地發送響應
  }

  if (request.action === 'fetchAudio') {
    fetch(request.url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.blob(); // 直接獲取 Blob 物件
      })
      .then(blob => {
        // 使用 FileReader 將 Blob 轉換為 Base64
        // 這是 Service Worker (background.js) 環境下安全的作法
        const reader = new FileReader();
        reader.onload = () => {
          // reader.result 包含 "data:audio/mpeg;base64,..." 格式的字串
          // 我們需要移除前面的 "data:audio/mpeg;base64," 部分
          const base64String = reader.result.split(',')[1];
          sendResponse({ success: true, data: base64String });
        };
        reader.onerror = () => {
          sendResponse({ success: false, error: 'Failed to read audio blob.' });
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        console.error('[YouTube AI Dict] Audio Fetch Error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持異步響應
  }

  return false; // 對於未處理的 action，返回 false
});

/**
 * 從 Chrome 本地存儲中異步獲取 API 金鑰。
 * @returns {Promise<string>} 解析為 API 金鑰字串的 Promise。如果未找到，則為空字串。
 */
function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiKey'], (result) => {
      resolve(result.apiKey || '');
    });
  });
}

/**
 * 核心功能：分析文本，整合 AI 分析與 TTS 音訊。
 * @param {string} text - 要分析的單字或片語。
 * @param {string} context - 該單字或片語所在的完整句子上下文。
 * @returns {Promise<Object>} 包含完整分析結果的 Promise 物件。
 */
async function analyzeText(text, context) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    // 提供清晰的錯誤訊息，引導使用者進行設定
    throw new Error('尚未設定 Gemini API 金鑰。請點擊擴充功能圖示，在彈出視窗中進行設定。');
  }

  // 全新設計的 Prompt，專注於語言分析，不再要求尋找音訊 URL。
  const prompt = `
    Analyze the English text "${text}" within the context of the sentence: "${context}".
    Provide a detailed, dictionary-style analysis.

    You MUST respond with a single, valid JSON object and nothing else. Do not include any explanatory text, comments, or markdown like \`\`\`json.
    The JSON object must strictly follow this structure:
    {
      "query": "The queried text",
      "phonetics": {
        "uk": { "ipa": "/phonetic_uk/" },
        "us": { "ipa": "/phonetic_us/" }
      },
      "definitions": [
        {
          "partOfSpeech": "verb",
          "level": "B2",
          "meaning": "The primary definition in Traditional Chinese.",
          "synonyms": ["similar", "alike"],
          "antonyms": ["different", "opposite"],
          "example": {
            "en": "An English example sentence using the word.",
            "zh": "The Traditional Chinese translation of the example."
          }
        }
      ],
      "verbForms": {
        "present": "form",
        "past": "formed",
        "pastParticiple": "formed",
        "presentParticiple": "forming"
      },
      "contextAnalysis": {
        "translation": "The translation of the original text '${text}' in the given context, in Traditional Chinese.",
        "explanation": "An explanation in Traditional Chinese of why this translation is appropriate for the context."
      }
    }

    RULES:
    1.  All textual output (meanings, explanations, translations) MUST be in **Traditional Chinese (繁體中文)**.
    2.  For "phonetics", provide the International Phonetic Alphabet (IPA) string. If unknown, set the corresponding object (uk/us) to null.
    3.  "level" should be a CEFR level (e.g., A1, B2, C1). If unknown, set to null.
    4.  "synonyms" and "antonyms" must be arrays of strings. If none exist, use an empty array [].
    5.  "verbForms" is only for verbs. If the word is not a verb or has no variations, set this to null.
    6.  If the query is a phrase, "phonetics", "definitions", and "verbForms" should be null. Focus on providing a high-quality "contextAnalysis".
    7.  Ensure the final output is a single, clean JSON object.
    `;

  try {
    // 步驟 1: 呼叫 Gemini API 進行語言分析
    const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          // 強制 Gemini 輸出標準的 JSON 格式，極大提高穩定性
          response_mime_type: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      // 提供更詳細的 API 錯誤訊息
      throw new Error(`API 請求失敗 (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // 從 API 回應中提取 JSON 內容字串
    // 根據 Gemini API 的回應結構，路徑可能是 candidates[0].content.parts[0].text
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts[0]) {
      throw new Error('API 回應格式無效，找不到分析內容。');
    }
    // 更強健的清理方式
    let analysisText = data.candidates[0].content.parts[0].text.trim();
    // 移除所有 Markdown 程式碼區塊標記
    analysisText = analysisText.replace(/^```(?:json)?\s*\n?/g, '').replace(/\n?```\s*$/g, '');

    // 步驟 2: 解析 Gemini 回傳的 JSON 字串
    const analysisResult = JSON.parse(analysisText);

    // 步驟 3: 動態生成並注入穩定可靠的 Google TTS 音訊 URL
    // 即使 Gemini 沒有提供音標，我們仍然可以根據查詢詞生成發音
    if (analysisResult.query) {
      const encodedText = encodeURIComponent(analysisResult.query);
      const ttsBaseUrl = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob';

      // 確保 phonetics 物件存在
      if (!analysisResult.phonetics) {
        analysisResult.phonetics = {};
      }

      // 為英式和美式發音創建 URL
      analysisResult.phonetics.uk = {
        ...analysisResult.phonetics.uk,
        audio: `${ttsBaseUrl}&q=${encodedText}&tl=en-GB`
      };
      analysisResult.phonetics.us = {
        ...analysisResult.phonetics.us,
        audio: `${ttsBaseUrl}&q=${encodedText}&tl=en-US`
      };
    }

    // 步驟 4: 回傳整合後的完整結果
    return analysisResult;

  } catch (error) {
    console.error('[YouTube AI Dict] API or Parsing Error:', error);
    // 對常見錯誤進行分類，提供更友善的提示
    if (error instanceof SyntaxError) {
      throw new Error('AI 回應格式錯誤，無法解析。可能是暫時性問題，請稍後再試。');
    }
    // 將原始錯誤訊息傳遞出去
    throw error;
  }
}
