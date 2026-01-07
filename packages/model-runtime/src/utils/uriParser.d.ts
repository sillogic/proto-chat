interface UriParserResult {
    base64: string | null;
    mimeType: string | null;
    type: 'url' | 'base64' | null;
}
export declare const parseDataUri: (dataUri: string) => UriParserResult;
export {};
//# sourceMappingURL=uriParser.d.ts.map