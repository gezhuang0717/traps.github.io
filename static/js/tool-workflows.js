/* Localized guidance only: no simulation inputs, controls or result values are changed. */
(function (root) {
  'use strict';
  if (root.TrapsToolWorkflows) return;
  const fields = ['purpose', 'inputs', 'outputs', 'gain', 'hint', 'limits'];
  let sequence = 0;
  function make(tag, text, doc) {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    return node;
  }
  function addDescription(node, id) {
    const refs = new Set((node.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    refs.add(id);
    node.setAttribute('aria-describedby', [...refs].join(' '));
  }
  function guide(target, key, labels, text, doc) {
    if (target.hasAttribute('data-workflow-guide')) return;
    if (!fields.every(k => typeof text[k] === 'string' && text[k].trim())) return;
    const existing = target.matches('details[data-control-help]');
    const box = existing ? target : make('details', '', doc);
    if (!existing) {
      box.className = 'zg-control-help zg-workflow-guide';
      box.append(make('summary', labels.title, doc));
    } else {
      const summary = box.querySelector('summary');
      if (summary) summary.textContent = labels.title;
    }
    const dl = make('dl', '', doc);
    dl.className = 'zg-workflow-fields';
    do { dl.id = 'zg-workflow-' + (++sequence); } while (doc.getElementById(dl.id));
    for (const field of fields) dl.append(make('dt', labels[field], doc), make('dd', text[field], doc));
    const summary = box.querySelector('summary');
    if (summary) summary.after(dl); else box.append(dl);
    target.setAttribute('data-workflow-guide', key);
    if (!existing) {
      const heading = target.querySelector('h2,h3,h4,header');
      if (target.matches('figure,video')) target.after(box);
      else if (heading && heading.parentElement === target) heading.after(box);
      else target.prepend(box);
    }
    const section = existing ? target.closest('section') || target.parentElement : target;
    if (section) {
      section.setAttribute('data-workflow-guide-ref', dl.id);
      if (section.matches('figure,video,canvas,svg[role="img"]')) addDescription(section, dl.id);
      for (const media of section.querySelectorAll('figure,video,canvas,svg[role="img"],.sp-plot')) addDescription(media, dl.id);
    }
  }
  function mount(doc) {
    for (const node of doc.querySelectorAll('[data-tool-workflows-config]')) {
      let config;
      try { config = JSON.parse(node.getAttribute('data-tool-workflows-config')); } catch (_) { continue; }
      if (!config.labels || !config.topics) continue;
      for (const [key, topic] of Object.entries(config.topics)) {
        for (const selector of topic.selectors || []) {
          let targets;
          try { targets = doc.querySelectorAll(selector); } catch (_) { continue; }
          for (const target of targets) guide(target, key, config.labels, topic.text, doc);
        }
      }
      const mediaProfile = config.topics.media;
      if (mediaProfile) {
        for (const media of doc.querySelectorAll('main figure, main video')) {
          if (!media.closest('[data-workflow-guide-ref]')) guide(media, 'media', config.labels, mediaProfile.text, doc);
        }
      }
    }
    // Replaced plots and asynchronously loaded videos retain their panel's explanation.
    for (const section of doc.querySelectorAll('[data-workflow-guide-ref]')) {
      const id = section.getAttribute('data-workflow-guide-ref');
      for (const media of section.querySelectorAll('figure,video,canvas,svg[role="img"],.sp-plot')) addDescription(media, id);
    }
  }
  root.TrapsToolWorkflows = Object.freeze({ mount });
  function start() {
    mount(root.document);
    let queued = false;
    const relevant = 'section,figure,video,canvas,svg[role="img"],details[data-control-help]';
    const observer = new MutationObserver(records => {
      // Animated numerical readouts change text frequently; only new plot/tool
      // elements need another guidance pass.
      if (queued || !records.some(r => [...r.addedNodes].some(n => n.nodeType === 1 &&
          (n.matches(relevant) || n.querySelector(relevant))))) return;
      queued = true;
      queueMicrotask(() => { queued = false; mount(root.document); });
    });
    const scope = root.document.querySelector('main') || root.document.body;
    if (scope) observer.observe(scope, {childList: true, subtree: true});
  }
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})(window);
