import { clear, el, externalLink } from './dom.js';
import { formatDate, formatInteger, stateClass, stateLabel, truncateMiddle } from './format.js';

const BASESCAN = 'https://sepolia.basescan.org';

function localTransactionLink(hash) {
  return el('a', { text: truncateMiddle(hash, 10, 8), attrs: { href: `?tx=${encodeURIComponent(hash)}#transaction-section`, title: hash } });
}

export function renderActivityRows(tbody, transfers) {
  clear(tbody);
  for (const transfer of transfers) {
    const row = el('tr');
    const time = el('td', { text: formatDate(transfer.timestamp) });
    const from = el('td', {}, [externalLink(`${BASESCAN}/address/${transfer.from}`, truncateMiddle(transfer.from), 'mono value-link')]);
    const to = el('td', {}, [externalLink(`${BASESCAN}/address/${transfer.to}`, truncateMiddle(transfer.to), 'mono value-link')]);
    const amount = el('td', { className: 'amount-cell', text: `${transfer.amount} ${transfer.symbol}` });
    const block = el('td', {}, [externalLink(`${BASESCAN}/block/${transfer.blockNumber}`, formatInteger(transfer.blockNumber), 'mono')]);
    const evidence = el('td', { className: 'tx-action evidence-cell' }, [
      el('span', { className: 'verification-badge state-verified', text: 'Onchain event' }),
      localTransactionLink(transfer.transactionHash),
    ]);
    row.append(time, from, to, amount, block, evidence);
    tbody.append(row);
  }
}

export function renderTransaction(container, result) {
  clear(container);
  const tx = result.transaction;
  const card = el('article', { className: 'transaction-meta-card' });
  const heading = el('div', { className: 'transaction-heading' }, [
    el('div', {}, [
      el('p', { className: 'card-kicker', text: 'Transaction record' }),
      el('h3', { text: tx.status === 'success' ? 'Successful technical execution' : tx.status === 'reverted' ? 'Reverted transaction' : 'Transaction status unavailable' }),
      el('p', { className: 'transaction-hash mono', text: tx.transactionHash }),
    ]),
    externalLink(`${BASESCAN}/tx/${tx.transactionHash}`, 'Open in BaseScan', 'button-secondary'),
  ]);
  card.append(heading);

  const grid = el('div', { className: 'transaction-grid' });
  const items = [
    ['Network', `${tx.network} · Chain ${tx.chainId}`],
    ['Block', formatInteger(tx.blockNumber)],
    ['Timestamp', formatDate(tx.timestamp)],
    ['From', tx.from || 'Unavailable'],
    ['To', tx.to || 'Unavailable'],
    ['Data source', result.sourceLabel],
  ];
  for (const [label, value] of items) {
    const box = el('div', {}, [el('span', { text: label }), el('strong', { className: label === 'From' || label === 'To' ? 'mono break-value' : '', text: value })]);
    grid.append(box);
  }
  card.append(grid);
  container.append(card);

  const accountabilityGrid = el('div', { className: 'accountability-grid' });
  for (const key of ['funds', 'authority', 'rules', 'decisions', 'outcomes', 'evidence']) {
    const section = result.accountability[key];
    const article = el('article', { className: 'accountability-card' });
    const header = el('div', { className: 'accountability-card-header' }, [
      el('h3', { text: key.charAt(0).toUpperCase() + key.slice(1) }),
      el('span', { className: `verification-badge ${stateClass(section.status)}`, text: stateLabel(section.status) }),
    ]);
    article.append(header, el('p', { text: section.summary }));

    if (section.evidence?.length) {
      article.append(el('h4', { text: 'Evidence' }));
      const list = el('ul', { className: 'evidence-list' });
      for (const evidence of section.evidence) {
        list.append(el('li', { text: `${evidence.label} — ${evidence.reference}` }));
      }
      article.append(list);
    }

    if (section.limitations?.length) {
      article.append(el('h4', { text: 'Limitations' }));
      const list = el('ul', { className: 'limitation-list' });
      for (const limitation of section.limitations) list.append(el('li', { text: limitation }));
      article.append(list);
    }
    accountabilityGrid.append(article);
  }
  container.append(accountabilityGrid);
}
