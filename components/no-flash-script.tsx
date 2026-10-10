import {
  USAGE_OVERVIEW_HIDDEN_KEY,
  USAGE_OVERVIEW_DATA_ATTR,
  USAGE_OVERVIEW_HIDDEN_VALUE,
} from '@/lib/storage-keys';

export function NoFlashScript() {
  const overviewKey = JSON.stringify(USAGE_OVERVIEW_HIDDEN_KEY);
  const overviewAttr = JSON.stringify(USAGE_OVERVIEW_DATA_ATTR);
  const overviewHiddenValue = JSON.stringify(USAGE_OVERVIEW_HIDDEN_VALUE);
  const code = `
(function(){
  try {
    var root = document.documentElement;
    root.classList.remove('theme-light','theme-dark');
    root.classList.add('theme-light');
    root.setAttribute('data-theme', 'light');
  } catch (e) {}
  try {
    var hidden = null;
    try { hidden = localStorage.getItem(${overviewKey}); } catch (_) {}
    if (hidden === '1') document.documentElement.setAttribute(${overviewAttr}, ${overviewHiddenValue});
  } catch (e) {}
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
