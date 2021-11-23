const Consts = require('./Consts');
const { ByteStream } = require('byte-data-stream');

module.exports = class Reader{
    constructor(buf){
        this.bs = new ByteStream(buf);
    }
    
    read_document(){
        let doc = {};

        this.verify_signature();
        this.read_version(doc);
        this.read_declaration(doc);
        this.read_elements(doc);

        return doc;
    }
    
    verify_signature(){
        let sign = this.bs.read_bytes(Consts.KASUARI.length);
        let tojson = JSON.stringify;
        if(tojson(sign) != tojson(Consts.KASUARI)) throw new TypeError('bad signature bytes. I want kasuari');
    }
    
    read_text(){
        // 모든 데이터 길이의 숫자 타입은
        // 원칙적으로 big endian의 var uint다
        let b = this.bs.read_bytes(this.bs.read_var_uint());
        let s = Buffer.from(b).toString('utf8');
        return s;
    }
    
    read_version(doc){
        doc.bxml_version = this.bs.read_uint16();
    }
    
    read_declaration(doc){
        if(this.bs.read_uint8() != Consts.START_OF_DECLARATION) throw new TypeError('There is no START_OF_DECLARATION.');
        let decl = doc.declaration = {};
        this.read_attributes(decl);
    }
    
    read_attributes(el){
        if(this.bs.read_uint8() != Consts.START_OF_ATTRIBUTES){
            this.bs.i--;
            return false;
        }
        while(this.bs.read_uint8() != Consts.END_OF_ATTRIBUTES){
            let key = this.read_text();
            let val = this.read_text();
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
            }
            if(!doc.elements) doc.elements = [];
            doc.elements.push(el);
        }
        return true;
    }
}