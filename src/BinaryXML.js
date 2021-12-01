const xmljs = require('xml-js');
const Consts = require('./Consts');
const Reader = require('./Reader');
const Writer = require('./Writer');

module.exports = class BinaryXML{
    static from_xml_string(str,opts){
        let xml = xmljs.xml2js(str,{ ignoreComment:true });
        return this.from_parsed_xml(xml,opts);
    }
    
    static from_parsed_xml(xml,opts = {}){
        let simulator = new Writer(0,true);
        simulator.write_document(xml);
        let writer = new Writer(simulator.bs.length);
        return writer.write_document(xml,opts).u8;
    }
    
    /*
    opts 설명
    opts.use_bigint (기본값:false)
    - long 숫자 타입에서 bigint 타입을 사용할지 설정
    - false일 경우 long 숫자 타입에서도 일반 number가 사용됨
    opts.use_value_type (기본값: true)
    - value(문자열 이외의 값을 넣을 수 있음) 타입을 사용할지 설정
    - 순수 xml로 변환해야 한다면 false로 할 것을 강력히 권장
    */
    static to_parsed_xml(buf,opts = {}){
        // 옵션 설정
        opts = Object.assign({
            use_bigint:false,
            use_value_type:true
        },opts);
        return new Reader(buf,opts).read_document();
    }

    static to_xml_string(buf,opts = {}){
        let { spaces } = opts;
        delete opts.spaces;
        opts.use_value_type = false;
        return xmljs.js2xml(this.to_parsed_xml(buf,opts),{ spaces });
    }
}