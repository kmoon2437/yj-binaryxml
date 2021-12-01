module.exports = {
    // 헤더 시그니처(매직넘버). 카스아리는 찐이다
    KASUARI:Uint8Array.from([0x6b,0x61,0x73,0x75,0x61,0x72,0x69,0x5f]),

    // 파일 버젼
    // 파일에 지정된 값이 여깄는 값보다 크면 파일 읽기를 거부
    VERSION:0x0000, // 부호없는 16비트 정수(0~65535,0x0000~0xffff)

    // xml declaration
    START_OF_DECLARATION:0x00,

    // elements
    START_OF_ELEMENTS:0x01,
    END_OF_ELEMENTS:0x02,

    // 단일 element
    START_OF_ELEMENT:0x03,

    // element의 속성
    START_OF_ATTRIBUTES:0x05,
    START_OF_ATTRIBUTE:0x06,
    END_OF_ATTRIBUTES:0x07,

    // element의 타입
    types:{
        ELEMENT:0x00, // <태그></태그>
        TEXT:0x01, // 텍스트
        CDATA:0x02, // <![CDATA[...내용...]]>
        PROCESSING_INSTRUCTION:0x03, // <?처리명령 ...내용... ?>
        DOCTYPE:0x04, // <!doctype ...>
        VALUE:0x05 // 값
    },

    // value의 타입
    value_types:{
        NULL:0x00, // null
        TEXT:0x01, // 텍스트
        BINARY_DATA:0x02, // binary data(Uint8Array)

        // 부호 있는 정수 타입
        BYTE:0x03,
        SHORT:0x04,
        INT:0x05,
        LONG:0x06,

        // 부동소수점 타입
        FLOAT:0x07,
        DOUBLE:0x08,

        BOOLEAN:0x09, // boolean
        TIMESTAMP:0x10, // 시간(Date)
        ARRAY:0x11, // 배열

        // 부호 없는 정수 타입
        UNSIGNED_BYTE:0x12,
        UNSIGNED_SHORT:0x13,
        UNSIGNED_INT:0x14,
        UNSIGNED_LONG:0x15
    },

    // 저 timestamp 타입의 시간 해상도
    time_resolution:{
        SECONDS:0x00, // 초
        MILLISECONDS:0x01, // 밀리초
        MICROSECONDS:0x02, // 마이크로초
        NANOSECONDS:0x03 // 나노초
    },

    // 압축(부호없는 16비트 정수)
    compress:{
        RAW:0x0000, // 아무것도 안함
        DEFLATE:0x0001, // zip파일과 같은 방식
        GZIP:0x0002 // gz파일과 같은 방식
    }
};