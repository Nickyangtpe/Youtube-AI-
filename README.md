# YouTube AI 字幕字典 (YouTube AI Subtitle Dictionary)

> 🎬 由 Gemini AI 驅動的智能英文字幕查詢工具

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-brightgreen.svg)](https://www.google.com/chrome/)
[![GitHub](https://img.shields.io/github/stars/Nickyangtpe/Youtube-AI-?style=social)](https://github.com/Nickyangtpe/Youtube-AI-)

## ⚠️ 注意事項

**此插件含有大量 AI 生成內容**

本專案的核心功能依賴 Google Gemini AI API 進行即時語言分析。所有字典定義、翻譯、例句等內容均由 AI 動態生成，可能存在以下情況：
- 翻譯或解釋不完全準確
- 罕見詞彙或俚語的分析可能有誤
- CEFR 等級標註僅供參考
- 建議搭配權威字典進行重要學習場景

---

## ✨ 功能特色

### 🎯 核心功能

- **即點即查**：直接點擊 YouTube 字幕中的任何英文單字，立即顯示詳細分析
- **多字查詢**：按住 `Shift` 鍵並用滑鼠拖曳選取多個單字或片語
- **智能分析**：由 Gemini 2.5 Flash Lite 提供：
  - 📖 繁體中文釋義
  - 🔊 英式/美式發音（IPA 音標 + TTS 語音）
  - 📝 詞性標註與 CEFR 等級
  - 🔄 同義詞與反義詞
  - 💬 上下文分析與例句
  - 📚 動詞變化表

### 🎨 使用者體驗

- **無縫整合**：字幕單字自動轉換為可點擊狀態，不影響觀看體驗
- **即時反饋**：點擊單字後立即顯示載入動畫，分析完成後自動更新
- **可拖曳面板**：結果面板可自由拖曳至任意位置，不遮擋影片內容
- **音訊播放**：一鍵播放英式或美式發音，支援快取加速
- **響應式設計**：面板自動調整位置，適應不同螢幕尺寸

### 🔧 技術亮點

- **高效處理**：智能監聽字幕 DOM 變化，支援自動生成字幕的逐字滾動
- **防抖機制**：避免字幕更新時的重複處理，確保流暢體驗
- **CORS 代理**：透過 background script 代理 TTS 音訊請求，解決跨域問題
- **記憶體優化**：使用 WeakMap 追蹤已處理字幕，音訊 Blob URL 快取機制

---

## 📦 安裝方式

### 方法一：Chrome Web Store（即將推出）

> 🚧 目前尚未上架，敬請期待

### 方法二：開發者模式安裝

1. **下載專案**
   ```bash
   git clone https://github.com/Nickyangtpe/Youtube-AI-.git
   cd Youtube-AI-
   ```

2. **獲取 Gemini API 金鑰**
   - 前往 [Google AI Studio](https://aistudio.google.com/app/apikeys)
   - 點擊「Create API Key」
   - 複製生成的 API 金鑰

3. **載入擴充功能**
   - 打開 Chrome 瀏覽器
   - 前往 `chrome://extensions/`
   - 開啟右上角「開發人員模式」
   - 點擊「載入未封裝項目」
   - 選擇專案資料夾

4. **設定 API 金鑰**
   - 點擊擴充功能圖示 🎬
   - 在彈出視窗中貼上 Gemini API 金鑰
   - 點擊「測試連線」確認設定成功
   - 點擊「儲存設定」

---

## 🎮 使用說明

### 基本操作

#### 查詢單字
1. 播放任何有英文字幕的 YouTube 影片
2. 點擊字幕中的任意單字
3. 等待 1-2 秒，查詢結果會出現在螢幕右側

#### 查詢片語
1. 按住鍵盤上的 `Shift` 鍵
2. 用滑鼠拖曳選取多個單字
3. 被選取的單字會以藍色高亮顯示
4. 點擊最後一個單字，釋放 `Shift` 鍵
5. 查詢結果會分析整個片語的意思

#### 播放發音
- 點擊音標旁的 🔊 按鈕
- 英式發音：en-GB
- 美式發音：en-US
- 支援離線快取，第二次播放更快

#### 移動面板
- 點擊面板頂部（標題列）並拖曳
- 鬆開滑鼠即可固定在新位置
- 不會影響影片控制或其他互動

### 進階技巧

- **連續查詢**：關閉面板後可立即點擊其他單字，無需等待
- **暫停查詢**：點擊字幕外的任意位置，或點擊面板右上角 ✕ 關閉
- **快速選取**：對於常見片語（如 "turn around"），可用 Shift + 快速點擊起始和結束單字

---

## 📁 專案結構

```
Youtube-AI-/
├── manifest.json          # 擴充功能配置檔
├── background.js          # 後台服務：API 呼叫與音訊代理
├── content.js             # 內容腳本：字幕處理與 UI 互動
├── styles.css             # 樣式表：面板與字幕高亮樣式
├── popup.html             # 設定介面：API 金鑰管理
├── popup.js               # 設定邏輯：儲存與測試連線
├── icons/                 # 擴充功能圖示
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # 本文件
```

---

## 🔧 技術架構

### 核心技術棧

- **前端框架**：純 JavaScript（無依賴）
- **AI 模型**：Google Gemini 2.5 Flash Lite
- **語音合成**：Google Translate TTS API
- **擴充功能 API**：Chrome Extension Manifest V3

### 關鍵技術實現

#### 1. 字幕單字化處理

```javascript
// 將字幕文本分割為可點擊的單字 span
function processSegment(segment) {
  const text = segment.textContent.trim();
  const parts = text.split(/(\b[a-zA-Z'-]+\b)/g);
  
  parts.forEach(part => {
    if (/\b[a-zA-Z'-]+\b/.test(part)) {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'yt-ai-dict-word';
      wordSpan.textContent = part;
      // 加入點擊事件監聽...
    }
  });
}
```

#### 2. MutationObserver 監聽字幕變化

```javascript
// 監聽 YouTube 字幕容器的 DOM 變化
const observer = new MutationObserver((mutations) => {
  // 檢測新增的 .caption-visual-line 或 .ytp-caption-segment
  // 自動處理新出現的字幕行
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true
});
```

#### 3. 防抖處理逐字滾動

```javascript
// 避免自動字幕逐字出現時頻繁重新處理
function processSegmentWithDebounce(segment, delay = 300) {
  clearTimeout(segmentProcessTimers.get(segment));
  
  const timer = setTimeout(() => {
    processSegment(segment);
  }, delay);
  
  segmentProcessTimers.set(segment, timer);
}
```

#### 4. Gemini API 呼叫

```javascript
// 強制輸出標準 JSON 格式
const response = await fetch(GEMINI_API_ENDPOINT, {
  method: 'POST',
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      response_mime_type: "application/json"
    }
  })
});
```

#### 5. 音訊 CORS 代理

```javascript
// 透過 background script 代理 TTS 請求
chrome.runtime.sendMessage({ 
  action: 'fetchAudio', 
  url: audioUrl 
}, (response) => {
  const blob = base64ToBlob(response.data, 'audio/mpeg');
  const blobUrl = URL.createObjectURL(blob);
  const audio = new Audio(blobUrl);
  audio.play();
});
```

---

## 🐛 已知問題與限制

### 當前限制

1. **僅支援英文字幕**：目前只處理英文單字（a-z, A-Z），不支援其他語言
2. **需要 API 金鑰**：必須自行申請 Gemini API 金鑰（免費額度有限）
3. **網路依賴**：每次查詢都需要連線至 Gemini API，離線無法使用
4. **YouTube 專用**：目前只在 YouTube 網站上運作

### 已知 Bug

- [ ] 部分特殊字幕格式（如 CC 字幕）可能無法正確處理
- [ ] 極快的字幕切換可能導致短暫延遲
- [ ] 面板拖曳時偶爾會與影片控制條衝突

### 改善計畫

- [ ] 支援更多影片平台（Coursera、Udemy 等）
- [ ] 加入離線字典功能（本地詞庫）
- [ ] 優化 API 呼叫頻率（快取常見單字）
- [ ] 支援其他語言字幕（日文、韓文等）
- [ ] 新增單字收藏與複習功能

---

## 🤝 貢獻指南

歡迎提交 Issue 和 Pull Request！

### 開發環境設定

1. Fork 本專案
2. 建立功能分支：`git checkout -b feature/AmazingFeature`
3. 提交變更：`git commit -m 'Add some AmazingFeature'`
4. 推送分支：`git push origin feature/AmazingFeature`
5. 開啟 Pull Request

### 程式碼風格

- 使用 2 空格縮排
- 變數命名採用 camelCase
- 函數應有清晰的註解說明用途
- 提交訊息使用英文，格式：`type(scope): description`

---

## 📄 授權條款

本專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 檔案

```
MIT License

Copyright (c) 2024 Nickyangtpe

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

## 🙏 致謝

- **Google Gemini AI**：提供強大的語言分析能力
- **Google Translate TTS**：提供免費的語音合成服務
- **YouTube**：提供豐富的學習資源平台
- **所有貢獻者**：感謝每一位提出建議和改進的使用者

---

## 📞 聯絡方式

- **GitHub**：[@Nickyangtpe](https://github.com/Nickyangtpe)
- **專案連結**：[Youtube-AI-](https://github.com/Nickyangtpe/Youtube-AI-)
- **問題回報**：[Issues](https://github.com/Nickyangtpe/Youtube-AI-/issues)
- **功能建議**：歡迎在 Issues 中提出

---

## 🌟 Star History

如果這個專案對您有幫助，請給我們一個 ⭐️！

[![Star History Chart](https://api.star-history.com/svg?repos=Nickyangtpe/Youtube-AI-&type=Date)](https://star-history.com/#Nickyangtpe/Youtube-AI-&Date)

---

**最後更新**：2024-11-09  
**版本**：v1.0.0
