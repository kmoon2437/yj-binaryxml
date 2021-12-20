const xmljs = require('xml-js');
const Reader = require('./Reader');
const Writer = require('./Writer');

module.exports = class BinaryXML{
    static fromXMLString(str,opts){
        let xml = xmljs.xml2js(str,{ ignoreComment:true });
        return this.fromParsedXML(xml,opts);
    }
    
    static fromParsedXML(xml,opts = {}){
        let simulator = new Writer(0,true);
        simulator.writeDocument(xml,opts);
        let writer = new Writer(simulator.bs.length);
        return writer.writeDocument(xml,opts).u8;
    }
    
    /*
    opts 설명
    opts.useBigInt (기본값:false)
    - long 숫자 타입에서 bigint 타입을 사용할지 설정
    - false일 경우 long 숫자 타입에서도 일반 number가 사용됨
    opts.useValueType (기본값: true)
    - value(문자열 이외의 값을 넣을 수 있음) 타입을 사용할지 설정
    - 순수 xml로 변환해야 한다면 false로 할 것을 강력히 권장
    */
    static toParsedXML(buf,opts = {}){
        // 옵션 설정
        opts = Object.assign({
            useBigInt:false,
            useValueType:true
        },opts);
        return new Reader(buf,opts).readDocument();
    }

    static toXMLString(buf,opts = {}){
        let { spaces } = opts;
        delete opts.spaces;
        opts.useValueType = false;
        return xmljs.js2xml(this.toParsedXML(buf,opts),{ spaces });
    }
}