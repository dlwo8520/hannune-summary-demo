/* Buildless, browser-local demo: no requests, model execution or stored visitor data. */
(() => {
  'use strict';
  const examples = window.HANNUNE_EXAMPLES;
  if (!Array.isArray(examples) || !examples.length) return;
  const byId = (id) => document.getElementById(id);
  const elements = Object.fromEntries([
    'example-list', 'example-category', 'example-title', 'source-text', 'source-count',
    'model-name', 'summary-text', 'original-length', 'summary-length', 'reduction',
    'selection-status', 'toast'
  ].map((id) => [id, byId(id)]));
  const languageButtons = [...document.querySelectorAll('[data-language]')];
  const remembered = {};
  let selected;
  let toastTimer;
  const characterCount = (text) => Array.from(text).length;
  const formatCount = (text) => `${characterCount(text).toLocaleString('ko-KR')}자`;

  function toast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 3500);
  }

  function render(item, announce = true) {
    selected = item;
    remembered[item.language] = item.id;
    languageButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.language === item.language)));
    elements['example-list'].replaceChildren();
    examples.filter((example) => example.language === item.language).forEach((example) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = example.label;
      button.dataset.example = example.id;
      button.setAttribute('aria-pressed', String(example.id === item.id));
      elements['example-list'].append(button);
    });
    elements['example-category'].textContent = item.category;
    elements['example-title'].textContent = item.title;
    elements['source-text'].value = item.source;
    elements['source-text'].scrollTop = 0;
    const language = item.language === 'kr' ? 'ko' : 'en';
    ['source-text', 'summary-text', 'example-title'].forEach((id) => { elements[id].lang = language; });
    elements['summary-text'].textContent = item.summary;
    elements['model-name'].textContent = item.model;
    elements['source-count'].textContent = formatCount(item.source);
    elements['original-length'].textContent = formatCount(item.source);
    elements['summary-length'].textContent = formatCount(item.summary);
    const reduction = Math.round((1 - characterCount(item.summary) / characterCount(item.source)) * 100);
    elements.reduction.textContent = `${reduction}% 짧게`;
    elements.reduction.setAttribute('aria-label', `원문 대비 글자 수 ${reduction}% 감소`);
    if (announce) elements['selection-status'].textContent = `${item.label} 예시의 원문과 요약을 표시했습니다.`;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('example', item.id);
      window.history.replaceState(null, '', url);
    } catch { /* Opening index.html directly still works without history support. */ }
  }

  languageButtons.forEach((button) => button.addEventListener('click', () => {
    const language = button.dataset.language;
    render(examples.find((item) => item.id === remembered[language]) || examples.find((item) => item.language === language));
  }));
  elements['example-list'].addEventListener('click', (event) => {
    const button = event.target.closest('button[data-example]');
    if (!button) return;
    const id = button.dataset.example;
    render(examples.find((item) => item.id === id));
    elements['example-list'].querySelector(`[data-example="${id}"]`).focus({ preventScroll: true });
  });
  byId('next-example').addEventListener('click', () => {
    const choices = examples.filter((item) => item.language === selected.language);
    render(choices[(choices.indexOf(selected) + 1) % choices.length]);
  });

  async function copy(text, success) {
    try {
      await navigator.clipboard.writeText(text);
      toast(success);
    } catch {
      toast('복사를 허용하지 않는 브라우저예요. 텍스트나 주소를 직접 선택해 복사해 주세요.');
    }
  }
  byId('copy-button').addEventListener('click', () => copy(selected.summary, '요약을 복사했어요.'));
  byId('share-button').addEventListener('click', () => copy(window.location.href, '이 예시의 링크를 복사했어요.'));
  byId('download-button').addEventListener('click', () => {
    const content = `한눈에 · 고정 예시\n${selected.title}\n모델: ${selected.model} (사전 생성)\n\n[요약]\n${selected.summary}\n\n[원문]\n${selected.source}\n\n시연용 창작 문서입니다. 실시간 요약 결과가 아닙니다.\n`;
    const url = URL.createObjectURL(new Blob(['\ufeff', content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `hannune-${selected.id}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('텍스트 파일 다운로드를 시작했어요.');
  });
  function fromLocation() {
    const id = new URL(window.location.href).searchParams.get('example');
    return examples.find((item) => item.id === id) || examples[0];
  }
  window.addEventListener('popstate', () => render(fromLocation()));
  render(fromLocation(), false);
})();
