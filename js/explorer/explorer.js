import { api } from './modules/api.js';
import { classifySearch } from './modules/validation.js';
import { formatInteger } from './modules/format.js';
import { renderActivityRows, renderTransaction, renderAnalyst } from './modules/views.js';
import { t, getLocale } from './modules/i18n.js';

const dom = Object.freeze({
  form: document.querySelector('#search-form'),
  input: document.querySelector('#search-input'),
  error: document.querySelector('#search-error'),
  sourceHealth: document.querySelector('#source-health'),
  activeSource: document.querySelector('#active-source'),
  activityContext: document.querySelector('#activity-context'),
  message: document.querySelector('#activity-message'),
  body: document.querySelector('#activity-body'),
  empty: document.querySelector('#activity-empty'),
  refresh: document.querySelector('#refresh-activity'),
  summaryTransfers: document.querySelector('#summary-transfers'),
  summaryAddresses: document.querySelector('#summary-addresses'),
  summaryBlock: document.querySelector('#summary-block'),
  summaryScope: document.querySelector('#summary-scope'),
  summaryTransferNote: document.querySelector('#summary-transfer-note'),
  summaryScopeNote: document.querySelector('#summary-scope-note'),
  transactionSection: document.querySelector('#transaction-section'),
  transactionContent: document.querySelector('#transaction-content'),
  transactionMessage: document.querySelector('#transaction-message'),
  closeTransaction: document.querySelector('#close-transaction'),
  analystForm: document.querySelector('#analyst-form'),
  analystInput: document.querySelector('#analyst-input'),
  analystMessage: document.querySelector('#analyst-message'),
  analystResult: document.querySelector('#analyst-result'),
  analystContext: document.querySelector('#analyst-context'),
  analystStatus: document.querySelector('#analyst-status'),
  analystSubmit: document.querySelector('#analyst-submit'),
  analystPresets: [...document.querySelectorAll('[data-analyst-preset]')],
});

let currentAddress = null;
let analystScope = 'recent';
let analystTarget = null;

function showMessage(node, message, tone = 'info') {
  node.textContent = message || '';
  node.dataset.tone = tone;
  node.hidden = !message;
}

function setHealth(status) {
  const live = Boolean(status?.available);
  dom.sourceHealth.textContent = live ? t('liveSource') : t('unavailable');
  dom.sourceHealth.dataset.state = live ? 'live' : 'unavailable';
  const label = status?.sourceLabel || (status?.activeSource === 'the_graph' ? 'The Graph' : status?.activeSource === 'base_rpc' ? 'Base Sepolia JSON-RPC' : t('unavailable'));
  dom.activeSource.textContent = label;
}


function setAnalystContext(scope = 'recent', target = null) {
  analystScope = scope;
  analystTarget = target || null;
  if (!dom.analystContext) return;
  dom.analystContext.textContent = scope === 'transaction'
    ? t('analystContextTransaction', target)
    : scope === 'address'
      ? t('analystContextAddress', target)
      : t('analystContextRecent');
}

function setAnalystStatus(status) {
  if (!dom.analystStatus) return;
  const configured = Boolean(status?.analyst?.configured);
  dom.analystStatus.textContent = configured ? t('analystConfigured') : t('analystNotConfigured');
  dom.analystStatus.dataset.state = configured ? 'live' : 'unavailable';
}

function resetSummary() {
  dom.summaryTransfers.textContent = '—';
  dom.summaryAddresses.textContent = '—';
  dom.summaryBlock.textContent = '—';
  dom.summaryScope.textContent = '—';
  dom.summaryTransferNote.textContent = t('summaryLoading');
  dom.summaryScopeNote.textContent = t('metadataLoading');
}

function applySummary(result) {
  const summary = result.summary;
  dom.summaryTransfers.textContent = formatInteger(summary.visibleTransfers);
  dom.summaryAddresses.textContent = formatInteger(summary.visibleAddresses);
  dom.summaryBlock.textContent = summary.latestIndexedOrScannedBlock ? formatInteger(summary.latestIndexedOrScannedBlock) : t('unavailable');
  dom.summaryScope.textContent = summary.completeHistory ? t('indexed') : t('recentWindow');
  dom.summaryTransferNote.textContent = result.queryScope === 'token_contract'
    ? t('contractTransferNote')
    : result.queryScope === 'address'
      ? t('addressTransferNote')
      : t('resultTransferNote');
  dom.summaryScopeNote.textContent = summary.completeHistory
    ? t('indexedHistory')
    : summary.scannedFromBlock
      ? t('rpcScan', formatInteger(summary.scannedFromBlock))
      : t('scopeUnavailable');
}

async function loadStatus() {
  try {
    const status = await api.status();
    setHealth(status);
    setAnalystStatus(status);
  } catch {
    setHealth({ available: false, activeSource: 'unavailable' });
    setAnalystStatus({ analyst: { configured: false } });
  }
}

async function loadActivity({ address = currentAddress } = {}) {
  currentAddress = address || null;
  dom.refresh.disabled = true;
  resetSummary();
  showMessage(dom.message, t('loadingActivity'));
  dom.empty.hidden = true;
  dom.body.replaceChildren();

  try {
    const result = await api.activity({ address: currentAddress, limit: 30 });
    dom.activeSource.textContent = result.sourceLabel;
    dom.activityContext.textContent = result.queryScope === 'token_contract'
      ? t('contractContext', currentAddress)
      : result.queryScope === 'address'
        ? t('addressContext', currentAddress)
        : t('recentContext');
    applySummary(result);
    renderActivityRows(dom.body, result.transfers || []);
    dom.empty.hidden = Boolean(result.transfers?.length);
    showMessage(dom.message, result.warning, result.warning ? 'warning' : 'info');
    if (currentAddress) setAnalystContext('address', currentAddress);
    else setAnalystContext('recent', null);
  } catch (error) {
    dom.activityContext.textContent = currentAddress ? t('addressFailed', currentAddress) : t('activityUnavailable');
    dom.empty.hidden = false;
    showMessage(dom.message, `${error.message} ${t('noMock')}`, 'error');
    dom.activeSource.textContent = t('unavailable');
  } finally {
    dom.refresh.disabled = false;
  }
}

async function loadTransaction(hash, { updateUrl = true } = {}) {
  dom.transactionSection.hidden = false;
  dom.transactionContent.replaceChildren();
  showMessage(dom.transactionMessage, t('loadingTx'));
  dom.transactionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const result = await api.transaction(hash);
    renderTransaction(dom.transactionContent, result);
    setAnalystContext('transaction', hash);
    showMessage(dom.transactionMessage, result.warning, result.warning ? 'warning' : 'info');
    if (updateUrl) history.replaceState(null, '', `?tx=${encodeURIComponent(hash)}#transaction-section`);
  } catch (error) {
    const message = error.code === 'TRANSACTION_NOT_FOUND'
      ? `${error.message} ${t('txNotFoundSuffix')}`
      : `${error.message} ${t('txUnavailableSuffix')}`;
    showMessage(dom.transactionMessage, message, 'error');
  }
}

function closeTransaction() {
  dom.transactionSection.hidden = true;
  dom.transactionContent.replaceChildren();
  showMessage(dom.transactionMessage, '');
  const basePath = window.location.pathname || '/';
  history.replaceState(null, '', currentAddress ? `${basePath}?address=${encodeURIComponent(currentAddress)}#activity` : `${basePath}#activity`);
  setAnalystContext(currentAddress ? 'address' : 'recent', currentAddress);
}

dom.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const target = classifySearch(dom.input.value);
  if (!target) {
    dom.error.textContent = t('invalidSearch');
    dom.error.hidden = false;
    dom.input.setAttribute('aria-invalid', 'true');
    return;
  }
  dom.error.hidden = true;
  dom.input.removeAttribute('aria-invalid');

  if (target.type === 'transaction') {
    loadTransaction(target.value);
  } else {
    currentAddress = target.value;
    history.replaceState(null, '', `?address=${encodeURIComponent(target.value)}#activity`);
    loadActivity({ address: target.value });
    document.querySelector('#activity').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});


async function runAnalyst(question) {
  if (!dom.analystForm || !dom.analystResult) return;
  const trimmed = String(question || '').trim();
  if (trimmed.length < 3) return;

  dom.analystSubmit.disabled = true;
  dom.analystResult.hidden = true;
  dom.analystResult.replaceChildren();
  showMessage(dom.analystMessage, t('analystLoading'));

  try {
    const result = await api.analyst({
      question: trimmed,
      scope: analystScope,
      target: analystTarget,
      locale: getLocale(),
    });
    renderAnalyst(dom.analystResult, result);
    dom.analystResult.hidden = false;
    showMessage(dom.analystMessage, '');
  } catch (error) {
    showMessage(dom.analystMessage, `${error.message || t('analystFailed')}`, 'error');
  } finally {
    dom.analystSubmit.disabled = false;
  }
}

if (dom.analystForm) {
  dom.analystForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runAnalyst(dom.analystInput.value);
  });

  for (const button of dom.analystPresets) {
    button.addEventListener('click', () => {
      const question = button.dataset.analystPreset || button.textContent || '';
      dom.analystInput.value = question;
      runAnalyst(question);
    });
  }
}

dom.refresh.addEventListener('click', () => loadActivity());
dom.closeTransaction.addEventListener('click', closeTransaction);

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="?tx="]');
  if (!link) return;
  const url = new URL(link.href, window.location.href);
  const target = classifySearch(url.searchParams.get('tx'));
  if (target?.type !== 'transaction') return;
  event.preventDefault();
  loadTransaction(target.value);
});

const params = new URLSearchParams(window.location.search);
const addressParam = classifySearch(params.get('address'));
const txParam = classifySearch(params.get('tx'));
if (addressParam?.type === 'address') {
  currentAddress = addressParam.value;
  dom.input.value = addressParam.value;
}

await Promise.all([loadStatus(), loadActivity({ address: currentAddress })]);
if (txParam?.type === 'transaction') {
  dom.input.value = txParam.value;
  await loadTransaction(txParam.value, { updateUrl: false });
}
