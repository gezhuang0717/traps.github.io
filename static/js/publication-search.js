/* Bibliography search: explicit list values also work without JavaScript. */
(() => {
  const normalize = text => String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function matches(record, filter) {
    const d = record.e.dataset;
    const roleMatches = !filter.role || (filter.role === 'second' ? d.position === '2'
      : filter.role === 'corresponding' ? d.corresponding === 'true' : d.role === filter.role);
    return filter.words.every(word => record.text.includes(word)) && (!filter.year || d.year === filter.year)
      && roleMatches && (!filter.topic || (d.themes || '').split(/\s+/).includes(filter.topic));
  }
  function mount(doc) {
    const root = doc.querySelector('[data-pub-search]');
    if (!root) return;
    const controls = Object.fromEntries(['query', 'year', 'role', 'topic'].map(key => [key, root.querySelector(`[name=pub-${key}]`)]));
    const topicLabels = Object.fromEntries([...controls.topic.options].map(option => [option.value, option.textContent]));
    const papers = [...doc.querySelectorAll('.zg-paper')];
    const records = papers.map(e => ({e, text: normalize(e.textContent + ' ' + (e.dataset.authors || '')
      + ' ' + [...e.querySelectorAll('a')].map(a => a.href).join(' ') + ' ' + e.dataset.themes
      + ' ' + (e.dataset.themes || '').split(/\s+/).filter(Boolean).map(topic => topicLabels[topic] || '').join(' '))}));
    const sections = [...doc.querySelectorAll('[data-pub-section]')];
    function render() {
      const filter = {words: normalize(controls.query.value).trim().split(/\s+/).filter(Boolean),
        year: controls.year.value, role: controls.role.value, topic: controls.topic.value};
      let count = 0;
      records.forEach(record => {record.e.hidden = !matches(record, filter); if (!record.e.hidden) count++;});
      // <summary> is a list-item in browsers and can double the implicit reversed count.
      doc.querySelectorAll('ol.zg-papers').forEach(list => {
        const visible = [...list.querySelectorAll('.zg-paper')].filter(e => !e.hidden);
        list.setAttribute('start', String(visible.length));
        visible.forEach((e, index) => e.setAttribute('value', String(visible.length - index)));
      });
      doc.querySelectorAll('.zg-year').forEach(h => {
        h.hidden = ![...h.nextElementSibling.querySelectorAll('.zg-paper')].some(e => !e.hidden);
        h.nextElementSibling.hidden = h.hidden;
      });
      sections.forEach(section => {
        const total = section.querySelector('[data-pub-section-count]');
        const visible = [...section.querySelectorAll('.zg-paper')].filter(e => !e.hidden).length;
        total.textContent = `${visible} / ${total.dataset.total} ${root.dataset.papersLabel}`;
        section.hidden = visible === 0;
        if (section.previousElementSibling?.tagName === 'H2') section.previousElementSibling.hidden = visible === 0;
      });
      root.querySelector('[data-pub-count]').textContent = `${count} / ${papers.length} ${root.dataset.papersLabel}`;
      root.querySelector('[data-pub-empty]').hidden = count !== 0;
    }
    root.addEventListener('input', render);
    root.addEventListener('change', render);
    root.querySelector('[data-pub-reset]').addEventListener('click', () => {
      Object.values(controls).forEach(control => {control.value = '';}); render(); controls.query.focus();
    });
    render();
    return {render};
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {normalize, matches, mount};
  if (typeof document !== 'undefined') mount(document);
})();
