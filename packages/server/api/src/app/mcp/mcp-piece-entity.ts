import { MCPPieceSchema } from '@activepieces/shared'
import { EntitySchema } from 'typeorm'
import { ApIdSchema, BaseColumnSchemaPart } from '../database/database-common'

export const MCPPieceEntity = new EntitySchema<MCPPieceSchema>({
    name: 'mcp_piece',
    columns: {
        ...BaseColumnSchemaPart,
        pieceName: {
            type: String,
            nullable: false,
        },
        mcpId: {
            ...ApIdSchema,
            nullable: false,
        },
        connectionId: {
            ...ApIdSchema,
            nullable: true,
        },
    },
    indices: [
        {
            name: 'mcp_piece_mcp_id',
            columns: ['mcpId'],
        },
        {
            name: 'mcp_piece_connection_id',
            columns: ['connectionId'],
        },
        {
            name: 'mcp_piece_unique_piece_per_mcp',
            columns: ['mcpId', 'pieceName'],
            unique: true,
        }
    ],
    relations: {
        connection: {
            type: 'one-to-one',
            target: 'app_connection',
            joinColumn: {
                name: 'connectionId',
                referencedColumnName: 'id'
            },
            cascade: true,
            onDelete: 'CASCADE',
            nullable: true,
        },
    },
})
