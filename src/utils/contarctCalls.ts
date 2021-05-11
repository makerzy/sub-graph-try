import { ERC721Marketplace } from "../../generated/MKTPlace/ERC721Marketplace";
import { Address, ethereum, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { delfyToken } from "./mappingUtils";
import { ERC20SymbolBytes } from "../../generated/MKTPlace/ERC20SymbolBytes";
import { ERC20NameBytes } from "../../generated/MKTPlace/ERC20NameBytes";
import { BASICNFT } from "../../generated/MKTPlace/BASICNFT";
import { Payment } from "../../generated/schema";
import {
  PlatformPayment,
  PlatformPayment__getPlatformCutResult,
} from "../../generated/MKTPlace/PlatformPayment";
// import { NFTMKTPLACE } from "./cotractCalls"

export function getNFTId(address: Address, tokenId: BigInt): string {
  return address.toHexString().concat(tokenId.toString());
}

export function getBidId(auctionId: string, bidLength: BigInt): string {
  return auctionId.concat(bidLength.toString());
}

export function isPlatformToken(address: Address): boolean {
  return address.toHexString() == delfyToken;
}

export function getTokenSymbol(address: Address): string {
  let erc20Symbol = ERC20SymbolBytes.bind(address);
  let callResult = erc20Symbol.try_symbol();
  if (callResult.reverted) {
    log.info("ERC20 Symbol Errors", []);
  }
  return callResult.value.toString();
}
export function getTokenName(address: Address): string {
  let erc20Name = ERC20NameBytes.bind(address);
  let callResult = erc20Name.try_name();
  if (callResult.reverted) {
    log.info("ERC20 Name Errors", []);
  }
  return callResult.value.toString();
}

export function getTokenURI(address: Address, tokenId: BigInt): string {
  let erc721 = BASICNFT.bind(address);
  let callResult = erc721.try_tokenURI(tokenId);
  if (callResult.reverted) {
    log.info("ERC721 Token URI Error", []);
  }
  log.info(callResult.value, []);
  return callResult.value;
}

export function convertEnum(value: BigInt): string {
  if (value == BigInt.fromI32(0)) {
    return "art";
  } else if (value == BigInt.fromI32(1)) {
    return "music";
  } else if (value == BigInt.fromI32(2)) {
    return "sport";
  } else if (value == BigInt.fromI32(3)) {
    return "meme";
  } else if (value == BigInt.fromI32(4)) {
    return "photo";
  } else if (value == BigInt.fromI32(5)) {
    return "game";
  } else if (value == BigInt.fromI32(6)) {
    return "animal";
  } else if (value == BigInt.fromI32(7)) {
    return "license";
  } else if (value == BigInt.fromI32(8)) {
    return "legendary";
  } else {
    return "others";
  }
}

export function getAuctionPayments(
  address: Address,
  auctionId: Bytes,
): BigInt[] {
  let mktPlace = PlatformPayment.bind(address);
  let callResult = mktPlace.try_getPlatformCut(auctionId);
  if (callResult.reverted) {
    log.info("PlatformPayment Errors", []);
  }
  // log.info("Log Call results: {}, {}, {}, {}", [
  //   callResult.value.value0.toString(),
  //   callResult.value.value1.toString(),
  //   callResult.value.value2.toString(),
  //   callResult.value.value3.toString(),
  // ]);
  return [
    callResult.value.value0,
    callResult.value.value1,
    callResult.value.value2,
    callResult.value.value3,
  ];
}
