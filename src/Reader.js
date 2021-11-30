const Consts = require('./Consts');
const { ByteStream } = require('byte-data-stream');

module.exports = class Reader{
    constructor(buf,opts){
        this.bs = new ByteStream(buf);
        this.opts = opts;
    }
    
    read_document(){
        let doc = {};

        this.verify_signature();
        this.verify_version(doc);

        // 조만간 구현 예정
        let compress = this.read_compress();

        this.read_declaration(doc);
        this.read_elements(doc);

        return doc;
    }
    
    verify_signature(){
        // 시그니처 안맞으면 퉤
        let sign = this.bs.read_bytes(Consts.KASUARI.length);
        if(!Consts.KASUARI.every((e,i,a) => sign[i] == a[i])){
            throw new TypeError('bad signature bytes. I want kasuari');
        }
    }
    
    read_text(){
        // 모든 데이터 길이의 숫자 타입은
        // 원칙적으로 big endian의 var uint다
        let b = this.bs.read_bytes(this.bs.read_var_uint());
        let s = Buffer.from(b).toString('utf8');
        return s;
    }
    
    verify_version(doc){
        doc.bxml_version = this.bs.read_uint16();
        if(doc.bxml_version >= Consts.VERSION) throw new Error("Outdated parser (please update the package.)");
    }

    read_compress(){
        return this.bs.read_uint16();
    }
    
    read_declaration(doc){
        if(this.bs.read_uint8() != Consts.START_OF_DECLARATION) throw new TypeError('There is no START_OF_DECLARATION.');
        let decl = doc.declaration = {};
        this.read_attributes(decl);
    }
    
    read_value(){
        const type = this.bs.read_uint8();
        let val = null;
        switch(type){
            case Consts.value_types.NULL: val = null; break;
            case Consts.value_types.TEXT: val = this.read_text(); break;
            case Consts.value_types.BINARY_DATA:
                val = Uint8Array.from(this.bs.read_bytes(this.bs.read_var_uint()));
            break;
            case Consts.value_types.BYTE: val = this.bs.read_int8(); break;
            case Consts.value_types.SHORT: val = this.bs.read_int16(); break;
            case Consts.value_types.INT: val = this.bs.read_int32(); break;
            case Consts.value_types.LONG:
                val = this.bs.read_big_int64();
                if(!this.opts.use_bigint) val = Number(val);
            break;
            case Consts.value_types.UNSIGNED_BYTE: val = this.bs.read_uint8(); break;
            case Consts.value_types.UNSIGNED_SHORT: val = this.bs.read_uint16(); break;
            case Consts.value_types.UNSIGNED_INT: val = this.bs.read_uint32(); break;
            case Consts.value_types.UNSIGNED_LONG:
                val = this.bs.read_big_uint64();
                if(!this.opts.use_bigint) val = Number(val);
            break;
            case Consts.value_types.FLOAT: val = this.bs.read_float32(); break;
            case Consts.value_types.DOUBLE: val = this.bs.read_float64(); break;
            case Consts.value_types.BOOLEAN: val = !!this.bs.read_uint8(); break;
            case Consts.value_types.TIMESTAMP:
                let tr = this.bs.read_uint8();
                let time = this.bs.read_big_int64();
                switch(tr){
                    case Consts.time_resolution.SECONDS: time *= 1000n; break;
                    case Consts.time_resolution.MILLISECONDS: break;
                    case Consts.time_resolution.MICROSECONDS: time /= 1000n; break;
                    case Consts.time_resolution.NANOSECONDS: time /= 1000000n; break;
                }
                val = new Date(Number(time));
            break;
            case Consts.value_types.ARRAY:
                val = [];
                let len = this.bs.read_var_uint();
                for(let i = 0;i < len;i++){
                    val.push(this.read_value());
                }
            break;
        }
        //console.log(typeof val,val)
        
        if(!this.opts.use_value_type){
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
    
    read_attributes(el){
        if(this.bs.read_uint8() != Consts.START_OF_ATTRIBUTES){
            this.bs.i--;
            return false;
        }
        while(this.bs.read_uint8() != Consts.END_OF_ATTRIBUTES){
            let key = this.read_text();
            let val = this.read_value();
            if(!el.attributes) el.attributes = {};
            el.attributes[key] = val;
        }
        return true;
    }
    
    read_elements(doc){
        if(this.bs.read_uint8() != Consts.START_OF_ELEMENTS){
            this.bs.i--;
            return false;
        }
        while(this.bs.read_uint8() != Consts.END_OF_ELEMENTS){
            let type = this.bs.read_uint8();
            let el = {};
            if(type == Consts.types.ELEMENT){
                el.type = 'element';
                el.name = this.read_text();
                this.read_attributes(el);
                this.read_elements(el);
            }else if(type == Consts.types.TEXT){
                el.type = 'text';
                el.text = this.read_text();
            }else if(type == Consts.types.CDATA){
                el.type = 'cdata';
                el.cdata = this.read_text();
            }else if(type == Consts.types.PROCESSING_INSTRUCTION){
                el.type = 'instruction';
                el.name = this.read_text();
                el.instruction = this.read_text();
            }else if(type == Consts.types.VALUE){
                el.type = this.opts.use_value_type ? 'value' : 'text';
                let val = this.read_value();
                if(this.opts.use_value_type) el.value = val;
                else el.text = val;
            }else if(type == Consts.types.DOCTYPE){
                el.type = 'doctype';
                el.doctype = this.read_text();
            }
            if(!doc.elements) doc.elements = [];
            doc.elements.push(el);
        }
        return true;
    }
}