import { Transfer as TransferEvent } from '../generated/GFCTestToken/GFCTestToken';
import { Transfer } from '../generated/schema';

export function handleTransfer(event: TransferEvent): void {
  const entity = new Transfer(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.transactionHash = event.transaction.hash;
  entity.logIndex = event.logIndex;
  entity.blockNumber = event.block.number;
  entity.timestamp = event.block.timestamp;
  entity.from = event.params.from;
  entity.to = event.params.to;
  entity.value = event.params.value;
  entity.contract = event.address;
  entity.save();
}
