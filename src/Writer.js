const Consts = require('./Consts');
const { ByteStream } = require('byte-data-stream');

module.exports = class Writer{
    constructor(initial_length){
        this.bs = new ByteStream(new ArrayBuffer(initial_length));
    }
    
    write_document(xml){
        // signature bytes
        this.bs.write_bytes(Consts.KASUARI);
        
        // version
        this.bs.write_uint16(Consts.VERSION);
        
        // content
        this.write_declaration(xml.declaration.attributes);
        this.write_elements(xml.elements);
    }
    
    write_text(text){
        // 모든 데이터 길이의 숫자 타입은
        // 원칙적으로 big endian의 var uint다
        let b = Buffer.from(text,'utf8');
        this.bs.write_var_uint(b.byteLength);
        this.bs.write_bytes([...b]);
    }
    
    write_declaration(declaration){
        this.bs.write_uint8(Consts.START_OF_DECLARATION);
        this.write_attributes(declaration);
    }
    
    write_elements(elements){
        this.bs.write_uint8(Consts.START_OF_ELEMENTS);
        elements.forEach(el => {
            this.bs.write_uint8(Consts.START_OF_ELEMENT);
            // 사실 comment도 있는데 바이너리파일에서 주석은 의미가 없음
            if(el.type == 'element'){
                this.bs.write_uint8(Consts.types.ELEMENT);
                this.write_text(el.name);
                if(el.attributes) this.write_attributes(el.attributes);
                if(el.elements) this.write_elements(el.elements);
            }else if(el.type == 'text'){
                this.bs.write_uint8(Consts.types.TEXT);
                this.write_text(el.text);
            }else if(el.type == 'cdata'){
                this.bs.write_uint8(Consts.types.CDATA);
                this.write_text(el.cdata);
            }else if(el.type == 'instruction'){
                this.bs.write_uint8(Consts.types.PROCESSING_INSTRUCTION);
                this.write_text(el.name);
                this.write_text(el.instruction);
            }else{
                throw new Error('Unsupported type '+el.type);
            }
        });
        this.bs.write_uint8(Consts.END_OF_ELEMENTS);
    }
    
    write_attributes(attributes){
        this.bs.write_uint8(Consts.START_OF_ATTRIBUTES);
        for(let i in attributes){
            this.bs.write_uint8(Consts.START_OF_ATTRIBUTE);
            this.write_text(i);
            this.write_text(attributes[i]);
        }
        this.bs.write_uint8(Consts.END_OF_ATTRIBUTES);
    }
}