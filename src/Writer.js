const zlib = require('zlib');
const Consts = require('./Consts');
const { ByteStream,ByteStreamSimulator } = require('byte-data-stream');

function isRange(num,min,max){
    return min <= num && num <= max;
}

// 헤더 부분의 바이트 길이(magic 8바이트 + 버젼 8바이트)
const HEADER_BYTES = Consts.MAGIC.length + 8;

module.exports = class Writer{
    constructor(initialLength,simulate = false){
        this.bs = simulate
        ? new ByteStreamSimulator()
        : new ByteStream(new ArrayBuffer(initialLength));
    }
    
    writeDocument(xml,opts){
        opts = Object.assign({
            compress:Consts.compress.RAW
        },opts);
        if(typeof opts.compress == 'string') opts.compress = Consts.compress[opts.compress.toUpperCase()] || Consts.compress.RAW;
        
        // 일단 내용 먼저
        this.writeDeclaration(xml.declaration.attributes);
        this.writeElements(xml.elements);

        // 길이 계산용이 아닌 실제 데이터를 쓰는 경우 최종 처리 후 반환
        if(this.bs instanceof ByteStream) return this.finalize(opts.compress);
    }
    
    finalize(compress){
        // 압축
        let body = this.bs.u8;
        switch(compress){
            case Consts.compress.RAW: break;
            case Consts.compress.DEFLATE:
                body = zlib.deflateRawSync(body);
            break;
            case Consts.compress.GZIP:
                body = zlib.gzipSync(body);
            break;
            default: throw new TypeError('Invalid compression algorithm');
        }

        let bs = new ByteStream(new ArrayBuffer(HEADER_BYTES + body.byteLength));

        // signature bytes
        bs.writeBytes(Consts.MAGIC);

        // version
        bs.writeUint16(Consts.MAJOR_VERSION);
        bs.writeUint16(Consts.MINOR_VERSION);

        // 압축알고리즘 종류
        bs.writeUint16(compress);

        // 실제 데이터
        bs.writeBytes(body);

        return bs;
    }
    
    writeText(text){
        // 모든 데이터 길이의 숫자 타입은
        // 원칙적으로 big endian의 var uint다
        let b = Buffer.from(text,'utf8');
        this.bs.writeVarUint(b.byteLength);
        this.bs.writeBytes(b);
    }
    
    writeDeclaration(declaration){
        this.bs.writeUint8(Consts.START_OF_DECLARATION);
        this.writeAttributes(declaration);
    }
    
    writeValue(val){
        if(val === null){
            this.bs.writeUint8(Consts.valueTypes.NULL);
            return;
        }
        
        switch(typeof val){
            case 'undefined':
                this.bs.writeUint8(Consts.valueTypes.NULL);
            break;
            case 'string':
                this.bs.writeUint8(Consts.valueTypes.TEXT);
                this.writeText(val);
            break;
            case 'object':
                if(val instanceof Date){
                    this.bs.writeUint8(Consts.valueTypes.TIMESTAMP);
                    this.bs.writeUint8(Consts.timeResolution.MILLISECONDS);
                    this.bs.writeBigInt64(BigInt(val.getTime()));
                }else if(val instanceof Uint8Array){
                    this.bs.writeUint8(Consts.valueTypes.BINARY_DATA);
                    this.bs.writeVarUint(val.byteLength);
                    this.bs.writeBytes([...val]);
                }else if(val instanceof ArrayBuffer){
                    this.bs.writeUint8(Consts.valueTypes.BINARY_DATA);
                    this.bs.writeVarUint(b.byteLength);
                    this.bs.writeBytes([...new Uint8Array(b)]);
                }else if(val instanceof Array){
                    this.bs.writeUint8(Consts.valueTypes.ARRAY);
                    this.bs.writeVarUint(val.length);
                    val.forEach(a => this.writeValue(a));
                }else throw new TypeError('object value must be an instance of Array or Date or Uint8Array or ArrayBuffer or nodejs Buffer');
            break;
            case 'number':
                // 그냥 숫자가 들어오면 숫자 크기에 따라 타입을 자동으로 설정
                if(Number.isInteger(val)){
                    if(val >= 0){ // 양수는 unsigned로 저장
                        if(val < 256){
                            this.bs.writeUint8(Consts.valueTypes.UNSIGNED_BYTE);
                            this.bs.writeUint8(val);
                        }else if(val < 65536){
                            this.bs.writeUint8(Consts.valueTypes.UNSIGNED_SHORT);
                            this.bs.writeUint16(val);
                        }else if(val < 4294967296){
                            this.bs.writeUint8(Consts.valueTypes.UNSIGNED_INT);
                            this.bs.writeUint32(val);
                        }else{
                            this.bs.writeUint8(Consts.valueTypes.UNSIGNED_LONG);
                            this.bs.writeBigUint64(BigInt(val));
                        }
                    }else{
                        if(isRange(val,-128,127)){
                            this.bs.writeUint8(Consts.valueTypes.BYTE);
                            this.bs.writeInt8(val);
                        }else if(isRange(val,-32768,32767)){
                            this.bs.writeUint8(Consts.valueTypes.SHORT);
                            this.bs.writeInt16(val);
                        }else if(isRange(val,-2147483648,2147483647)){
                            this.bs.writeUint8(Consts.valueTypes.INT);
                            this.bs.writeInt32(val);
                        }else{
                            this.bs.writeUint8(Consts.valueTypes.LONG);
                            this.bs.writeBigInt64(BigInt(val));
                        }
                    }
                }else{
                    this.bs.writeUint8(Consts.valueTypes.DOUBLE);
                    this.bs.writeFloat64(val);
                }
            break;
            case 'bigint':
                if(val >= 0n){
                    if(val < 256n){
                        this.bs.writeUint8(Consts.valueTypes.UNSIGNED_BYTE);
                        this.bs.writeUint8(Number(val));
                    }else if(val < 65536n){
                        this.bs.writeUint8(Consts.valueTypes.UNSIGNED_SHORT);
                        this.bs.writeUint16(Number(val));
                    }else if(val < 4294967296n){
                        this.bs.writeUint8(Consts.valueTypes.UNSIGNED_INT);
                        this.bs.writeUint32(Number(val));
                    }else{
                        this.bs.writeUint8(Consts.valueTypes.UNSIGNED_LONG);
                        this.bs.writeBigUint64(val);
                    }
                }else{
                    if(isRange(val,-128n,127n)){
                        this.bs.writeUint8(Consts.valueTypes.BYTE);
                        this.bs.writeInt8(Number(val));
                    }else if(isRange(val,-32768n,32767n)){
                        this.bs.writeUint8(Consts.valueTypes.SHORT);
                        this.bs.writeInt16(Number(val));
                    }else if(isRange(val,-2147483648n,2147483647n)){
                        this.bs.writeUint8(Consts.valueTypes.INT);
                        this.bs.writeInt32(Number(val));
                    }else{
                        this.bs.writeUint8(Consts.valueTypes.LONG);
                        this.bs.writeBigInt64(val);
                    }
                }
            break;
            case 'boolean':
                this.bs.writeUint8(Consts.valueTypes.BOOLEAN);
                this.bs.writeUint8(val ? 0 : 1);
            break;
        }
    }
    
    writeElements(elements){
        this.bs.writeUint8(Consts.START_OF_ELEMENTS);
        elements.forEach(el => {
            this.bs.writeUint8(Consts.START_OF_ELEMENT);
            // 사실 comment도 있는데 바이너리파일에서 주석은 의미가 없음
            if(el.type == 'element'){
                this.bs.writeUint8(Consts.types.ELEMENT);
                this.writeText(el.name);
                if(el.attributes) this.writeAttributes(el.attributes);
                if(el.elements) this.writeElements(el.elements);
            }else if(el.type == 'text'){
                this.bs.writeUint8(Consts.types.TEXT);
                this.writeText(el.text);
            }else if(el.type == 'cdata'){
                this.bs.writeUint8(Consts.types.CDATA);
                this.writeText(el.cdata);
            }else if(el.type == 'instruction'){
                this.bs.writeUint8(Consts.types.PROCESSING_INSTRUCTION);
                this.writeText(el.name);
                this.writeText(el.instruction);
            }else if(el.type == 'doctype'){
                this.bs.writeUint8(Consts.types.DOCTYPE);
                this.writeText(el.doctype);
            }else if(el.type == 'value'){
                this.bs.writeUint8(Consts.types.VALUE);
                this.writeValue(el.value);
            }else{
                throw new TypeError('Unsupported type '+el.type);
            }
        });
        this.bs.writeUint8(Consts.END_OF_ELEMENTS);
    }
    
    writeAttributes(attributes){
        this.bs.writeUint8(Consts.START_OF_ATTRIBUTES);
        for(let i in attributes){
            this.bs.writeUint8(Consts.START_OF_ATTRIBUTE);
            this.writeText(i);
            this.writeValue(attributes[i]);
            //console.log(i,attributes[i])
        }
        this.bs.writeUint8(Consts.END_OF_ATTRIBUTES);
    }
}