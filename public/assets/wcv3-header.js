export const HEADER_SIZE=80;
export const MAGIC='WCV3';
export const VERSION=3;
export const ITERATIONS=600000;
export const MAX_FRAME_LENGTH=512*1024*1024;
const decoder=new TextDecoder();
export function parseHeader(bytes,fileSize){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength!==HEADER_SIZE)throw new Error('E_FORMAT');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(decoder.decode(bytes.subarray(0,4))!==MAGIC||v.getUint16(4)!==VERSION||v.getUint16(6)!==HEADER_SIZE)throw new Error('E_FORMAT');
 if(v.getUint8(8)!==1||v.getUint8(9)!==1||v.getUint8(10)!==16||v.getUint8(11)!==0||v.getUint32(12)!==ITERATIONS)throw new Error('E_FORMAT');
 const manifestOffset=Number(v.getBigUint64(64));const manifestLength=Number(v.getBigUint64(72));
 if(!Number.isSafeInteger(manifestOffset)||!Number.isSafeInteger(manifestLength)||manifestOffset<HEADER_SIZE||manifestLength<32||manifestLength>MAX_FRAME_LENGTH||manifestOffset+manifestLength>fileSize)throw new Error('E_FORMAT');
 return Object.freeze({salt:bytes.slice(16,32),packageId:bytes.slice(32,48),manifestResourceId:bytes.slice(48,64),manifestOffset,manifestLength});
}
export function parseFrame(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<32||bytes.byteLength>MAX_FRAME_LENGTH)throw new Error('E_FORMAT');
 const declared=new DataView(bytes.buffer,bytes.byteOffset,4).getUint32(0);
 if(declared!==bytes.byteLength)throw new Error('E_FORMAT');
 return {iv:bytes.slice(4,16),ciphertext:bytes.slice(16)};
}
export function hexToBytes(value){if(typeof value!=='string'||!/^[0-9a-f]{32}$/i.test(value))throw new Error('E_FORMAT');return Uint8Array.from(value.match(/../g),part=>Number.parseInt(part,16));}
