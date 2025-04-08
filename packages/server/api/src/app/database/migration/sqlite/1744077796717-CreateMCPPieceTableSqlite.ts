import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMCPPieceTableSqlite1744077796717 implements MigrationInterface {
    name = 'CreateMCPPieceTableSqlite1744077796717'

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
                "id" varchar(21) PRIMARY KEY NOT NULL,
                "created" datetime NOT NULL DEFAULT (datetime('now')),
                "updated" datetime NOT NULL DEFAULT (datetime('now')),
                "pieceName" varchar NOT NULL,
                "mcpId" varchar(21) NOT NULL,
                "connectionId" varchar(21),
                FOREIGN KEY ("mcpId") REFERENCES "mcp" ("id") ON DELETE CASCADE,
                FOREIGN KEY ("connectionId") REFERENCES "app_connection" ("id") ON DELETE CASCADE,
                UNIQUE ("connectionId")
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
                lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))) as id,
                ac.created,
                ac.updated,
                ac.pieceName,
                ac.mcpId,
                ac.id as connectionId
            FROM "app_connection" ac
            WHERE ac.mcpId IS NOT NULL
        `);

        // Create new app_connection table with mcpPieceId and without mcpId
        await queryRunner.query(`
            CREATE TABLE "temp_app_connection" (
                "id" varchar(21) PRIMARY KEY NOT NULL,
                "created" datetime NOT NULL DEFAULT (datetime('now')),
                "updated" datetime NOT NULL DEFAULT (datetime('now')),
                "pieceName" varchar NOT NULL,
                "value" text NOT NULL,
                "type" varchar NOT NULL,
                "status" varchar NOT NULL DEFAULT ('ACTIVE'),
                "ownerId" varchar,
                "displayName" varchar NOT NULL,
                "externalId" varchar NOT NULL,
                "platformId" varchar NOT NULL,
                "projectIds" text NOT NULL,
                "scope" varchar NOT NULL,
                "mcpPieceId" varchar(21),
                FOREIGN KEY ("mcpPieceId") REFERENCES "mcp_piece" ("id") ON DELETE SET NULL
            )
        `);

        // Copy data to new table, including the mcpPieceId from mcp_piece
        await queryRunner.query(`
            INSERT INTO "temp_app_connection" (
                "id",
                "created",
                "updated",
                "pieceName",
                "value",
                "type",
                "status",
                "ownerId",
                "displayName",
                "externalId",
                "platformId",
                "projectIds",
                "scope",
                "mcpPieceId"
            )
            SELECT 
                ac."id",
                ac."created",
                ac."updated",
                ac."pieceName",
                ac."value",
                ac."type",
                ac."status",
                ac."ownerId",
                ac."displayName",
                ac."externalId",
                ac."platformId",
                ac."projectIds",
                ac."scope",
                mp."id" as "mcpPieceId"
            FROM "app_connection" ac
            LEFT JOIN "mcp_piece" mp ON ac."id" = mp."connectionId"
        `);

        // Drop old table and rename new one
        await queryRunner.query(`DROP TABLE "app_connection"`);
        await queryRunner.query(`ALTER TABLE "temp_app_connection" RENAME TO "app_connection"`);

        // Create index for mcpPieceId
        await queryRunner.query(`
            CREATE INDEX "idx_app_connection_mcp_piece_id" ON "app_connection" ("mcpPieceId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Create new app_connection table with mcpId and without mcpPieceId
        await queryRunner.query(`
            CREATE TABLE "temp_app_connection" (
                "id" varchar(21) PRIMARY KEY NOT NULL,
                "created" datetime NOT NULL DEFAULT (datetime('now')),
                "updated" datetime NOT NULL DEFAULT (datetime('now')),
                "pieceName" varchar NOT NULL,
                "value" text NOT NULL,
                "type" varchar NOT NULL,
                "status" varchar NOT NULL DEFAULT ('ACTIVE'),
                "ownerId" varchar,
                "displayName" varchar NOT NULL,
                "externalId" varchar NOT NULL,
                "platformId" varchar NOT NULL,
                "projectIds" text NOT NULL,
                "scope" varchar NOT NULL,
                "mcpId" varchar(21)
            )
        `);

        // Copy data back, including mcpId from mcp_piece
        await queryRunner.query(`
            INSERT INTO "temp_app_connection" (
                "id",
                "created",
                "updated",
                "pieceName",
                "value",
                "type",
                "status",
                "ownerId",
                "displayName",
                "externalId",
                "platformId",
                "projectIds",
                "scope",
                "mcpId"
            )
            SELECT 
                ac."id",
                ac."created",
                ac."updated",
                ac."pieceName",
                ac."value",
                ac."type",
                ac."status",
                ac."ownerId",
                ac."displayName",
                ac."externalId",
                ac."platformId",
                ac."projectIds",
                ac."scope",
                mp."mcpId"
            FROM "app_connection" ac
            LEFT JOIN "mcp_piece" mp ON ac."mcpPieceId" = mp."id"
        `);

        // Drop old table and rename new one
        await queryRunner.query(`DROP TABLE "app_connection"`);
        await queryRunner.query(`ALTER TABLE "temp_app_connection" RENAME TO "app_connection"`);

        // Create old index
        await queryRunner.query(`
            CREATE INDEX "idx_app_connection_mcp_id" ON "app_connection" ("mcpId")
        `);

        // Drop indices and mcp_piece table
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_mcp_piece_mcp_id_piece_name"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_mcp_piece_connection_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_mcp_piece_mcp_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "mcp_piece"`);
    }
} 