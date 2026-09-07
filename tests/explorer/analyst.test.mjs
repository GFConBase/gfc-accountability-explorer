import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createOpenAIAnalyst } from '../../lib/explorer/analyst/openai.js';
import { createDataProvider } from '../../lib/explorer/data/provider.js';
import { createApiHandler } from '../../lib/explorer/api.js';
import { NETWORK } from '../../lib/explorer/config.js';

const txHash = `0x${'ab'.repeat(32)}`;
const from = `0x${'11'.repeat(20)}`;
const to = `0x${'22'.repeat(20)}`;

function params(values = {}) {
  return new URLSearchParams(values);
}

test('Accountability Analyst sends live The Graph evidence to the AI provider and returns structured output', async () => {
  const provider = {
    analystEvidence: async () => ({
      source: 'the_graph',
      sourceLabel: 'The Graph',
      scope: 'transaction',
      target: txHash,
      meta: { transferCount: 1, indexedBlock: 123 },
      provenance: {
        primary: {
          id: 'the_graph',
          label: 'The Graph',
          role: 'Primary indexed tGFC activity and Transfer-event evidence.',
        },
        secondary: {
          id: 'base_blockscout',
          label: 'Base Sepolia Blockscout',
          role: 'Secondary indexed historical transaction metadata; not a direct JSON-RPC receipt.',
        },
        ai: {
          role: 'Explanatory only; not an evidence source and cannot change verification states.',
        },
        verification: {
          authority: 'deterministic_accountability_model',
          role: 'Authoritative Funds → Authority → Rules → Decisions → Outcomes → Evidence states.',
        },
      },
      transaction: {
        transactionHash: txHash,
        blockNumber: 123,
        timestamp: '1788000000',
        from,
        to,
        status: 'success',
        receiptAvailable: false,
        executionEvidenceKind: 'indexed_transaction',
        source: 'base_blockscout',
        sourceLabel: 'Base Sepolia Blockscout',
        provenanceRole: 'Secondary indexed historical transaction metadata.',
      },
      transfers: [{
        transactionHash: txHash,
        from,
        to,
        amount: '2',
        amountUnit: 'token',
        amountNormalized: true,
        symbol: 'tGFC',
        source: 'the_graph',
        sourceLabel: 'The Graph',
        provenanceRole: 'Primary indexed tGFC Transfer-event evidence.',
      }],
      deterministicNote: 'Do not upgrade deterministic states.',
    }),
  };

  let seenBody = null;
  const fetchImpl = async (_url, options) => {
    seenBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        answer: 'The indexed evidence verifies one tGFC transfer event.',
        verified_facts: ['One indexed tGFC transfer is present.'],
        limitations: ['The event does not establish organizational authority.'],
        cannot_conclude: ['Economic purpose cannot be concluded.'],
        evidence_scope: 'Live indexed tGFC evidence from The Graph for the requested transaction.',
      }),
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const analyst = createOpenAIAnalyst({
    upstreamTimeoutMs: 3000,
    analyst: {
      configured: true,
      apiKey: 'test-key',
      model: 'gpt-5.6-luna',
      apiUrl: 'https://api.openai.com/v1/responses',
      reasoningEffort: 'low',
      maxOutputTokens: 900,
      timeoutMs: 3000,
    },
  }, provider, { fetchImpl });

  const result = await analyst.analyze({
    question: 'What does this prove?',
    scope: 'transaction',
    target: txHash,
    locale: 'en',
  });

  assert.equal(result.source, 'the_graph');
  assert.equal(result.model, 'gpt-5.6-luna');
  assert.equal(result.analysis.verifiedFacts.length, 1);
  assert.match(seenBody.input[0].content[0].text, /Live The Graph evidence packet/u);
  assert.match(seenBody.input[0].content[0].text, new RegExp(txHash, 'u'));
  assert.equal(seenBody.store, false);
  assert.equal(seenBody.text.format.type, 'json_schema');
  assert.match(seenBody.instructions, /transaction sender \(`from`\)/u);
  assert.doesNotMatch(seenBody.instructions, /transaction signer fields/u);
  assert.match(seenBody.instructions, /The Graph is the load-bearing primary source/u);
  assert.match(seenBody.instructions, /Base Sepolia Blockscout/u);
  assert.match(seenBody.input[0].content[0].text, /Primary indexed tGFC activity and Transfer-event evidence/u);
  assert.match(seenBody.input[0].content[0].text, /Secondary indexed historical transaction metadata/u);
  assert.match(seenBody.instructions, /already normalized to the human-readable token amount/u);
  assert.match(seenBody.instructions, /Never reinterpret it as raw\/base units/u);
  assert.match(seenBody.input[0].content[0].text, /"amount":"2"/u);
  assert.match(seenBody.input[0].content[0].text, /"amountUnit":"token"/u);
  assert.match(seenBody.input[0].content[0].text, /"amountNormalized":true/u);
  assert.match(seenBody.instructions, /Attribute every factual claim to the source declared on the specific evidence object/u);
  assert.match(seenBody.instructions, /transaction\.source is `base_blockscout`/u);
  assert.match(seenBody.instructions, /never say or imply that The Graph indexed, reported, verified, or supplied the transaction status/u);
  assert.match(seenBody.input[0].content[0].text, /"source":"base_blockscout"/u);
  assert.match(seenBody.input[0].content[0].text, /"sourceLabel":"Base Sepolia Blockscout"/u);
  assert.match(seenBody.input[0].content[0].text, /"source":"the_graph"/u);
});

test('provider analyst evidence is load-bearing on The Graph and reports indexed activity', async () => {
  const graphServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const request = JSON.parse(body);
      assert.match(request.query, /ExplorerActivity/u);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        data: {
          transfers: [{
            id: `${txHash}-0`,
            transactionHash: txHash,
            logIndex: '0',
            blockNumber: '123',
            timestamp: '1788000000',
            from,
            to,
            value: '2000000000000000000',
            contract: NETWORK.contract,
          }],
          _meta: { block: { number: '130', hash: `0x${'00'.repeat(32)}` }, hasIndexingErrors: false },
        },
      }));
    });
  });
  graphServer.listen(0, '127.0.0.1');
  await once(graphServer, 'listening');

  try {
    const graphUrl = `http://127.0.0.1:${graphServer.address().port}`;
    const provider = createDataProvider({
      mode: 'auto',
      graph: { configured: true, studioQueryUrl: graphUrl, subgraphId: '', apiKey: '', gatewayUrl: 'https://gateway.thegraph.com/api' },
      blockscout: { apiUrl: 'http://127.0.0.1:1' },
      rpc: { urls: ['http://127.0.0.1:1'], url: 'http://127.0.0.1:1', lookbackBlocks: 1000, chunkBlocks: 1000, maxActivity: 10 },
      upstreamTimeoutMs: 3000,
    });

    const evidence = await provider.analystEvidence({ scope: 'recent', limit: 10 });
    assert.equal(evidence.source, 'the_graph');
    assert.equal(evidence.meta.transferCount, 1);
    assert.equal(evidence.meta.indexedBlock, 130);
    assert.equal(evidence.provenance.primary.id, 'the_graph');
    assert.equal(evidence.provenance.primary.label, 'The Graph');
    assert.equal(evidence.provenance.secondary, null);
    assert.equal(evidence.provenance.verification.authority, 'deterministic_accountability_model');
    assert.equal(evidence.transfers[0].amount, '2');
    assert.equal(evidence.transfers[0].amountUnit, 'token');
    assert.equal(evidence.transfers[0].amountNormalized, true);
    assert.equal(evidence.transfers[0].symbol, 'tGFC');
    assert.equal(evidence.transfers[0].source, 'the_graph');
    assert.equal(evidence.transfers[0].sourceLabel, 'The Graph');
    assert.match(evidence.transfers[0].provenanceRole, /Primary indexed tGFC Transfer-event evidence/u);
    assert.match(evidence.deterministicNote, /must not be treated as raw\/base units or decimal-scaled again/u);
  } finally {
    graphServer.close();
    await once(graphServer, 'close');
  }
});


test('Accountability Analyst keeps Graph transfer evidence separate from Blockscout transaction metadata', async () => {
  const provider = {
    analystEvidence: async () => ({
      source: 'the_graph',
      sourceLabel: 'The Graph',
      scope: 'transaction',
      target: txHash,
      meta: {
        transferCount: 1,
        indexedBlock: 123,
        secondaryTransactionIndex: 'Base Sepolia Blockscout',
      },
      provenance: {
        primary: {
          id: 'the_graph',
          label: 'The Graph',
          role: 'Primary indexed tGFC activity and Transfer-event evidence.',
        },
        secondary: {
          id: 'base_blockscout',
          label: 'Base Sepolia Blockscout',
          role: 'Secondary indexed historical transaction metadata; not a direct JSON-RPC receipt.',
        },
        ai: {
          role: 'Explanatory only; not an evidence source and cannot change verification states.',
        },
        verification: {
          authority: 'deterministic_accountability_model',
          role: 'Authoritative Funds → Authority → Rules → Decisions → Outcomes → Evidence states.',
        },
      },
      transaction: {
        transactionHash: txHash,
        blockNumber: 123,
        timestamp: '1788000000',
        from,
        to,
        status: 'success',
        receiptAvailable: false,
        executionEvidenceKind: 'indexed_transaction',
        source: 'base_blockscout',
        sourceLabel: 'Base Sepolia Blockscout',
        provenanceRole:
          'Secondary indexed historical transaction metadata. Status, transaction sender (`from`), transaction target (`to`), transaction timestamp and transaction block in this object come from Base Sepolia Blockscout.',
      },
      transfers: [{
        transactionHash: txHash,
        logIndex: 7,
        blockNumber: 123,
        timestamp: '1788000000',
        from,
        to,
        amount: '150000000',
        amountUnit: 'token',
        amountNormalized: true,
        symbol: 'tGFC',
        source: 'the_graph',
        sourceLabel: 'The Graph',
        provenanceRole: 'Primary indexed tGFC Transfer-event evidence.',
      }],
      deterministicNote:
        'The Graph supplies primary indexed tGFC Transfer-event evidence. When transaction.source is base_blockscout, transaction status/from/to/timestamp/block metadata is secondary Base Sepolia Blockscout evidence and must never be attributed to The Graph.',
    }),
  };

  let seenBody = null;
  const fetchImpl = async (_url, options) => {
    seenBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        answer:
          'The Graph indexes one tGFC Transfer event. Secondary Base Sepolia Blockscout metadata reports the transaction as successful in block 123.',
        verified_facts: [
          'The Graph indexes one tGFC Transfer event for 150000000 tGFC.',
          'Base Sepolia Blockscout reports transaction status success and block 123.',
        ],
        limitations: ['The Blockscout transaction record is indexed metadata, not a direct JSON-RPC receipt.'],
        cannot_conclude: ['Organizational authority cannot be concluded.'],
        evidence_scope:
          'The Graph Transfer-event evidence supplemented by secondary Base Sepolia Blockscout transaction metadata.',
      }),
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const analyst = createOpenAIAnalyst({
    upstreamTimeoutMs: 3000,
    analyst: {
      configured: true,
      apiKey: 'test-key',
      model: 'gpt-5.6-luna',
      apiUrl: 'https://api.openai.com/v1/responses',
      reasoningEffort: 'low',
      maxOutputTokens: 900,
      timeoutMs: 3000,
    },
  }, provider, { fetchImpl });

  const result = await analyst.analyze({
    question: 'What is verified?',
    scope: 'transaction',
    target: txHash,
    locale: 'en',
  });

  assert.match(result.analysis.answer, /The Graph indexes one tGFC Transfer event/u);
  assert.match(result.analysis.answer, /Blockscout metadata reports the transaction as successful/u);
  assert.match(seenBody.instructions, /never say or imply that The Graph indexed, reported, verified, or supplied the transaction status/u);
  assert.match(seenBody.input[0].content[0].text, /"source":"base_blockscout"/u);
  assert.match(seenBody.input[0].content[0].text, /"source":"the_graph"/u);
});

test('API analyst route validates input and returns the analyst result', async () => {
  const provider = {
    status: async () => ({ available: true }),
    activity: async () => ({ transfers: [] }),
    transaction: async () => null,
  };
  const analyst = {
    status: () => ({ configured: true, available: true, graphRequired: true }),
    analyze: async ({ question, scope }) => ({ question, scope, source: 'the_graph' }),
  };
  const handle = createApiHandler(provider, { analyst });

  const invalid = await handle({
    method: 'POST',
    pathname: '/api/analyst',
    searchParams: params(),
    body: { question: 'x', scope: 'recent', locale: 'en' },
    clientKey: 'analyst-test-invalid',
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.payload.error.code, 'INVALID_ANALYST_QUESTION');

  const valid = await handle({
    method: 'POST',
    pathname: '/api/analyst',
    searchParams: params(),
    body: { question: 'What is verified?', scope: 'recent', locale: 'en' },
    clientKey: 'analyst-test-valid',
  });
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.payload.source, 'the_graph');
});
