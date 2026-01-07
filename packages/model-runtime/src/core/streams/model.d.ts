/**
 * 将异步迭代器转换为 JSON 格式的 ReadableStream
 */
export declare const createModelPullStream: <T extends {
    completed?: number;
    digest?: string;
    status: string;
    total?: number;
}>(iterable: AsyncIterable<T>, model: string, { onCancel, }?: {
    onCancel?: (reason?: any) => void;
}) => ReadableStream;
//# sourceMappingURL=model.d.ts.map