export const VERIFICATION_STATES = Object.freeze([
  'verified',
  'partially_verifiable',
  'not_verifiable',
  'unavailable',
]);

function section(status, summary, evidence = [], limitations = [], source = 'derived_from_available_evidence') {
  if (!VERIFICATION_STATES.includes(status)) throw new TypeError(`Unsupported verification state: ${status}`);
  return { status, summary, evidence, limitations, source };
}

export function buildAccountabilityModel(transaction, { sourceLabel }) {
  if (!transaction) throw new TypeError('A transaction is required.');

  const successful = transaction.status === 'success';
  const tokenTransfers = Array.isArray(transaction.tokenTransfers) ? transaction.tokenTransfers : [];
  const hasGfcTransfer = tokenTransfers.length > 0;
  const evidenceItems = [];

  evidenceItems.push({
    type: 'transaction_record',
    label: 'Transaction record',
    reference: transaction.transactionHash,
    source: sourceLabel,
  });

  if (transaction.blockNumber !== null && transaction.blockNumber !== undefined) {
    evidenceItems.push({
      type: 'block_inclusion',
      label: 'Block inclusion',
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

  return {
    funds: hasGfcTransfer
      ? section(
          'verified',
          'The onchain record verifies the tGFC amount and addresses emitted by the transfer event.',
          tokenTransfers.map((transfer) => ({
            type: 'erc20_transfer_event',
            label: `${transfer.amount} ${transfer.symbol}: ${transfer.from} → ${transfer.to}`,
            reference: `${transfer.transactionHash}:${transfer.logIndex}`,
            source: sourceLabel,
          })),
          ['The onchain transfer does not establish the economic purpose, valuation, or legitimacy of the transfer.'],
          sourceLabel,
        )
      : section(
          successful ? 'not_verifiable' : 'unavailable',
          successful
            ? 'No tGFC Transfer event is present in the available transaction evidence.'
            : 'The transaction did not complete successfully, so no completed tGFC transfer is established.',
          evidenceItems.slice(0, 2),
          ['Absence of a tGFC transfer event does not prove that no other asset movement or economic effect occurred.'],
          sourceLabel,
        ),

    authority: section(
      'not_verifiable',
      'The transaction identifies an onchain sender, but the available data does not establish whether that sender was authorized under GFC governance, policy, or an offchain mandate.',
      transaction.from ? [{ type: 'transaction_sender', label: 'Onchain sender', reference: transaction.from, source: sourceLabel }] : [],
      ['Control of a signing key is not equivalent to organizational or governance authority.', 'Additional authenticated authority records would be required.'],
      sourceLabel,
    ),

    rules: section(
      'not_verifiable',
      'Network and contract execution are visible, but the applicable governance, operational, contractual, or policy rules cannot be bound to this transaction from onchain data alone.',
      evidenceItems.slice(0, 2),
      ['A source-verified contract does not prove compliance with every applicable rule.', 'A versioned rule record linked to this action would be required for stronger verification.'],
      sourceLabel,
    ),

    decisions: section(
      'not_verifiable',
      'The underlying decision, approval, instruction, or rationale is not encoded in the available transaction evidence.',
      [],
      ['A blockchain transaction proves execution, not the decision-making process that preceded it.', 'Additional authenticated decision evidence would be required.'],
      sourceLabel,
    ),

    outcomes: section(
      successful && hasGfcTransfer ? 'partially_verifiable' : successful ? 'partially_verifiable' : 'verified',
      successful
        ? hasGfcTransfer
          ? 'The technical outcome is partly verifiable: the transaction succeeded and emitted the displayed tGFC transfer event(s). Broader real-world outcomes remain unproven.'
          : 'The transaction receipt establishes successful technical execution, but no broader documented outcome is available in this evidence set.'
        : 'The transaction receipt verifies that this transaction reverted; no successful state transition is claimed.',
      evidenceItems,
      successful
        ? ['Technical execution does not establish a real-world outcome or impact.', 'Outcome verification requires evidence appropriate to the claimed result.']
        : ['A reverted transaction does not establish that an intended action later succeeded through another transaction.'],
      sourceLabel,
    ),

    evidence: section(
      evidenceItems.length ? 'verified' : 'unavailable',
      evidenceItems.length
        ? 'Concrete onchain evidence is available for the transaction record shown here. Its evidentiary scope is limited to what the chain and indexed events actually prove.'
        : 'No usable evidence record is available for this transaction.',
      evidenceItems,
      ['Evidence existence does not independently prove authority, purpose, policy compliance, beneficial outcome, or real-world impact.'],
      sourceLabel,
    ),
  };
}
