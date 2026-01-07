"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGoogleGenerateObjectWithTools = exports.createGoogleGenerateObject = exports.convertOpenAISchemaToGoogleSchema = void 0;
const genai_1 = require("@google/genai");
const debug_1 = __importDefault(require("debug"));
const google_1 = require("../../core/contextBuilders/google");
const debug = (0, debug_1.default)('lobe-mode-runtime:google:generateObject');
var HarmCategory;
(function (HarmCategory) {
    HarmCategory["HARM_CATEGORY_DANGEROUS_CONTENT"] = "HARM_CATEGORY_DANGEROUS_CONTENT";
    HarmCategory["HARM_CATEGORY_HARASSMENT"] = "HARM_CATEGORY_HARASSMENT";
    HarmCategory["HARM_CATEGORY_HATE_SPEECH"] = "HARM_CATEGORY_HATE_SPEECH";
    HarmCategory["HARM_CATEGORY_SEXUALLY_EXPLICIT"] = "HARM_CATEGORY_SEXUALLY_EXPLICIT";
})(HarmCategory || (HarmCategory = {}));
var HarmBlockThreshold;
(function (HarmBlockThreshold) {
    HarmBlockThreshold["BLOCK_NONE"] = "BLOCK_NONE";
})(HarmBlockThreshold || (HarmBlockThreshold = {}));
const modelsOffSafetySettings = new Set(['gemini-2.0-flash-exp']);
function getThreshold(model) {
    if (modelsOffSafetySettings.has(model)) {
        return 'OFF'; // https://discuss.ai.google.dev/t/59352
    }
    return HarmBlockThreshold.BLOCK_NONE;
}
const convertType = (type) => {
    switch (type) {
        case 'string': {
            return genai_1.Type.STRING;
        }
        case 'number': {
            return genai_1.Type.NUMBER;
        }
        case 'integer': {
            return genai_1.Type.INTEGER;
        }
        case 'boolean': {
            return genai_1.Type.BOOLEAN;
        }
        case 'array': {
            return genai_1.Type.ARRAY;
        }
        case 'object': {
            return genai_1.Type.OBJECT;
        }
        default: {
            return genai_1.Type.STRING;
        }
    }
};
/**
 * Convert OpenAI JSON schema to Google Gemini schema format
 */
const convertOpenAISchemaToGoogleSchema = (openAISchema) => {
    const convertSchema = (schema) => {
        if (!schema)
            return schema;
        const converted = {
            type: convertType(schema.type),
        };
        if (schema.description) {
            converted.description = schema.description;
        }
        if (schema.enum) {
            converted.enum = schema.enum;
        }
        if (schema.properties) {
            converted.properties = {};
            for (const [key, value] of Object.entries(schema.properties)) {
                converted.properties[key] = convertSchema(value);
            }
        }
        if (schema.items) {
            converted.items = convertSchema(schema.items);
        }
        if (schema.required) {
            converted.required = schema.required;
        }
        if (schema.propertyOrdering) {
            converted.propertyOrdering = schema.propertyOrdering;
        }
        return converted;
    };
    return convertSchema(openAISchema.schema);
};
exports.convertOpenAISchemaToGoogleSchema = convertOpenAISchemaToGoogleSchema;
/**
 * Generate structured output using Google Gemini API
 * @see https://ai.google.dev/gemini-api/docs/structured-output
 */
const createGoogleGenerateObject = async (client, payload, options) => {
    const { schema, contents, model } = payload;
    debug('createGoogleGenerateObject started', {
        contentsLength: contents.length,
        hasSchema: !!schema,
        model,
    });
    // Convert OpenAI schema to Google schema format
    const responseSchema = (0, exports.convertOpenAISchemaToGoogleSchema)(schema);
    debug('Schema conversion completed', {
        convertedSchema: responseSchema,
        originalSchema: schema,
    });
    const config = {
        abortSignal: options?.signal,
        responseMimeType: 'application/json',
        responseSchema,
        // avoid wide sensitive words
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: getThreshold(model),
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: getThreshold(model),
            },
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: getThreshold(model),
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: getThreshold(model),
            },
        ],
    };
    debug('Config prepared', {
        hasAbortSignal: !!config.abortSignal,
        hasSafetySettings: !!config.safetySettings,
        model,
        responseMimeType: config.responseMimeType,
    });
    const response = await client.models.generateContent({
        config,
        contents,
        model,
    });
    debug('API response received', { hasText: !!response.text, textLength: response.text?.length });
    const text = response.text;
    try {
        const result = JSON.parse(text);
        debug('JSON parsing successful', result);
        return result;
    }
    catch {
        console.error('parse json error:', text);
        return undefined;
    }
};
exports.createGoogleGenerateObject = createGoogleGenerateObject;
/**
 * Generate structured output using Google Gemini API with tools calling
 * @see https://ai.google.dev/gemini-api/docs/function-calling
 */
const createGoogleGenerateObjectWithTools = async (client, payload, options) => {
    const { tools, contents, model } = payload;
    debug('createGoogleGenerateObjectWithTools started', {
        contentsLength: contents.length,
        model,
        toolsCount: tools.length,
    });
    // Convert tools to Google FunctionDeclaration format
    const functionDeclarations = tools.map(google_1.buildGoogleTool);
    debug('Tools conversion completed', { functionDeclarations });
    const config = {
        abortSignal: options?.signal,
        // avoid wide sensitive words
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: getThreshold(model),
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: getThreshold(model),
            },
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: getThreshold(model),
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: getThreshold(model),
            },
        ],
        // Force tool calling with 'any' mode
        toolConfig: {
            functionCallingConfig: {
                mode: genai_1.FunctionCallingConfigMode.ANY,
            },
        },
        tools: [{ functionDeclarations }],
    };
    debug('Config prepared', {
        hasAbortSignal: !!config.abortSignal,
        hasSafetySettings: !!config.safetySettings,
        hasTools: !!config.tools,
        model,
    });
    const response = await client.models.generateContent({
        config,
        contents,
        model,
    });
    debug('API response received', {
        candidatesCount: response.candidates?.length,
        hasContent: !!response.candidates?.[0]?.content,
    });
    // Extract function calls from response
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
        debug('no content parts in response');
        return undefined;
    }
    const functionCalls = candidate.content.parts
        .filter((part) => part.functionCall)
        .map((part) => ({
        arguments: part.functionCall.args,
        name: part.functionCall.name,
    }));
    debug('extracted function calls', { count: functionCalls.length, functionCalls });
    return functionCalls.length > 0 ? functionCalls : undefined;
};
exports.createGoogleGenerateObjectWithTools = createGoogleGenerateObjectWithTools;
//# sourceMappingURL=generateObject.js.map