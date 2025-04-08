import { Static, Type } from "@sinclair/typebox";
import { ApId, AppConnectionWithoutSensitiveData, BaseModelSchema } from "@activepieces/shared";

export const MCP = Type.Object({
    ...BaseModelSchema,
    projectId: ApId,
    token: ApId
})

export type MCP = Static<typeof MCP> 

export type MCPSchema = MCP & {
    pieces: MCPPiece[]
}

export const MCPPiece = Type.Object({
    ...BaseModelSchema,
    pieceName: Type.String(),
    connectionId: Type.Optional(ApId),
    mcpId: ApId
})

export type MCPPiece = Static<typeof MCPPiece>

export type MCPPieceSchema = MCPPiece & {
    connection?: AppConnectionWithoutSensitiveData
}