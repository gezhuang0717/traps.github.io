/* Runtime translation lookup for the cooling scripts. The page embeds a dictionary (English text -> text in the page language)
   in #zg-cooling-i18n[data-dict]; ZGTr(en) returns the translation or the English text itself. English and Chinese keep their
   own inline pairs; this only localises the other languages. */
(() => {
  "use strict";
  let dict = {};
  try {
    const el = document.getElementById("zg-cooling-i18n");
    dict = JSON.parse((el && el.dataset.dict) || "{}") || {};
  } catch (e) {
    dict = {};
  }
  window.ZGTr = en => (Object.prototype.hasOwnProperty.call(dict, en) ? dict[en] : en);
})();
