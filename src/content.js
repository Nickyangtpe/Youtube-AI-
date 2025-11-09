// YouTube AI 字幕字典 - 內容腳本 (content.js) - v3.4

let currentPanel = null;
let isShiftSelecting = false;
let selectionStartWord = null;
let currentRequest = null;
let processedSegments = new WeakMap();
let audioCache = new Map();

let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let stopDraggingHandler = null;

// 新增：定期檢查機制
let checkInterval = null;
// 新增：防抖處理，避免逐字滾動時頻繁重新處理
let segmentProcessTimers = new WeakMap();

// 初始化
function init() {
  observeSubtitles();
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('keyup', handleKeyUp, true);
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  
  // 新增：啟動定期檢查，確保所有字幕都被處理
  startPeriodicCheck();
}

// 定期檢查並處理未處理的字幕 - 增強版
function startPeriodicCheck() {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  // 每 400ms 檢查一次（更頻繁，確保不遺漏）
  checkInterval = setInterval(() => {
    // 檢查所有字幕容器和 visual lines
    const containers = document.querySelectorAll('.ytp-caption-window-container, .caption-window, .captions-text');
    
    containers.forEach(container => {
      // 找到所有 segments（包括在 visual-line 內的）
      const allSegments = container.querySelectorAll('.ytp-caption-segment, .caption-segment');
      
      allSegments.forEach(segment => {
        if (segment && segment.textContent && segment.textContent.trim()) {
          const currentText = segment.textContent.trim();
          const lastText = processedSegments.get(segment);
          
          // 檢查是否需要處理
          const needsProcessing = lastText !== currentText || !hasProcessedWords(segment);
          
          if (needsProcessing) {
            processSegmentWithDebounce(segment, 50);
          }
        }
      });
      
      // 處理所有包含文字但不是 segment 的元素
      const allTextNodes = getTextNodesWithEnglish(container);
      allTextNodes.forEach(node => {
        if (!isNodeProcessed(node)) {
          const parent = node.parentElement;
          if (parent && !parent.classList.contains('yt-ai-dict-word')) {
            processTextNode(node);
          }
        }
      });
    });
  }, 400);
}

// 新增：檢查 segment 是否已經有處理過的單字
function hasProcessedWords(segment) {
  return segment.querySelectorAll('.yt-ai-dict-word').length > 0;
}

// 新增：獲取所有包含英文的文本節點
function getTextNodesWithEnglish(container) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const text = node.textContent.trim();
        // 只接受包含英文字母的文本節點
        if (text && /[a-zA-Z]/.test(text)) {
          // 排除已經在 word span 內的文本
          if (node.parentElement?.classList?.contains('yt-ai-dict-word')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  return textNodes;
}

// 新增：檢查節點是否已處理
function isNodeProcessed(node) {
  if (node.nodeType !== Node.TEXT_NODE) return false;
  
  const parent = node.parentElement;
  if (!parent) return false;
  
  // 如果父元素是 word span，則已處理
  if (parent.classList?.contains('yt-ai-dict-word')) {
    return true;
  }
  
  // 檢查兄弟節點中是否有 word span
  const siblings = Array.from(parent.childNodes);
  return siblings.some(sibling => 
    sibling.nodeType === Node.ELEMENT_NODE && 
    sibling.classList?.contains('yt-ai-dict-word')
  );
}

// 新增：處理單個文本節點
function processTextNode(textNode) {
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
  
  const text = textNode.textContent;
  if (!text.trim() || !/[a-zA-Z]/.test(text)) return;
  
  const fragment = createWordFragment(text);
  textNode.replaceWith(fragment);
}

// 觀察字幕容器的出現 - 針對 caption-visual-line 優化
function observeSubtitles() {
  const observer = new MutationObserver((mutations) => {
    const segmentsToProcess = new Map();

    for (const mutation of mutations) {
      // 處理新增的節點
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // 優先處理 caption-visual-line（YouTube 字幕的行容器）
          if (node.classList.contains('caption-visual-line')) {
            const segments = node.querySelectorAll('.ytp-caption-segment, .caption-segment');
            segments.forEach(seg => segmentsToProcess.set(seg, 'new'));
          }
          
          // 處理 segment 本身
          if (node.classList.contains('ytp-caption-segment') || node.classList.contains('caption-segment')) {
            segmentsToProcess.set(node, 'new');
          }
          
          // 檢查子元素中的 visual-line 和 segments
          const visualLines = node.querySelectorAll('.caption-visual-line');
          visualLines.forEach(line => {
            const segments = line.querySelectorAll('.ytp-caption-segment, .caption-segment');
            segments.forEach(seg => segmentsToProcess.set(seg, 'new'));
          });
          
          const segments = node.querySelectorAll('.ytp-caption-segment, .caption-segment');
          segments.forEach(seg => segmentsToProcess.set(seg, 'new'));
          
          // 檢查父元素是否為 segment
          const parentSegment = node.closest('.ytp-caption-segment, .caption-segment');
          if (parentSegment) {
            segmentsToProcess.set(parentSegment, 'update');
          }
        }
      }
      
      // 處理內容變更的節點
      if (mutation.type === 'characterData' || mutation.type === 'childList') {
        const target = mutation.target;
        const segment = target.nodeType === Node.ELEMENT_NODE 
          ? target.closest('.ytp-caption-segment, .caption-segment')
          : target.parentElement?.closest('.ytp-caption-segment, .caption-segment');
        
        if (segment && !segmentsToProcess.has(segment)) {
          segmentsToProcess.set(segment, 'update');
        }
      }
    }

    // 處理所有需要更新的 segments
    segmentsToProcess.forEach((priority, segment) => {
      if (segment && segment.textContent) {
        if (priority === 'new') {
          // 新增的 segment 立即處理（無延遲）
          requestAnimationFrame(() => {
            processSegmentWithDebounce(segment, 0);
          });
        } else {
          // 更新的 segment 短延遲
          processSegmentWithDebounce(segment, 150);
        }
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    characterDataOldValue: true
  });
  
  // 初始化時立即處理已存在的字幕
  const existingSegments = document.querySelectorAll('.ytp-caption-segment, .caption-segment');
  existingSegments.forEach(segment => {
    if (segment.textContent) {
      processSegment(segment);
      processedSegments.set(segment, segment.textContent);
    }
  });
}

// 帶防抖的 segment 處理函數 - 改進版
function processSegmentWithDebounce(segment, delay = 300) {
  // 清除該 segment 之前的計時器
  const existingTimer = segmentProcessTimers.get(segment);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // 設置新的計時器
  const timer = setTimeout(() => {
    try {
      processSegment(segment);
    } catch (error) {
      console.error('[YouTube AI Dict] Error processing segment:', error);
    }
    
    // 清理計時器引用
    segmentProcessTimers.delete(segment);
  }, delay);

  segmentProcessTimers.set(segment, timer);
}

// 將字幕文本轉換為可點擊的單字 - 更激進的處理方式
function processSegment(segment) {
  if (!segment || !segment.textContent) {
    return;
  }
  
  const currentText = segment.textContent.trim();
  
  if (!currentText) {
    return;
  }

  // 先嘗試處理所有嵌套元素和文本節點
  processAllTextInElement(segment);
  
  // 更新處理記錄
  processedSegments.set(segment, currentText);
}

// 新增：處理元素內所有文本（包括嵌套元素）
function processAllTextInElement(element) {
  // 獲取所有直接子節點
  const childNodes = Array.from(element.childNodes);
  
  childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      // 文本節點：直接處理
      const text = node.textContent;
      if (text.trim() && /[a-zA-Z]/.test(text)) {
        const fragment = createWordFragment(text);
        node.replaceWith(fragment);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // 元素節點：檢查是否需要處理
      
      // 如果已經是我們的 word span，跳過
      if (node.classList?.contains('yt-ai-dict-word')) {
        return;
      }
      
      // 如果元素內有文本
      if (node.textContent.trim()) {
        // 檢查是否有子元素
        if (node.children.length === 0 && node.childNodes.length > 0) {
          // 沒有子元素，只有文本：處理這個元素的文本內容
          const hasOnlyText = Array.from(node.childNodes).every(
            child => child.nodeType === Node.TEXT_NODE
          );
          
          if (hasOnlyText) {
            const text = node.textContent;
            if (/[a-zA-Z]/.test(text)) {
              const fragment = createWordFragment(text);
              node.replaceWith(fragment);
            }
          } else {
            // 有混合內容，遞迴處理
            processAllTextInElement(node);
          }
        } else if (node.children.length > 0) {
          // 有子元素：遞迴處理
          processAllTextInElement(node);
        }
      }
    }
  });
}

// 創建 word fragment 的輔助函數
function createWordFragment(text) {
  const fragment = document.createDocumentFragment();
  const parts = text.split(/(\b[a-zA-Z'-]+\b)/g);

  parts.forEach(part => {
    if (/\b[a-zA-Z'-]+\b/.test(part)) {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'yt-ai-dict-word';
      wordSpan.textContent = part;
      wordSpan.style.cursor = 'pointer';
      wordSpan.style.display = 'inline-block';
      fragment.appendChild(wordSpan);
    } else if (part) {
      fragment.appendChild(document.createTextNode(part));
    }
  });

  return fragment;
}

function handleKeyDown(event) {
  if (event.key === 'Shift' && !isShiftSelecting) {
    isShiftSelecting = true;
    selectionStartWord = null;
  }
}

function handleKeyUp(event) {
  if (event.key === 'Shift') {
    clearSelection();
  }
}

function handleMouseMove(event) {
  if (isDragging && currentPanel) {
    event.preventDefault();
    event.stopPropagation();
    const left = event.clientX - dragOffsetX;
    const top = event.clientY - dragOffsetY;
    currentPanel.style.left = `${left}px`;
    currentPanel.style.top = `${top}px`;
    return;
  }

  const target = event.target;

  if (!target.classList.contains('yt-ai-dict-word')) {
    return;
  }

  if (isShiftSelecting) {
    if (!selectionStartWord) {
      selectionStartWord = target;
      highlightSelection(target, target);
    } else {
      highlightSelection(selectionStartWord, target);
    }
  }
}

function handleClick(event) {
  const target = event.target;
  
  if (target.classList.contains('yt-ai-dict-close-btn')) {
    cancelCurrentRequest();
    removeCurrentPanel();
    clearSelection();
    return;
  }

  if (!target.classList.contains('yt-ai-dict-word')) {
    return;
  }

  event.stopPropagation();
  event.preventDefault();

  if (isShiftSelecting && selectionStartWord) {
    const selectedWords = getSelectedWords(selectionStartWord, target);
    if (selectedWords.length > 0) {
      const textToAnalyze = buildTextFromWords(selectedWords);
      const context = getSubtitleContext(selectionStartWord);
      triggerAnalysis(textToAnalyze, context, event);
    }
    isShiftSelecting = false;
    selectionStartWord = null;
  } else if (!isShiftSelecting) {
    const textToAnalyze = target.textContent;
    const context = getSubtitleContext(target);
    triggerAnalysis(textToAnalyze, context, event);
    clearSelection();
  }
}

function clearSelection() {
  isShiftSelecting = false;
  selectionStartWord = null;
  clearSelectionHighlight();
}

function cancelCurrentRequest() {
  if (currentRequest) {
    currentRequest.cancelled = true;
    currentRequest = null;
  }
}

function getSelectedWords(startEl, endEl) {
  const parent = startEl.parentElement;
  if (!parent || !parent.contains(endEl)) return [];

  const allWords = Array.from(parent.querySelectorAll('.yt-ai-dict-word'));
  const startIndex = allWords.indexOf(startEl);
  const endIndex = allWords.indexOf(endEl);

  if (startIndex === -1 || endIndex === -1) return [];

  const [min, max] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
  return allWords.slice(min, max + 1);
}

function buildTextFromWords(wordElements) {
  if (!wordElements || wordElements.length === 0) return '';
  const parent = wordElements[0].parentElement;
  const firstWord = wordElements[0].textContent;
  const lastWord = wordElements[wordElements.length - 1].textContent;

  const parentText = parent.textContent;
  const startIndex = parentText.indexOf(firstWord);
  const lastWordIndex = parentText.lastIndexOf(lastWord);
  const endIndex = lastWordIndex + lastWord.length;

  if (startIndex === -1 || lastWordIndex === -1) {
    return wordElements.map(w => w.textContent).join(' ');
  }

  return parentText.substring(startIndex, endIndex);
}

function highlightSelection(startEl, endEl) {
  clearSelectionHighlight();
  const selectedWords = getSelectedWords(startEl, endEl);
  selectedWords.forEach(el => el.classList.add('selected'));
}

function clearSelectionHighlight() {
  document.querySelectorAll('.yt-ai-dict-word.selected').forEach(el => {
    el.classList.remove('selected');
  });
}

function triggerAnalysis(text, context, event) {
  cancelCurrentRequest();

  const rect = event.target.getBoundingClientRect();
  showLoadingPanel(text, rect);

  const requestId = Date.now();
  currentRequest = { id: requestId, cancelled: false };

  chrome.runtime.sendMessage(
    { action: 'analyzeText', text: text.trim(), context: context },
    (response) => {
      if (!currentRequest || currentRequest.id !== requestId || currentRequest.cancelled) {
        return;
      }

      if (chrome.runtime.lastError) {
        showErrorPanel('與後台通訊失敗,請刷新頁面重試。', rect);
        currentRequest = null;
        return;
      }

      if (response.success) {
        showResultPanel(response.data, rect);
      } else {
        showErrorPanel(response.error, rect);
      }

      currentRequest = null;
    }
  );
}

function getSubtitleContext(element) {
  const segment = element.closest('.ytp-caption-segment, .caption-segment');
  return segment ? segment.textContent.trim().replace(/\s+/g, ' ') : '';
}

function removeCurrentPanel() {
  if (stopDraggingHandler) {
    document.removeEventListener('mouseup', stopDraggingHandler);
    document.removeEventListener('mouseleave', stopDraggingHandler);
    stopDraggingHandler = null;
  }

  if (currentPanel) {
    currentPanel.remove();
    currentPanel = null;
  }
  
  isDragging = false; 
}

function createPanel(content, title, rect) {
  removeCurrentPanel();
  const panel = document.createElement('div');
  panel.className = 'yt-ai-dict-panel';
  panel.innerHTML = `
    <div class="yt-ai-dict-header">
      <span class="yt-ai-dict-title">${title}</span>
      <button class="yt-ai-dict-close-btn">×</button>
    </div>
    <div class="yt-ai-dict-content">${content}</div>
  `;
  document.body.appendChild(panel);
  currentPanel = panel;

  const header = panel.querySelector('.yt-ai-dict-header');
  
  header.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    
    isDragging = true;
    const panelRect = panel.getBoundingClientRect();
    dragOffsetX = e.clientX - panelRect.left;
    dragOffsetY = e.clientY - panelRect.top;
    
    panel.style.userSelect = 'none';
    header.style.cursor = 'move';

    document.addEventListener('mouseup', stopDraggingHandler);
    document.addEventListener('mouseleave', stopDraggingHandler);
  });

  stopDraggingHandler = () => {
    if (isDragging) {
      isDragging = false;
      if (panel) {
          panel.style.userSelect = '';
      }
      if (header) {
          header.style.cursor = '';
      }
      document.removeEventListener('mouseup', stopDraggingHandler);
      document.removeEventListener('mouseleave', stopDraggingHandler);
    }
  };
  
  positionPanel(panel, rect);
}

function positionPanel(panel, rect) {
  const panelWidth = 380;
  const panelHeight = panel.offsetHeight;
  const margin = 10;

  let top = rect.bottom + window.scrollY + margin;
  let left = rect.left + window.scrollX;

  if (top + panelHeight > window.innerHeight + window.scrollY && rect.top > panelHeight + margin) {
    top = rect.top + window.scrollY - panelHeight - margin;
  }
  if (left + panelWidth > window.innerWidth + window.scrollX) {
    left = window.innerWidth + window.scrollX - panelWidth - margin;
  }
  if (left < 0) left = margin;

  panel.style.top = `${top}px`;
  panel.style.left = `${left}px`;
}

function showLoadingPanel(text, rect) {
  const loadingHTML = `
    <div class="yt-ai-dict-loading">
      <div class="yt-ai-dict-loader"></div>
      <p>Gemini AI 正在分析中...</p>
    </div>
  `;
  createPanel(loadingHTML, `查詢: ${text}`, rect);
}

function showErrorPanel(errorMsg, rect) {
  const errorHTML = `<div class="yt-ai-dict-error"><p>${errorMsg}</p></div>`;
  createPanel(errorHTML, '發生錯誤', rect);
}

async function playAudio(audioUrl, button) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = '⏳';

  if (audioCache.has(audioUrl)) {
    try {
      const blobUrl = audioCache.get(audioUrl);
      const audio = new Audio(blobUrl);
      await audio.play();
      button.textContent = '✓';
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 1000);
    } catch (e) {
      URL.revokeObjectURL(audioCache.get(audioUrl));
      audioCache.delete(audioUrl);
      playAudio(audioUrl, button);
    }
    return;
  }

  chrome.runtime.sendMessage({ action: 'fetchAudio', url: audioUrl }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      console.error('音檔代理失敗:', chrome.runtime.lastError?.message || response?.error);
      button.textContent = '❌';
      showTooltip(button, '音檔載入失敗');
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 3000);
      return;
    }

    try {
      const blob = base64ToBlob(response.data, 'audio/mpeg');
      const blobUrl = URL.createObjectURL(blob);

      audioCache.set(audioUrl, blobUrl);

      const audio = new Audio(blobUrl);
      audio.play()
        .then(() => {
          button.textContent = '✓';
        })
        .catch(err => {
          console.error('音檔播放錯誤:', err);
          button.textContent = '❌';
          const errorMsg = err.name === 'NotAllowedError' ? '瀏覽器阻止自動播放' : '播放失敗';
          showTooltip(button, errorMsg);
        })
        .finally(() => {
          setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
          }, 1000);
        });
    } catch (e) {
      console.error('處理音檔數據時出錯:', e);
      button.textContent = '❌';
      showTooltip(button, '音檔格式錯誤');
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 3000);
    }
  });
}

function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

function showTooltip(element, message) {
  const tooltip = document.createElement('div');
  tooltip.className = 'yt-ai-dict-tooltip';
  tooltip.textContent = message;
  tooltip.style.cssText = `
    position: absolute;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    z-index: 999999;
    pointer-events: none;
  `;

  document.body.appendChild(tooltip);

  const rect = element.getBoundingClientRect();
  tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
  tooltip.style.left = `${rect.left + window.scrollX}px`;

  setTimeout(() => {
    tooltip.remove();
  }, 3000);
}

function showResultPanel(data, rect) {
  const { query, phonetics, definitions, verbForms, contextAnalysis } = data;
  let contentHTML = '';

  contentHTML += `
    <div class="dict-title-section">
      <h2 class="dict-query-word">${query}</h2>
      <div class="dict-phonetics">
        ${phonetics && phonetics.uk ? `
          <div class="dict-phonetic-item">
            <span class="dict-region">英</span>
            <span class="dict-ipa">${phonetics.uk.ipa || ''}</span>
            ${phonetics.uk.audio ? `<button class="dict-audio-btn" data-src="${phonetics.uk.audio}">🔊</button>` : ''}
          </div>` : ''}
        ${phonetics && phonetics.us ? `
          <div class="dict-phonetic-item">
            <span class="dict-region">美</span>
            <span class="dict-ipa">${phonetics.us.ipa || ''}</span>
            ${phonetics.us.audio ? `<button class="dict-audio-btn" data-src="${phonetics.us.audio}">🔊</button>` : ''}
          </div>` : ''}
      </div>
    </div>
  `;

  if (contextAnalysis && contextAnalysis.translation) {
    contentHTML += `
      <div class="dict-section dict-context-section">
        <h4>在句中含義 (Context)</h4>
        <p class="dict-context-translation">"${contextAnalysis.translation}"</p>
        ${contextAnalysis.explanation ? `<p class="dict-context-explanation">${contextAnalysis.explanation}</p>` : ''}
      </div>
    `;
  }

  if (definitions && definitions.length > 0) {
    contentHTML += '<div class="dict-section">';
    definitions.forEach(def => {
      contentHTML += `
        <div class="dict-def-block">
          <div class="dict-def-header">
            <strong class="dict-pos">${def.partOfSpeech}</strong>
            ${def.level ? `<span class="dict-level-tag">${def.level}</span>` : ''}
          </div>
          <div class="dict-meaning">${def.meaning}</div>
          ${def.synonyms && def.synonyms.length > 0 ? `<div class="dict-thesaurus"><strong>同義詞:</strong> ${def.synonyms.join(', ')}</div>` : ''}
          ${def.antonyms && def.antonyms.length > 0 ? `<div class="dict-thesaurus"><strong>反義詞:</strong> ${def.antonyms.join(', ')}</div>` : ''}
          ${def.example && def.example.en ? `
            <div class="dict-example">
              <p class="dict-example-en">${def.example.en}</p>
              <p class="dict-example-zh">${def.example.zh}</p>
            </div>
          ` : ''}
        </div>
      `;
    });
    contentHTML += '</div>';
  }

  if (verbForms) {
    contentHTML += `
      <div class="dict-section dict-forms-section">
        <h4>動詞變化</h4>
        <div class="dict-verb-forms">
          <span>現在式: <strong>${verbForms.present}</strong></span>
          <span>過去式: <strong>${verbForms.past}</strong></span>
          <span>過去分詞: <strong>${verbForms.pastParticiple}</strong></span>
          <span>現在分詞: <strong>${verbForms.presentParticiple}</strong></span>
        </div>
      </div>
    `;
  }

  createPanel(contentHTML, `AI 字典`, rect);

  currentPanel.querySelectorAll('.dict-audio-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const audioUrl = e.target.dataset.src;
      await playAudio(audioUrl, e.target);
    });
  });
}

// 頁面加載後執行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 新增：頁面卸載時清理定時器
window.addEventListener('beforeunload', () => {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
});