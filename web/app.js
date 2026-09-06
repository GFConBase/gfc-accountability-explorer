import { api } from './modules/api.js';
import { classifySearch } from './modules/validation.js';
import { formatInteger } from './modules/format.js';
import { renderActivityRows, renderTransaction } from './modules/views.js';

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
});

let currentAddress = null;

function showMessage(node, message, tone = 'info') {
  node.textContent = message || '';
  node.dataset.tone = tone;
  node.hidden = !message;
}

function setHealth(status) {
  const live = Boolean(status?.available);
  dom.sourceHealth.textContent = live ? 'Live source' : 'Unavailable';
  dom.sourceHealth.dataset.state = live ? 'live' : 'unavailable';
  const label = status?.sourceLabel || (status?.activeSource === 'the_graph' ? 'The Graph' : status?.activeSource === 'base_rpc' ? 'Base Sepolia JSON-RPC' : 'Unavailable');
  dom.activeSource.textContent = label;
}

function resetSummary() {
  dom.summaryTransfers.textContent = '—';
  dom.summaryAddresses.textContent = '—';
  dom.summaryBlock.textContent = '—';
  dom.summaryScope.textContent = '—';
  dom.summaryTransferNote.textContent = 'Loading live data';
  dom.summaryScopeNote.textContent = 'Loading source metadata';
}

function applySummary(result) {
  const summary = result.summary;
  dom.summaryTransfers.textContent = formatInteger(summary.visibleTransfers);
  dom.summaryAddresses.textContent = formatInteger(summary.visibleAddresses);
  dom.summaryBlock.textContent = summary.latestIndexedOrScannedBlock ? formatInteger(summary.latestIndexedOrScannedBlock) : 'Unavailable';
  dom.summaryScope.textContent = summary.completeHistory ? 'Indexed' : 'Recent window';
  dom.summaryTransferNote.textContent = currentAddress ? 'Transfers involving searched address' : 'Within the displayed result set';
  dom.summaryScopeNote.textContent = summary.completeHistory
    ? 'Source reports indexed history for this subgraph'
    : summary.scannedFromBlock
      ? `RPC scan starts at block ${formatInteger(summary.scannedFromBlock)}`
      : 'Source scope unavailable';
}

async function loadStatus() {
  try {
    setHealth(await api.status());
  } catch {
    setHealth({ available: false, activeSource: 'unavailable' });
  }
}

async function loadActivity({ address = currentAddress } = {}) {
  currentAddress = address || null;
  dom.refresh.disabled = true;
  resetSummary();
  showMessage(dom.message, 'Loading live Base Sepolia activity…');
  dom.empty.hidden = true;
  dom.body.replaceChildren();

  try {
    const result = await api.activity({ address: currentAddress, limit: 30 });
    dom.activeSource.textContent = result.sourceLabel;
    dom.activityContext.textContent = currentAddress
      ? `Visible tGFC Transfer activity involving ${currentAddress}.`
      : 'Recent visible tGFC Transfer activity on Base Sepolia.';
    applySummary(result);
    renderActivityRows(dom.body, result.transfers || []);
    dom.empty.hidden = Boolean(result.transfers?.length);
    showMessage(dom.message, result.warning, result.warning ? 'warning' : 'info');
  } catch (error) {
    dom.activityContext.textContent = currentAddress ? `Address search could not be completed for ${currentAddress}.` : 'Live activity is currently unavailable.';
    dom.empty.hidden = false;
    showMessage(dom.message, `${error.message} No live data is substituted with mock data.`, 'error');
    dom.activeSource.textContent = 'Unavailable';
  } finally {
    dom.refresh.disabled = false;
  }
}

async function loadTransaction(hash, { updateUrl = true } = {}) {
  dom.transactionSection.hidden = false;
  dom.transactionContent.replaceChildren();
  showMessage(dom.transactionMessage, 'Loading transaction evidence…');
  dom.transactionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const result = await api.transaction(hash);
    renderTransaction(dom.transactionContent, result);
    showMessage(dom.transactionMessage, result.warning, result.warning ? 'warning' : 'info');
    if (updateUrl) history.replaceState(null, '', `?tx=${encodeURIComponent(hash)}#transaction-section`);
  } catch (error) {
    showMessage(dom.transactionMessage, `${error.message} No transaction evidence is inferred when the live source is unavailable.`, 'error');
  }
}

function closeTransaction() {
  dom.transactionSection.hidden = true;
  dom.transactionContent.replaceChildren();
  showMessage(dom.transactionMessage, '');
  history.replaceState(null, '', currentAddress ? `?address=${encodeURIComponent(currentAddress)}#activity` : '/#activity');
}

dom.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const target = classifySearch(dom.input.value);
  if (!target) {
    dom.error.textContent = 'Enter a valid Ethereum address (0x + 40 hex characters) or transaction hash (0x + 64 hex characters).';
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
