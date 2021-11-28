module.exports = {
    KASUARI:[0x6b,0x61,0x73,0x75,0x61,0x72,0x69,0x5f],
    VERSION:0, // 부호없는 16비트 정수(0~65535)
    START_OF_DECLARATION:0x00,
    START_OF_ELEMENTS:0x01,
    END_OF_ELEMENTS:0x02,
    START_OF_ELEMENT:0x03,
    START_OF_ATTRIBUTES:0x05,
    START_OF_ATTRIBUTE:0x06,
    END_OF_ATTRIBUTES:0x07,
    types:{
        ELEMENT:0x00,
        TEXT:0x01,
        CDATA:0x02,
        PROCESSING_INSTRUCTION:0x03,
        DOCTYPE:0x04,
        VALUE:0x05
    },
    value_types:{
        NULL:0x00,
        TEXT:0x01,
        BINARY_DATA:0x02,
        BYTE:0x03,
        SHORT:0x04,
        INT:0x05,
        LONG:0x06,
        FLOAT:0x07,
        DOUBLE:0x08,
        BOOLEAN:0x09,
        TIMESTAMP:0x10
    },
    time_resolution:{
        SECONDS:0x00,
        MILLISECONDS:0x01,
        MICROSECONDS:0x02,
        NANOSECONDS:0x03
    }
};