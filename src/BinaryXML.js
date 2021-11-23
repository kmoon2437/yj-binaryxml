const xmljs = require('xml-js');
const Consts = require('./Consts');
const Reader = require('./Reader');
const Writer = require('./Writer');
const WriteSimulator = require('./WriteSimulator');

module.exports = class BinaryXML{
    static to_binary_xml(str){
        let xml = xmljs.xml2js(str,{ ignoreComment:true });
        let simulator = new WriteSimulator();
        simulator.write_document(xml);
        let writer = new Writer(simulator.bs.length);
        writer.write_document(xml);
        return writer.bs.buffer;
    }

    static to_xml_string(buf,spaces = 0){
        let xml = new Reader(buf).read_document();
        return xmljs.js2xml(xml);
    }
}