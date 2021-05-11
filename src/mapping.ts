import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
  AuctionCreated,
  UpdatePaymentMethod,
  Cancelled,
  BidMade,
  Executed,
  PriceUpdated,
  FeesUpdated,
  ERC721Marketplace,
} from "../generated/MKTPlace/ERC721Marketplace";
import {
  NFT,
  PaymentMethod,
  Auction,
  Bid,
  NFTTokenHistory,
  User,
  Payment,
} from "../generated/schema";
import {
  convertEnum,
  getAuctionPayments,
  getBidId,
  getNFTId,
  getTokenName,
  getTokenSymbol,
  getTokenURI,
  isPlatformToken,
} from "./utils/contarctCalls";

import {
  ADDRESS_ZERO,
  OPEN,
  SOLD,
  CANCELLED,
  ACTIVE,
  DROPPED,
  ACCEPTED,
} from "./utils/mappingUtils";

export function handleAuctionCreated(event: AuctionCreated): void {
  let params = event.params;
  let id = params.id.toHexString();
  let auction = Auction.load(id);
  if (auction == null) {
    auction = new Auction(id);
  }
  auction.nftAddress = params.token;
  auction.txHash = event.transaction.hash;
  let _owner = User.load(event.transaction.from.toHexString());
  if (_owner == null) {
    _owner = new User(event.transaction.from.toHexString());
  }
  auction.owner = _owner.address.toHexString();
  let sellOrders = _owner.activeSellOrders;

  auction.status = OPEN;
  auction.blockNumber = event.block.number;
  auction.basePrice = params._basePrice;
  auction.royaltyFees = params.royaltyFees;
  let paymentMethod = PaymentMethod.load(params.paymentMethod.toHexString());
  if (paymentMethod == null) {
    paymentMethod = new PaymentMethod(params.paymentMethod.toHexString());
    let name = getTokenName(params.paymentMethod).toString();
    paymentMethod.name = name;
    paymentMethod.tokenAddress = params.paymentMethod;
    paymentMethod.isPlatformToken = isPlatformToken(
      params.paymentMethod,
    ) as boolean;
  }
  auction.paymentMethod = paymentMethod.tokenAddress.toHexString();
  let mktPlace = ERC721Marketplace.bind(event.address);
  let callResult = mktPlace.try_category(params.id);
  if (callResult.reverted) {
    log.info("Auction Category Reverted", []);
  } else auction.category = convertEnum(BigInt.fromI32(callResult.value));
  auction.createdAt = event.block.timestamp;
  let nftString = getNFTId(params.token, params.tokenId).toString();
  let nft = NFT.load(nftString);
  if (nft == null) {
    nft = new NFT(params.token.toHexString());
  }
  auction.nft = nft.id;
  nft.contractAddress = params.token;
  nft.tokenId = params.tokenId;
  let royalty = User.load(params.royalty.toHexString());
  nft.royalty = royalty.address.toHexString();
  nft.owner = _owner.address.toHexString();
  nft.activeOrder = auction.id;
  let orders = nft.orders;
  orders.push(nft.id);
  nft.orders = orders;
  nft.tokenURI = getTokenURI(params.token, params.tokenId);
  paymentMethod.save();
  nft.save();
  auction.save();
  sellOrders.push(auction.id);
  _owner.save();
  let nftHistory = NFTTokenHistory.load(nft.id);
  if (nftHistory == null) {
    nftHistory = new NFTTokenHistory(nft.id);
  }
  nftHistory.token = nft.contractAddress;
  nftHistory.tokenId = nft.tokenId;
  nftHistory.paymentMethod = paymentMethod.id;
  nftHistory.timestamp = event.block.timestamp;
  nftHistory.currentPrice = auction.basePrice;
  nftHistory.save();
  let payment = Payment.load(auction.id);
  if (payment == null) {
    payment = new Payment(auction.id);
  }
  payment.totalValue = params._basePrice;
  payment.paymentMethod = auction.paymentMethod;
  payment.save();
}

export function handleCancelled(event: Cancelled): void {
  let id = event.params.id.toHexString();
  let auction = Auction.load(id);
  if (auction != null) {
    auction.status = CANCELLED;
    auction.expiresAt = event.block.timestamp;
    let defaultOwner = User.load(ADDRESS_ZERO);
    if (defaultOwner == null) {
      defaultOwner = new User(ADDRESS_ZERO);
    }
    auction.buyer = defaultOwner.address.toHexString();
    auction.save();
  }
}

export function handleBidMade(event: BidMade): void {
  let params = event.params;
  let id = params.id.toHexString();
  let auction = Auction.load(id);
  let bids = auction.bids;
  if (bids.length > 0) {
    let lastBid = Bid.load(bids[bids.length - 1]);
    lastBid.status = DROPPED;
    lastBid.closedAt = event.block.timestamp;
  }
  let bidId = getBidId(id, BigInt.fromI32(bids.length));
  let bid = Bid.load(bidId);
  if (bid == null) {
    bid = new Bid(bidId);
  }
  let seller = User.load(auction.owner);
  if (seller == null) {
    seller = new User(auction.owner);
  }
  let bidder = User.load(event.transaction.from.toHexString());
  if (bidder == null) {
    bidder = new User(event.transaction.from.toHexString());
  }
  bid.id = bidId;
  let bidderBids = bidder.bids;
  bidderBids.push(bid.id);
  bidder.bids = bidderBids;

  bid.nftAddress = params.token;
  bid.seller = seller.address.toHexString();
  bid.status = ACTIVE;
  bid.bidder = bidder.address.toHexString();
  bid.bidValue = params.bidValue;
  bid.blockNumber = event.block.number;
  bid.createdAt = event.block.timestamp;
  let nft = NFT.load(getNFTId(params.token, params.tokenId));
  bid.nft = nft.id;
  bid.save();
  let _bids = auction.bids;
  _bids.push(bid.id);
  let nftBids = nft.bids;
  nftBids.push(bid.id);
  nft.bids = nftBids;
  nft.save();
  auction.bids = _bids;
  auction.save();
}

export function handleExecuted(event: Executed): void {
  let params = event.params;
  let id = params.auctionId.toHexString();
  let auction = Auction.load(id);
  auction.status = SOLD;
  let bids = auction.bids;
  let bid = Bid.load(getBidId(id, BigInt.fromI32(bids.length)));
  auction.buyer = bid.bidder;
  auction.closedAt = event.block.timestamp;
  auction.soldPrice = bid.bidValue;
  bid.status = ACCEPTED;
  bid.closedAt = event.block.timestamp;
  bid.save();
  let nftHistory = NFTTokenHistory.load(auction.nft);
  nftHistory.previousOwner = auction.owner;
  nftHistory.currentOwner = bid.bidder;
  nftHistory.lastHistoricalPrice = bid.bidValue;
  let buyer = User.load(bid.bidder);
  let nftString = getNFTId(params.token, params.tokenId).toString();
  let nft = NFT.load(nftString);
  let buyerNft = buyer.nfts;
  buyerNft.push(nft.id);
  buyer.nfts = buyerNft;
  buyer.save();
  let payment = Payment.load(auction.id);
  let paymentBrkDwn = getAuctionPayments(
    Address.fromString(nft.contractAddress.toHexString()),
    params.auctionId,
  );
  payment.ownerCashBack = paymentBrkDwn[2];
  payment.ownerPayment = params.ownerPayment.minus(payment.ownerCashBack);
  payment.platformCut = paymentBrkDwn[0];
  payment.refBonus = paymentBrkDwn[1];
  payment.royaltyCut = params.creatorPayment;
  payment.cashBack = paymentBrkDwn[2];
  payment.totalCashBack = payment.cashBack.plus(payment.ownerCashBack);
  payment.totalValue = paymentBrkDwn[3];
  payment.save();
}

export function handleUpdatePaymentMethod(event: UpdatePaymentMethod): void {
  let params = event.params;
  let id = params.auctionId.toHexString();
  let auction = Auction.load(id);
  let paymentMtd = PaymentMethod.load(params.newPaymentMtd.toHexString());
  if (paymentMtd == null) {
    paymentMtd = new PaymentMethod(params.newPaymentMtd.toHexString());
    paymentMtd.id = params.newPaymentMtd.toHexString();
    paymentMtd.tokenAddress = params.newPaymentMtd;
    paymentMtd.symbol = getTokenSymbol(params.newPaymentMtd);
    paymentMtd.name = getTokenName(params.newPaymentMtd);
    paymentMtd.isPlatformToken = isPlatformToken(params.newPaymentMtd);
    paymentMtd.save();
  }
  auction.paymentMethod = paymentMtd.id;
  auction.save();
  let payment = Payment.load(auction.id);
  payment.paymentMethod = paymentMtd.id;
  payment.save();
  let nftTokenHistory = NFTTokenHistory.load(auction.nft);
  nftTokenHistory.paymentMethod = paymentMtd.id;
  nftTokenHistory.save();
}
export function handlePriceUpdated(event: PriceUpdated): void {
  let params = event.params;
  let id = params.auctionId.toHexString();
  let auction = Auction.load(id);
  auction.basePrice = params.newPrice;
  auction.save();
}
export function handleFeesUpdated(event: FeesUpdated): void {
  let params = event.params;
  let id = params.auctionId.toHexString();
  let auction = Auction.load(id);
  auction.royaltyFees = params.newFees;
  auction.save();
}
