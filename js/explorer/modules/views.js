import { clear, el, externalLink } from './dom.js';
import { formatDate, formatInteger, stateClass, stateLabel, truncateMiddle } from './format.js';
import { t } from './i18n.js';

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
      el('span', { className: 'verification-badge state-verified', text: t('onchainEvent') }),
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
      el('p', { className: 'card-kicker', text: t('txRecord') }),
      el('h3', { text: tx.status === 'success' ? t('successExecution') : tx.status === 'reverted' ? t('revertedTx') : t('txStatusUnavailable') }),
      el('p', { className: 'transaction-hash mono', text: tx.transactionHash }),
    ]),
    externalLink(`${BASESCAN}/tx/${tx.transactionHash}`, t('openBasescan'), 'button-secondary'),
  ]);
  card.append(heading);

  const grid = el('div', { className: 'transaction-grid' });
  const items = [
    [t('network'), `${tx.network} · Chain ${tx.chainId}`],
    [t('block'), formatInteger(tx.blockNumber)],
    [t('timestamp'), formatDate(tx.timestamp)],
    [t('from'), tx.from || t('unavailable')],
    [t('to'), tx.to || t('unavailable')],
    [t('dataSource'), result.sourceLabel],
  ];
  for (const [label, value] of items) {
    const box = el('div', {}, [el('span', { text: label }), el('strong', { className: label === t('from') || label === t('to') ? 'mono break-value' : '', text: value })]);
    grid.append(box);
  }
  card.append(grid);
  container.append(card);

  const accountabilityGrid = el('div', { className: 'accountability-grid' });
  for (const key of ['funds', 'authority', 'rules', 'decisions', 'outcomes', 'evidence']) {
    const section = result.accountability[key];
    const article = el('article', { className: 'accountability-card' });
    const header = el('div', { className: 'accountability-card-header' }, [
      el('h3', { text: t(`domains.${key}`) }),
      el('span', { className: `verification-badge ${stateClass(section.status)}`, text: stateLabel(section.status) }),
    ]);
    article.append(header, el('p', { text: section.summary }));

    if (section.evidence?.length) {
      article.append(el('h4', { text: t('evidence') }));
      const list = el('ul', { className: 'evidence-list' });
      for (const evidence of section.evidence) {
        list.append(el('li', { text: `${evidence.label} — ${evidence.reference}` }));
      }
      article.append(list);
    }

    if (section.limitations?.length) {
      article.append(el('h4', { text: t('limitations') }));
      const list = el('ul', { className: 'limitation-list' });
      for (const limitation of section.limitations) list.append(el('li', { text: limitation }));
      article.append(list);
    }
    accountabilityGrid.append(article);
  }
  container.append(accountabilityGrid);
}

export function renderAnalyst(container, result) {
  clear(container);
  const analysis = result?.analysis || {};

  const meta = el('div', { className: 'analyst-meta' }, [
    el('span', { className: 'verification-badge state-verified', text: t('analystGraphSource') }),
    el('strong', { text: result?.sourceLabel || 'The Graph' }),
    el('span', { text: '·' }),
    el('span', { text: `${t('analystModel')}: ${result?.model || t('unavailable')}` }),
  ]);

  const answerCard = el('article', { className: 'analyst-answer-card' }, [
    el('p', { className: 'card-kicker', text: t('analystAnswer') }),
    el('p', { className: 'analyst-answer', text: analysis.answer || t('unavailable') }),
  ]);

  const grid = el('div', { className: 'analyst-result-grid' });
  const sections = [
    [t('analystVerifiedFacts'), analysis.verifiedFacts || [], 'analyst-facts'],
    [t('limitations'), analysis.limitations || [], 'analyst-limitations'],
    [t('analystCannotConclude'), analysis.cannotConclude || [], 'analyst-cannot'],
  ];

  for (const [title, items, className] of sections) {
    const card = el('article', { className: `analyst-result-card ${className}` }, [
      el('h3', { text: title }),
    ]);
    const list = el('ul');
    if (items.length) {
      for (const item of items) list.append(el('li', { text: item }));
    } else {
      list.append(el('li', { text: t('unavailable') }));
    }
    card.append(list);
    grid.append(card);
  }

  const scope = el('article', { className: 'analyst-scope-card' }, [
    el('p', { className: 'card-kicker', text: t('analystEvidenceScope') }),
    el('p', { text: analysis.evidenceScope || t('unavailable') }),
  ]);

  container.append(meta, answerCard, grid, scope);
}
