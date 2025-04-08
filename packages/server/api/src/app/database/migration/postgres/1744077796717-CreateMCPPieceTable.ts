import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMCPPieceTable1744077796717 implements MigrationInterface {
    name = 'CreateMCPPieceTable1744077796717'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, for each mcpId and pieceName combination, keep only one connection and delete the rest
        await queryRunner.query(`
            WITH RankedConnections AS (
                SELECT 
                    id,
                    mcpId,
                    pieceName,
                    ROW_NUMBER() OVER (PARTITION BY mcpId, pieceName ORDER BY created ASC) as rn
                FROM "app_connection"
                WHERE "mcpId" IS NOT NULL
            )
            DELETE FROM "app_connection"
            WHERE id IN (
                SELECT id 
                FROM RankedConnections 
                WHERE rn > 1
            )
        `);

        // Drop the old index
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_app_connection_mcp_id"
        `);

        // Create the new mcp_piece table
        await queryRunner.query(`
            CREATE TABLE "mcp_piece" (
                "id" character varying(21) NOT NULL,
                "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "pieceName" character varying NOT NULL,
                "mcpId" character varying(21) NOT NULL,
                "connectionId" character varying(21),
                CONSTRAINT "pk_mcp_piece" PRIMARY KEY ("id"),
                CONSTRAINT "uq_mcp_piece_connection_id" UNIQUE ("connectionId")
            )
        `);

        // Create indices for mcp_piece
        await queryRunner.query(`
            CREATE INDEX "idx_mcp_piece_mcp_id" ON "mcp_piece" ("mcpId")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_mcp_piece_connection_id" ON "mcp_piece" ("connectionId")
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_mcp_piece_mcp_id_piece_name" ON "mcp_piece" ("mcpId", "pieceName")
        `);

        // Add mcpPieceId column to app_connection
        await queryRunner.query(`
            ALTER TABLE "app_connection"
            ADD COLUMN "mcpPieceId" character varying(21)
        `);

        // Create index for mcpPieceId
        await queryRunner.query(`
            CREATE INDEX "idx_app_connection_mcp_piece_id" ON "app_connection" ("mcpPieceId")
        `);

        // Insert mcp_piece entries for existing connections
        await queryRunner.query(`
            INSERT INTO "mcp_piece" (
                "id",
                "created",
                "updated",
                "pieceName",
                "mcpId",
                "connectionId"
            )
            SELECT 
                gen_random_uuid() as id,
                ac.created,
                ac.updated,
                ac.pieceName,
                ac.mcpId,
                ac.id as connectionId
            FROM "app_connection" ac
            WHERE ac.mcpId IS NOT NULL
        `);

        // Update the connections with their corresponding mcp_piece ids
        await queryRunner.query(`
            UPDATE "app_connection" ac
            SET "mcpPieceId" = mp.id
            FROM "mcp_piece" mp
            WHERE ac.id = mp.connectionId
        `);

        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "mcp_piece"
            ADD CONSTRAINT "fk_mcp_piece_mcp_id" FOREIGN KEY ("mcpId") REFERENCES "mcp"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "mcp_piece"
            ADD CONSTRAINT "fk_mcp_piece_connection_id" FOREIGN KEY ("connectionId") REFERENCES "app_connection"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        // Add foreign key from app_connection to mcp_piece
        await queryRunner.query(`
            ALTER TABLE "app_connection"
            ADD CONSTRAINT "fk_app_connection_mcp_piece_id" FOREIGN KEY ("mcpPieceId") REFERENCES "mcp_piece"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        // Drop old mcpId column from app_connection after all data is migrated
        await queryRunner.query(`
            ALTER TABLE "app_connection" DROP COLUMN IF EXISTS "mcpId"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "app_connection" DROP CONSTRAINT IF EXISTS "fk_app_connection_mcp_piece_id"
        `);
        await queryRunner.query(`
            ALTER TABLE "mcp_piece" DROP CONSTRAINT IF EXISTS "fk_mcp_piece_connection_id"
        `);
        await queryRunner.query(`
            ALTER TABLE "mcp_piece" DROP CONSTRAINT IF EXISTS "fk_mcp_piece_mcp_id"
        `);

        // Drop indices
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_app_connection_mcp_piece_id"
        `);
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_mcp_piece_mcp_id_piece_name"
        `);
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_mcp_piece_connection_id"
        `);
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_mcp_piece_mcp_id"
        `);

        // Add back the old mcpId column
        await queryRunner.query(`
            ALTER TABLE "app_connection"
            ADD COLUMN "mcpId" character varying(21)
        `);

        // Copy data back from mcp_piece to app_connection
        await queryRunner.query(`
            UPDATE "app_connection" ac
            SET "mcpId" = mp.mcpId
            FROM "mcp_piece" mp
            WHERE ac.mcpPieceId = mp.id
        `);

        // Drop mcpPieceId column from app_connection
        await queryRunner.query(`
            ALTER TABLE "app_connection" DROP COLUMN IF EXISTS "mcpPieceId"
        `);

        // Create old index
        await queryRunner.query(`
            CREATE INDEX "idx_app_connection_mcp_id" ON "app_connection" ("mcpId")
        `);

        // Drop the new table
        await queryRunner.query(`
            DROP TABLE IF EXISTS "mcp_piece"
        `);
    }
} 