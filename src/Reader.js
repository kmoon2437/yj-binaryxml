const zlib = require('zlib');
const Consts = require('./Consts');
const { ByteStream } = require('byte-data-stream');

module.exports = class Reader{
    constructor(buf,opts){
        this.bs = new ByteStream(buf);
        this.opts = opts;
    }
    
    readDocument(){
        let doc = {};

        this.verifySignature();
        this.verifyVersion(doc);

        let compress = this.readCompress();
        let body = this.bs.readBytes(this.bs.u8.byteLength-this.bs.i);

        switch(compress){
            case Consts.compress.RAW: break;
            case Consts.compress.DEFLATE:
                body = zlib.inflateRawSync(body);
            break;
            case Consts.compress.GZIP:
                body = zlib.gunzipSync(body);
            break;
        }

        this.bs = new ByteStream(body);

        this.readDeclaration(doc);
        this.readElements(doc);

        return doc;
    }
    
    verifySignature(){
        // 시그니처 안맞으면 퉤
        let sign = this.bs.readBytes(Consts.MAGIC.length);
        if(!Consts.MAGIC.every((e,i,a) => sign[i] == a[i])){
            throw new TypeError('bad signature bytes. Please subscribe my youtube channel');
        }
    }
    
    readText(){
        // 모든 데이터 길이의 숫자 타입은
        // 원칙적으로 big endian의 var uint다
        let b = this.bs.readBytes(this.bs.readVarUint());
        let s = Buffer.from(b).toString('utf8');
        return s;
    }
    
    verifyVersion(doc){
        doc.bxmlMajorVersion = this.bs.readUint16();
        doc.bxmlMinorVersion = this.bs.readUint16();
        // 난 왜 저걸 저렇게 입력했지?????????
        //                   vvvv
        //if(doc.bxmlVersion >= Consts.VERSION) throw new Error("....");
        if(doc.bxmlMajorVersion > Consts.VERSION) throw new Error("Outdated parser (please update the package.)");
    }

    readCompress(){
        return this.bs.readUint16();
    }
    
    readDeclaration(doc){
        if(this.bs.readUint8() != Consts.START_OF_DECLARATION) throw new TypeError('There is no START_OF_DECLARATION.');
        let decl = doc.declaration = {};
        this.readAttributes(decl);
    }
    
    readValue(){
        const type = this.bs.readUint8();
        let val = null;
        switch(type){
            case Consts.valueTypes.NULL: val = null; break;
            case Consts.valueTypes.TEXT: val = this.readText(); break;
            case Consts.valueTypes.BINARY_DATA:
                val = Uint8Array.from(this.bs.readBytes(this.bs.readVarUint()));
            break;
            case Consts.valueTypes.BYTE: val = this.bs.readInt8(); break;
            case Consts.valueTypes.SHORT: val = this.bs.readInt16(); break;
            case Consts.valueTypes.INT: val = this.bs.readInt32(); break;
            case Consts.valueTypes.LONG:
                val = this.bs.readBigInt64();
                if(!this.opts.useBigInt) val = Number(val);
            break;
            case Consts.valueTypes.UNSIGNED_BYTE: val = this.bs.readUint8(); break;
            case Consts.valueTypes.UNSIGNED_SHORT: val = this.bs.readUint16(); break;
            case Consts.valueTypes.UNSIGNED_INT: val = this.bs.readUint32(); break;
            case Consts.valueTypes.UNSIGNED_LONG:
                val = this.bs.readBigUint64();
                if(!this.opts.useBigInt) val = Number(val);
            break;
            case Consts.valueTypes.FLOAT: val = this.bs.readFloat32(); break;
            case Consts.valueTypes.DOUBLE: val = this.bs.readFloat64(); break;
            case Consts.valueTypes.BOOLEAN: val = !!this.bs.readUint8(); break;
            case Consts.valueTypes.TIMESTAMP:
                let tr = this.bs.readUint8();
                let time = this.bs.readBigInt64();
                switch(tr){
                    case Consts.timeResolution.SECONDS: time *= 1000n; break;
                    case Consts.timeResolution.MILLISECONDS: break;
                    case Consts.timeResolution.MICROSECONDS: time /= 1000n; break;
                    case Consts.timeResolution.NANOSECONDS: time /= 1000000n; break;
                }
                val = new Date(Number(time));
            break;
            case Consts.valueTypes.ARRAY:
                val = [];
                let len = this.bs.readVarUint();
                for(let i = 0;i < len;i++){
                    val.push(this.readValue());
                }
            break;
        }
        //console.log(typeof val,val)
        
        if(!this.opts.useValueType){
            if(val === null) return null;
            switch(typeof val){
                case 'undefined': return null;
                case 'object':{
                    if(val instanceof Uint8Array) return Buffer.from(val).toString('base64');
                    else if(val instanceof Date) return val.toJSON();
                    else return val.toString();
                }
                default: return val.toString();
            }
        }
        return val;
    }
    
    readAttributes(el){
        if(this.bs.readUint8() != Consts.START_OF_ATTRIBUTES){
            this.bs.i--;
            return false;
        }
        while(this.bs.readUint8() != Consts.END_OF_ATTRIBUTES){
            let key = this.readText();
            let val = this.readValue();
            if(!el.attributes) el.attributes = {};
            el.attributes[key] = val;
        }
        return true;
    }
    
    readElements(doc){
        if(this.bs.readUint8() != Consts.START_OF_ELEMENTS){
            this.bs.i--;
            return false;
        }
        while(this.bs.readUint8() != Consts.END_OF_ELEMENTS){
            let type = this.bs.readUint8();
            let el = {};
            if(type == Consts.types.ELEMENT){
                el.type = 'element';
                el.name = this.readText();
                this.readAttributes(el);
                this.readElements(el);
            }else if(type == Consts.types.TEXT){
                el.type = 'text';
                el.text = this.readText();
            }else if(type == Consts.types.CDATA){
                el.type = 'cdata';
                el.cdata = this.readText();
            }else if(type == Consts.types.PROCESSING_INSTRUCTION){
                el.type = 'instruction';
                el.name = this.readText();
                el.instruction = this.readText();
            }else if(type == Consts.types.VALUE){
                el.type = this.opts.useValueType ? 'value' : 'text';
                let val = this.readValue();
                if(this.opts.useValueType) el.value = val;
                else el.text = val;
            }else if(type == Consts.types.DOCTYPE){
                el.type = 'doctype';
                el.doctype = this.readText();
            }
            if(!doc.elements) doc.elements = [];
            doc.elements.push(el);
        }
        return true;
    }
}