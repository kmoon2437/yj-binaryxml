const Consts = require('./Consts');
const { ByteStream,ByteStreamSimulator } = require('byte-data-stream');

function is_range(num,min,max){
    return min <= num && num <= max;
}

module.exports = class Writer{
    constructor(initial_length,simulate = false){
        this.bs = simulate
        ? new ByteStreamSimulator()
        : new ByteStream(new ArrayBuffer(initial_length));
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
    
    write_value(val){
        if(val === null){
            this.bs.write_uint8(Consts.value_types.NULL);
            return;
        }
        
        switch(typeof val){
            case 'undefined':
                this.bs.write_uint8(Consts.value_types.NULL);
            break;
            case 'string':
                this.bs.write_uint8(Consts.value_types.TEXT);
                this.write_text(val);
            break;
            case 'object':
                if(val instanceof Date){
                    this.bs.write_uint8(Consts.value_types.TIMESTAMP);
                    this.bs.write_uint8(Consts.time_resolution.MILLISECONDS);
                    this.bs.write_big_int64(BigInt(val.getTime()));
                }else if(val instanceof Uint8Array){
                    this.bs.write_uint8(Consts.value_types.BINARY_DATA);
                    this.bs.write_var_uint(val.byteLength);
                    this.bs.write_bytes([...val]);
                }else if(val instanceof ArrayBuffer){
                    this.bs.write_uint8(Consts.value_types.BINARY_DATA);
                    this.bs.write_var_uint(b.byteLength);
                    this.bs.write_bytes([...new Uint8Array(b)]);
                }else if(val instanceof Array){
                    this.bs.write_uint8(Consts.value_types.ARRAY);
                    this.bs.write_var_uint(val.length);
                    val.forEach(a => this.write_value(a));
                }else throw new TypeError('object value must be an instance of Array or Date or Uint8Array or ArrayBuffer or nodejs Buffer');
            break;
            case 'number':
                // 그냥 숫자가 들어오면 숫자 크기에 따라 타입을 자동으로 설정
                if(Number.isInteger(val)){
                    if(val >= 0){ // 양수는 unsigned로 저장
                        if(val < 256){
                            this.bs.write_uint8(Consts.value_types.UNSIGNED_BYTE);
                            this.bs.write_uint8(val);
                        }else if(val < 65536){
                            this.bs.write_uint8(Consts.value_types.UNSIGNED_SHORT);
                            this.bs.write_uint16(val);
                        }else if(val < 4294967296){
                            this.bs.write_uint8(Consts.value_types.UNSIGNED_INT);
                            this.bs.write_uint32(val);
                        }else{
                            this.bs.write_uint8(Consts.value_types.UNSIGNED_LONG);
                            this.bs.write_big_uint64(BigInt(val));
                        }
                    }else{
                        if(is_range(val,-128,127)){
                            this.bs.write_uint8(Consts.value_types.BYTE);
                            this.bs.write_int8(val);
                        }else if(is_range(val,-32768,32767)){
                            this.bs.write_uint8(Consts.value_types.SHORT);
                            this.bs.write_int16(val);
                        }else if(is_range(val,-2147483648,2147483647)){
                            this.bs.write_uint8(Consts.value_types.INT);
                            this.bs.write_int32(val);
                        }else{
                            this.bs.write_uint8(Consts.value_types.LONG);
                            this.bs.write_big_int64(BigInt(val));
                        }
                    }
                }else{
                    this.bs.write_uint8(Consts.value_types.DOUBLE);
                    this.bs.write_float64(val);
                }
            break;
            case 'bigint':
                if(val >= 0n){
                    if(val < 256n){
                        this.bs.write_uint8(Consts.value_types.UNSIGNED_BYTE);
                        this.bs.write_uint8(Number(val));
                    }else if(val < 65536n){
                        this.bs.write_uint8(Consts.value_types.UNSIGNED_SHORT);
                        this.bs.write_uint16(Number(val));
                    }else if(val < 4294967296n){
                        this.bs.write_uint8(Consts.value_types.UNSIGNED_INT);
                        this.bs.write_uint32(Number(val));
                    }else{
                        this.bs.write_uint8(Consts.value_types.UNSIGNED_LONG);
                        this.bs.write_big_uint64(val);
                    }
                }else{
                    if(is_range(val,-128n,127n)){
                        this.bs.write_uint8(Consts.value_types.BYTE);
                        this.bs.write_int8(Number(val));
                    }else if(is_range(val,-32768n,32767n)){
                        this.bs.write_uint8(Consts.value_types.SHORT);
                        this.bs.write_int16(Number(val));
                    }else if(is_range(val,-2147483648n,2147483647n)){
                        this.bs.write_uint8(Consts.value_types.INT);
                        this.bs.write_int32(Number(val));
                    }else{
                        this.bs.write_uint8(Consts.value_types.LONG);
                        this.bs.write_big_int64(val);
                    }
                }
            break;
            case 'boolean':
                this.bs.write_uint8(Consts.value_types.BOOLEAN);
                this.bs.write_uint8(val ? 0 : 1);
            break;
        }
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
            }else if(el.type == 'doctype'){
                this.bs.write_uint8(Consts.types.DOCTYPE);
                this.write_text(el.doctype);
            }else if(el.type == 'value'){
                this.bs.write_uint8(Consts.types.VALUE);
                this.write_value(el.value);
            }else{
                throw new TypeError('Unsupported type '+el.type);
            }
        });
        this.bs.write_uint8(Consts.END_OF_ELEMENTS);
    }
    
    write_attributes(attributes){
        this.bs.write_uint8(Consts.START_OF_ATTRIBUTES);
        for(let i in attributes){
            this.bs.write_uint8(Consts.START_OF_ATTRIBUTE);
            this.write_text(i);
            this.write_value(attributes[i]);
            //console.log(i,attributes[i])
        }
        this.bs.write_uint8(Consts.END_OF_ATTRIBUTES);
    }
}