document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const statusMessage = document.getElementById('statusMessage');

  // 載入已儲存的金鑰
  chrome.storage.local.get(['apiKey'], (result) => {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
  });

  // 儲存按鈕事件
  saveBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatus('請輸入有效的 API 金鑰。', 'error');
      return;
    }
    chrome.storage.local.set({ apiKey: apiKey }, () => {
      showStatus('API 金鑰已成功儲存！', 'success');
    });
  });

  // 測試按鈕事件
  testBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatus('測試前請先輸入 API 金鑰。', 'error');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = '測試中...';
    showStatus('正在連線至 Gemini API...', 'info');

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Translate "Hello" to Traditional Chinese.' }] }]
          } )
        }
      );

      if (response.ok) {
        showStatus('✓ 連線成功！您的 API 金鑰運作正常。', 'success');
      } else {
        const errorData = await response.json();
        showStatus(`✗ 連線失敗: ${errorData.error?.message || '請檢查金鑰是否正確或網路連線。'}`, 'error');
      }
    } catch (error) {
      showStatus(`✗ 網路錯誤: ${error.message}`, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '測試連線';
    }
  });

  // 顯示狀態訊息
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} visible`;
    setTimeout(() => {
      statusMessage.classList.remove('visible');
    }, 4000);
  }
});
