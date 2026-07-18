export class LruCache{
 constructor(maxEntries=8,maxBytes=8*1024*1024){if(maxEntries<1||maxBytes<1)throw new Error('E_CONFIG');this.maxEntries=maxEntries;this.maxBytes=maxBytes;this.map=new Map();this.bytes=0;}
 get(key){const value=this.map.get(key);if(!value)return undefined;this.map.delete(key);this.map.set(key,value);return value.data;}
 set(key,data,size=data?.byteLength??0){if(this.map.has(key)){this.bytes-=this.map.get(key).size;this.map.delete(key);}this.map.set(key,{data,size});this.bytes+=size;while(this.map.size>this.maxEntries||this.bytes>this.maxBytes){const first=this.map.keys().next().value;const removed=this.map.get(first);this.map.delete(first);this.bytes-=removed.size;}return this.map.has(key);}
 delete(key){const value=this.map.get(key);if(value){this.bytes-=value.size;this.map.delete(key);}return Boolean(value);}
 clear(){this.map.clear();this.bytes=0;}
 get size(){return this.map.size;}
}
