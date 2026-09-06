export const VERIFICATION_STATES = Object.freeze([
  'verified',
  'partially_verifiable',
  'not_verifiable',
  'unavailable',
]);

function section(
  status,
  summary,
  evidence = [],
  limitations = [],
  source = 'derived_from_available_evidence',
) {
  if (!VERIFICATION_STATES.includes(status)) {
    throw new TypeError(`Unsupported verification state: ${status}`);
  }

  return {
    status,
    summary,
    evidence,
    limitations,
    source,
  };
}

export function buildAccountabilityModel(
  transaction,
  { sourceLabel },
) {
  if (!transaction) {
    throw new TypeError('A transaction is required.');
  }

  const status = transaction.status;
  const successful = status === 'success';
  const reverted = status === 'reverted';
  const receiptStatusKnown = successful || reverted;

  const tokenTransfers = Array.isArray(transaction.tokenTransfers)
    ? transaction.tokenTransfers
    : [];

  const hasGfcTransfer = tokenTransfers.length > 0;

  const evidenceItems = [];

  if (receiptStatusKnown) {
    evidenceItems.push({
      type: 'transaction_record',
      label: 'Transaction record',
      reference: transaction.transactionHash,
      source: sourceLabel,
    });
  } else if (hasGfcTransfer) {
    evidenceItems.push({
      type: 'indexed_transaction_reference',
      label: 'Indexed transaction reference',
      reference: transaction.transactionHash,
      source: sourceLabel,
    });
  }

  if (
    transaction.blockNumber !== null &&
    transaction.blockNumber !== undefined
  ) {
    evidenceItems.push({
      type: 'block_inclusion',
      label: 'Block reference',
      reference: String(transaction.blockNumber),
      source: sourceLabel,
    });
  }

  for (const transfer of tokenTransfers) {
    evidenceItems.push({
      type: 'erc20_transfer_event',
      label: `${transfer.amount} ${transfer.symbol} transfer event`,
      reference: `${transfer.transactionHash}:${transfer.logIndex}`,
      source: sourceLabel,
    });
  }

  const funds = hasGfcTransfer
    ? section(
        'verified',
        'The available onchain event evidence verifies the displayed tGFC amount and addresses emitted by the transfer event.',
        tokenTransfers.map((transfer) => ({
          type: 'erc20_transfer_event',
          label: `${transfer.amount} ${transfer.symbol}: ${transfer.from} -> ${transfer.to}`,
          reference: `${transfer.transactionHash}:${transfer.logIndex}`,
          source: sourceLabel,
        })),
        [
          'The onchain transfer event does not establish the economic purpose, valuation, legitimacy, or organizational authorization of the transfer.',
        ],
        sourceLabel,
      )
    : section(
        receiptStatusKnown
          ? successful
            ? 'not_verifiable'
            : 'unavailable'
          : 'unavailable',
        successful
          ? 'No tGFC Transfer event is present in the available transaction evidence.'
          : reverted
            ? 'The transaction receipt reports a reverted transaction, so no completed tGFC transfer is established.'
            : 'No indexed tGFC Transfer event or complete transaction receipt evidence is available for this record.',
        evidenceItems.slice(0, 2),
        [
          'Absence of a tGFC transfer event does not prove that no other asset movement or economic effect occurred.',
        ],
        sourceLabel,
      );

  const authority = section(
    'not_verifiable',
    transaction.from
      ? 'The transaction identifies an onchain sender, but the available data does not establish whether that sender was authorized under GFC governance, policy, or an offchain mandate.'
      : 'The available indexed event evidence does not establish the transaction signer or whether any actor was authorized under GFC governance, policy, or an offchain mandate.',
    transaction.from
      ? [
          {
            type: 'transaction_sender',
            label: 'Onchain transaction sender',
            reference: transaction.from,
            source: sourceLabel,
          },
        ]
      : [],
    [
      'Control of a signing key is not equivalent to organizational or governance authority.',
      'An ERC-20 Transfer event sender must not be assumed to be the transaction signer.',
      'Additional authenticated authority records would be required.',
    ],
    sourceLabel,
  );

  const rules = section(
    'not_verifiable',
    'Network and contract activity are visible, but the applicable governance, operational, contractual, or policy rules cannot be bound to this transaction from the available onchain evidence alone.',
    evidenceItems,
    [
      'A source-verified contract does not prove compliance with every applicable rule.',
      'A versioned rule record linked to this action would be required for stronger verification.',
    ],
    sourceLabel,
  );

  const decisions = section(
    'not_verifiable',
    'The underlying decision, approval, instruction, or rationale is not encoded in the available transaction evidence.',
    [],
    [
      'Blockchain execution proves neither the full decision-making process nor the rationale that preceded it.',
      'Additional authenticated decision evidence would be required.',
    ],
    sourceLabel,
  );

  let outcomes;

  if (successful) {
    outcomes = section(
      'partially_verifiable',
      hasGfcTransfer
        ? 'The transaction receipt verifies successful technical execution and the displayed indexed tGFC Transfer event establishes the corresponding onchain event. Broader real-world outcomes remain unproven.'
        : 'The transaction receipt establishes successful technical execution, but no broader documented outcome is available in this evidence set.',
      evidenceItems,
      [
        'Technical execution does not establish a real-world outcome or impact.',
        'Outcome verification requires evidence appropriate to the claimed result.',
      ],
      sourceLabel,
    );
  } else if (reverted) {
    outcomes = section(
      'verified',
      'The transaction receipt verifies that this transaction reverted; no successful state transition is claimed.',
      evidenceItems,
      [
        'A reverted transaction does not establish that an intended action later succeeded through another transaction.',
      ],
      sourceLabel,
    );
  } else if (hasGfcTransfer) {
    outcomes = section(
      'partially_verifiable',
      'The indexed tGFC Transfer event verifies the displayed onchain event evidence. The transaction receipt is not available from the current evidence source, so receipt-dependent execution facts and broader real-world outcomes remain unverified.',
      evidenceItems,
      [
        'The current evidence source does not provide a transaction receipt.',
        'Indexed event evidence must not be expanded into unsupported claims about authority, purpose, compliance, or real-world impact.',
      ],
      sourceLabel,
    );
  } else {
    outcomes = section(
      'unavailable',
      'The available evidence is insufficient to establish a technical transaction outcome.',
      evidenceItems,
      [
        'A transaction receipt or equivalent authenticated execution evidence would be required.',
      ],
      sourceLabel,
    );
  }

  const evidence = section(
    evidenceItems.length ? 'verified' : 'unavailable',
    evidenceItems.length
      ? 'Concrete onchain evidence is available for the record shown here. Its evidentiary scope is limited to what the chain, receipt, or indexed events actually prove.'
      : 'No usable evidence record is available for this transaction.',
    evidenceItems,
    [
      'Evidence existence does not independently prove authority, purpose, policy compliance, beneficial outcome, or real-world impact.',
    ],
    sourceLabel,
  );

  return {
    funds,
    authority,
    rules,
    decisions,
    outcomes,
    evidence,
  };
}
