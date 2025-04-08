import { MCPSchema } from '@activepieces/shared'
import { EntitySchema } from 'typeorm'
import { ApIdSchema, BaseColumnSchemaPart } from '../database/database-common'



export const MCPEntity = new EntitySchema<MCPSchema>({
    name: 'mcp',
    columns: {
        ...BaseColumnSchemaPart,
        projectId: ApIdSchema,
        token: ApIdSchema,
    },
    indices: [
        {
            name: 'mcp_project_id',
            columns: ['projectId'],
            unique: true,
        },
    ],
    relations: {
        pieces: {
            type: 'one-to-many',
            target: 'mcp_piece',
            inverseSide: 'mcp',
            cascade: true,
            onDelete: 'CASCADE',
        },
    },
    
})

