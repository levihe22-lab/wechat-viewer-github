export class MediaUrlManager{
 constructor(urlApi=URL){this.urlApi=urlApi;this.entries=new Map();}
 create(id,bytes,contentType){this.revoke(id);const blob=new Blob([bytes],{type:contentType||'application/octet-stream'});const url=this.urlApi.createObjectURL(blob);this.entries.set(id,{url,bytes});return url;}
 revoke(id){const item=this.entries.get(id);if(!item)return;try{this.urlApi.revokeObjectURL(item.url);}finally{item.bytes?.fill?.(0);this.entries.delete(id);}}
 clear(){for(const id of[...this.entries.keys()]){try{this.revoke(id);}catch{this.entries.delete(id);}}}
 get size(){return this.entries.size;}
}
