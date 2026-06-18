/* ============================================================
   SnapSight — AI Photo Analyzer
   app.js — Core Application Logic
   Uses Google Gemini 2.5 Pro (multimodal) for analysis
   ============================================================ */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────
  const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const STORAGE_KEY = 'snapsight_api_key';

  // ── State ──────────────────────────────────────────────────
  let currentImage = null; // { base64, mimeType }
  let currentStream = null;
  let facingMode = 'environment'; // rear camera by default

  // ── DOM Refs ───────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  const dropZone = $('dropZone');
  const fileInput = $('fileInput');
  const uploadBtn = $('uploadBtn');
  const cameraBtn = $('cameraBtn');
  const previewContent = $('previewContent');
  const uploadContent = $('uploadContent');
  const previewImg = $('previewImg');
  const removeImg = $('removeImg');
  const analyzeBtn = $('analyzeBtn');

  const cameraPanel = $('cameraPanel');
  const cameraFeed = $('cameraFeed');
  const captureBtn = $('captureBtn');
  const closeCameraBtn = $('closeCameraBtn');
  const switchCameraBtn = $('switchCameraBtn');
  const captureCanvas = $('captureCanvas');

  const resultsSection = $('resultsSection');
  const loadingState = $('loadingState');
  const resultState = $('resultState');
  const errorState = $('errorState');
  const errorMsg = $('errorMsg');
  const resultThumb = $('resultThumb');
  const resultSections = $('resultSections');
  const copyBtn = $('copyBtn');
  const analyzeAnotherBtn = $('analyzeAnotherBtn');
  const retryBtn = $('retryBtn');

  const apiModal = $('apiModal');
  const apiKeyBtn = $('apiKeyBtn');
  const apiKeyStatus = $('apiKeyStatus');
  const apiKeyInput = $('apiKeyInput');
  const saveApiKey = $('saveApiKey');
  const cancelModal = $('cancelModal');
  const closeModal = $('closeModal');
  const toggleKey = $('toggleKey');

  // ── API Key Management ─────────────────────────────────────
  function getApiKey() {
    return localStorage.getItem(STORAGE_KEY) || '';
  }

  function setApiKey(key) {
    localStorage.setItem(STORAGE_KEY, key.trim());
    updateKeyStatus();
  }

  function updateKeyStatus() {
    const key = getApiKey();
    if (key) {
      apiKeyStatus.textContent = 'API Key ✓';
      apiKeyBtn.style.borderColor = 'rgba(34, 197, 94, 0.4)';
      apiKeyBtn.style.color = '#22c55e';
    } else {
      apiKeyStatus.textContent = 'Set API Key';
      apiKeyBtn.style.borderColor = '';
      apiKeyBtn.style.color = '';
    }
  }

  function openModal() {
    apiKeyInput.value = getApiKey();
    apiModal.classList.add('active');
    setTimeout(() => apiKeyInput.focus(), 200);
  }

  function closeModalFn() {
    apiModal.classList.remove('active');
  }

  apiKeyBtn.addEventListener('click', openModal);
  closeModal.addEventListener('click', closeModalFn);
  cancelModal.addEventListener('click', closeModalFn);
  apiModal.addEventListener('click', e => {
    if (e.target === apiModal) closeModalFn();
  });

  saveApiKey.addEventListener('click', () => {
    const val = apiKeyInput.value.trim();
    if (!val) return shake(apiKeyInput);
    setApiKey(val);
    closeModalFn();
  });

  toggleKey.addEventListener('click', () => {
    const isPass = apiKeyInput.type === 'password';
    apiKeyInput.type = isPass ? 'text' : 'password';
    const eyeIcon = $('eyeIcon');
    eyeIcon.innerHTML = isPass
      ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`
      : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  });

  function shake(el) {
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'shake 0.4s ease';
    el.style.borderColor = '#ef4444';
    setTimeout(() => {
      el.style.borderColor = '';
    }, 800);
  }

  // Add shake keyframe dynamically
  const shakeStyle = document.createElement('style');
  shakeStyle.textContent = `@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }`;
  document.head.appendChild(shakeStyle);

  // ── File Upload ────────────────────────────────────────────
  uploadBtn.addEventListener('click', e => {
    e.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });

  dropZone.addEventListener('click', e => {
    if (!uploadContent.contains(e.target) && !previewContent.contains(e.target)) return;
    if (e.target === uploadBtn || uploadBtn.contains(e.target)) return;
    if (e.target === cameraBtn || cameraBtn.contains(e.target)) return;
  });

  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleFile(file);
    fileInput.value = '';
  });

  // Drag & Drop
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', e => {
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove('dragover');
    }
  });

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  });

  function handleFile(file) {
    if (!file.type.startsWith('image/')) return;
    // Compress before processing — mobile photos can be 8MB+
    compressImage(file, 1024, 0.85).then(({ base64, mimeType, dataUrl }) => {
      currentImage = { base64, mimeType, dataUrl };
      showPreview(dataUrl);
    });
  }

  // Compress & resize image to max dimension, returns { base64, mimeType, dataUrl }
  function compressImage(file, maxDim, quality) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
            else                { width = Math.round(width * maxDim / height);  height = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', dataUrl });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function showPreview(dataUrl) {
    previewImg.src = dataUrl;
    uploadContent.style.display = 'none';
    previewContent.style.display = 'flex';
    dropZone.style.cursor = 'default';
    dropZone.removeAttribute('tabindex');
    hideResults();
  }

  removeImg.addEventListener('click', e => {
    e.stopPropagation();
    resetUpload();
  });

  function resetUpload() {
    currentImage = null;
    previewImg.src = '';
    uploadContent.style.display = '';
    previewContent.style.display = 'none';
    dropZone.style.cursor = '';
    dropZone.setAttribute('tabindex', '0');
    hideResults();
  }

  // ── Camera ─────────────────────────────────────────────────
  cameraBtn.addEventListener('click', async e => {
    e.stopPropagation();
    await startCamera();
  });

  async function startCamera() {
    try {
      if (currentStream) stopCamera();
      currentStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      cameraFeed.srcObject = currentStream;
      dropZone.style.display = 'none';
      cameraPanel.style.display = 'block';
    } catch (err) {
      console.error('Camera error:', err);
      alert('Could not access camera. Please allow camera permission or use file upload.');
    }
  }

  function stopCamera() {
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
    }
    cameraFeed.srcObject = null;
    cameraPanel.style.display = 'none';
    dropZone.style.display = '';
  }

  closeCameraBtn.addEventListener('click', stopCamera);

  switchCameraBtn.addEventListener('click', async () => {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    await startCamera();
  });

  captureBtn.addEventListener('click', () => {
    const video = cameraFeed;
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    captureCanvas.toBlob(blob => {
      if (!blob) return;
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target.result;
        const base64 = dataUrl.split(',')[1];
        currentImage = { base64, mimeType: 'image/jpeg', dataUrl };
        stopCamera();
        showPreview(dataUrl);
      };
      reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.95);
  });

  // ── Analysis ───────────────────────────────────────────────
  analyzeBtn.addEventListener('click', startAnalysis);

  async function startAnalysis() {
    const apiKey = getApiKey();
    if (!apiKey) {
      openModal();
      return;
    }
    if (!currentImage) return;

    showResults('loading');
    animateLoadingSteps();

    try {
      const description = await analyzeImage(currentImage, apiKey);
      displayResults(description);
    } catch (err) {
      console.error('Analysis error:', err);
      showResults('error');
      errorMsg.textContent = err.message || 'An unexpected error occurred. Please check your API key and try again.';
    }
  }

  async function analyzeImage({ base64, mimeType }, apiKey) {
    const prompt = `You are a world-class visual intelligence AI. Analyze this image with exceptional detail and provide a structured report covering:

1. **OVERVIEW** — Write 2-3 engaging sentences describing what this image shows overall. Make it vivid and informative.

2. **LOCATION & SCENE** — Identify the environment: Is it indoors or outdoors? What type of location is it (e.g., kitchen, city street, beach, forest, museum, restaurant, office)? What country, region, or architectural style is suggested? Include time of day or season if determinable.

3. **MAIN SUBJECTS** — List and describe the primary subjects in detail (people, animals, objects, landmarks). Include counts, descriptions, positions, and any notable features.

4. **DETAILS & BACKGROUND** — Describe the background, secondary elements, textures, patterns, and any interesting details in the scene.

5. **TEXT & SIGNS** — Transcribe any visible text, signs, labels, brands, or written content. If none, say "None detected."

6. **COLORS & MOOD** — Describe the dominant colors, lighting quality, atmosphere, and emotional mood the image conveys.

7. **TAGS** — Provide 8-12 comma-separated keyword tags that best describe this image (for search/categorization).

Format each section clearly with the section name as a header. Be specific, confident, and comprehensive.`;

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                }
              },
              {
                type: 'text',
                text: prompt,
              }
            ]
          }
        ],
        temperature: 0.7,
        max_tokens: 2048,
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.error?.message || `API error ${response.status}`;
      throw new Error(msg);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('No response received from AI. Please try again.');
    return text;
  }

  // ── Results Rendering ──────────────────────────────────────
  let rawAnalysisText = '';

  function displayResults(text) {
    rawAnalysisText = text;
    resultThumb.src = currentImage.dataUrl;
    resultSections.innerHTML = '';

    const sectionDefs = [
      { key: 'OVERVIEW', label: 'Overview', color: '#7c6dfa', icon: '🌐' },
      { key: 'LOCATION & SCENE', label: 'Location & Scene', color: '#3ec6f5', icon: '📍' },
      { key: 'MAIN SUBJECTS', label: 'Main Subjects', color: '#22c55e', icon: '🎯' },
      { key: 'DETAILS & BACKGROUND', label: 'Details & Background', color: '#f97316', icon: '🔍' },
      { key: 'TEXT & SIGNS', label: 'Text & Signs', color: '#fbbf24', icon: '📝' },
      { key: 'COLORS & MOOD', label: 'Colors & Mood', color: '#f472b6', icon: '🎨' },
      { key: 'TAGS', label: 'Tags', color: '#a78bfa', icon: '🏷️', isTags: true },
    ];

    // Parse sections from markdown text
    const parsed = parseSections(text, sectionDefs);

    parsed.forEach((section, i) => {
      const el = document.createElement('div');
      el.className = 'result-section';
      el.style.animationDelay = `${i * 0.07}s`;

      if (section.isTags) {
        const tags = section.content.split(',').map(t => t.trim()).filter(Boolean);
        el.innerHTML = `
          <div class="section-label">
            <span class="section-dot" style="background:${section.color}"></span>
            ${section.icon} ${section.label}
          </div>
          <div class="section-tags">
            ${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
          </div>`;
      } else {
        el.innerHTML = `
          <div class="section-label">
            <span class="section-dot" style="background:${section.color}"></span>
            ${section.icon} ${section.label}
          </div>
          <div class="section-content">${formatContent(section.content)}</div>`;
      }

      resultSections.appendChild(el);
    });

    showResults('result');
  }

  function parseSections(text, defs) {
    const results = [];

    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      const nextDef = defs[i + 1];

      // Build regex to find section
      const escapedKey = def.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        `(?:\\*{1,2}\\s*(?:\\d+\\.\\s*)?${escapedKey}\\s*\\*{0,2}|##?\\s*(?:\\d+\\.\\s*)?${escapedKey})\\s*[:\\-—]?\\s*`,
        'i'
      );

      const match = text.match(pattern);
      if (!match) {
        results.push({ ...def, content: 'Not identified in this image.' });
        continue;
      }

      const startIdx = match.index + match[0].length;
      let endIdx = text.length;

      if (nextDef) {
        const nextEscaped = nextDef.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nextPattern = new RegExp(
          `(?:\\*{1,2}\\s*(?:\\d+\\.\\s*)?${nextEscaped}\\s*\\*{0,2}|##?\\s*(?:\\d+\\.\\s*)?${nextEscaped})`,
          'i'
        );
        const nextMatch = text.slice(startIdx).match(nextPattern);
        if (nextMatch) endIdx = startIdx + nextMatch.index;
      }

      let content = text.slice(startIdx, endIdx).trim();
      content = content.replace(/^\s*[-—:]\s*/, '').trim();
      results.push({ ...def, content: content || 'Not identified in this image.' });
    }

    return results;
  }

  function formatContent(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ── Copy ───────────────────────────────────────────────────
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(rawAnalysisText);
      copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>`;
      copyBtn.style.color = '#22c55e';
      copyBtn.style.borderColor = 'rgba(34,197,94,0.4)';
      setTimeout(() => {
        copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
        copyBtn.style.color = '';
        copyBtn.style.borderColor = '';
      }, 2000);
    } catch {
      /* ignore */
    }
  });

  analyzeAnotherBtn.addEventListener('click', resetUpload);
  retryBtn.addEventListener('click', startAnalysis);

  // ── Loading Animation ──────────────────────────────────────
  function animateLoadingSteps() {
    const steps = ['step1', 'step2', 'step3'];
    let current = 0;
    steps.forEach(id => {
      const el = $(id);
      if (el) el.classList.remove('active');
    });
    const el1 = $('step1');
    if (el1) el1.classList.add('active');

    const interval = setInterval(() => {
      current++;
      if (current >= steps.length) { clearInterval(interval); return; }
      steps.forEach(id => { const el = $(id); if (el) el.classList.remove('active'); });
      const el = $(steps[current]);
      if (el) el.classList.add('active');
    }, 1200);
  }

  // ── UI State ───────────────────────────────────────────────
  function showResults(state) {
    resultsSection.style.display = 'block';
    loadingState.style.display = 'none';
    resultState.style.display = 'none';
    errorState.style.display = 'none';

    if (state === 'loading') {
      loadingState.style.display = 'flex';
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (state === 'result') {
      resultState.style.display = 'block';
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (state === 'error') {
      errorState.style.display = 'flex';
    }
  }

  function hideResults() {
    resultsSection.style.display = 'none';
    loadingState.style.display = 'none';
    resultState.style.display = 'none';
    errorState.style.display = 'none';
  }

  // ── Init ───────────────────────────────────────────────────
  updateKeyStatus();

  // Auto-prompt API key on first load if not set
  if (!getApiKey()) {
    setTimeout(openModal, 600);
  }

  // Keyboard escape to close modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && apiModal.classList.contains('active')) {
      closeModalFn();
    }
  });

  console.log('%c📸 SnapSight AI Photo Analyzer', 'font-size:16px;font-weight:bold;color:#7c6dfa;');
  console.log('%cPowered by Llama 4 Scout Vision via Groq — 100% Free!', 'color:#3ec6f5;');
})();
