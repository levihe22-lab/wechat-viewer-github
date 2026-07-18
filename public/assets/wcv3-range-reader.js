import{HEADER_SIZE,parseHeader,parseFrame,MAX_FRAME_LENGTH}from'./wcv3-header.js';
export class Wcv3RangeReader{
 constructor(file){if(!file||typeof file.slice!=='function'||!Number.isSafeInteger(file.size))throw new Error('E_FORMAT');this.file=file;this.readLog=[];}
 async readRange(offset,length){if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<1||length>MAX_FRAME_LENGTH||offset+length>this.file.size)throw new Error('E_FORMAT');this.readLog.push(Object.freeze({offset,length}));return new Uint8Array(await this.file.slice(offset,offset+length).arrayBuffer());}
 async readHeader(){return parseHeader(await this.readRange(0,HEADER_SIZE),this.file.size);}
 async readFrame(offset,length){return parseFrame(await this.readRange(offset,length));}
 clear(){this.file=null;this.readLog.length=0;}
}
