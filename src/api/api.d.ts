import { ExtractRPCFromHandler } from "../backend/types/utility";
import * as articleConvertPOSTHandler from "../backend/router/article/convert/POST";
import * as issueConvertPOSTHandler from "../backend/router/issue/convert/POST";
import * as projectTypesGETHandler from "../backend/router/project/types/GET";
import * as projectTypesPOSTHandler from "../backend/router/project/types/POST";

export type ApiRouter = {
    article: {
        convert: {
            POST: ExtractRPCFromHandler<articleConvertPOSTHandler.Handle>;
        };
    };
    issue: {
        convert: {
            POST: ExtractRPCFromHandler<issueConvertPOSTHandler.Handle>;
        };
    };
    project: {
        types: {
            GET: ExtractRPCFromHandler<projectTypesGETHandler.Handle>;
            POST: ExtractRPCFromHandler<projectTypesPOSTHandler.Handle>;
        };
    };
};
